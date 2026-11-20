import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import {
  AppLanguage,
  CartelaEntry,
  ClientMessage,
  DEFAULT_CALL_INTERVAL_MS,
  DEFAULT_RANK_THRESHOLDS,
  DEFAULT_STAKES,
  DailyMission,
  ENDED_DURATION_SEC,
  GamePhase,
  HouseSettings,
  INITIAL_DEPOSIT_BIRR,
  LeaderboardEntry,
  LobbySnapshot,
  MAX_CARTELAS_LIMIT,
  MIN_CARTELAS,
  PlayerIdentity,
  PlayerMissionState,
  PlayerWallet,
  PublicGameState,
  RankTierId,
  RoomSummary,
  RoundWinner,
  SELECTION_DURATION_SEC,
  SeasonThemeId,
  ServerMessage,
  SpecialEvent,
  TOTAL_CARTELAS,
  checkWinningPattern,
  computeRankTier,
  generateCartelaGrid,
  getBallLetter,
  validateCustomGrid,
} from './shared/bingo.ts';
import { supabaseStore } from './server-db.ts';
import { TelegramBotHandler } from './server-bot.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const USE_POLLING = process.env.TELEGRAM_USE_POLLING === 'true';
let EFFECTIVE_ADMIN_PIN = (process.env.ADMIN_PIN || '1234').trim();
const STARTING_DEPOSIT = Math.max(0, Number(process.env.INITIAL_DEPOSIT_BIRR) || INITIAL_DEPOSIT_BIRR);
const ADMIN_TG_IDS = new Set(
  (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('tg_') ? s : `tg_${s}`))
);

function getAppUrl(req?: express.Request): string {
  const envUrl = (process.env.APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

function verifyTelegramInitData(initData: string, botToken: string): PlayerIdentity | null {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) return null;

    const userRaw = params.get('user');
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    const fullName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      user.username ||
      `Player ${user.id}`;
    return {
      id: `tg_${user.id}`,
      name: fullName.slice(0, 32),
      username: user.username,
      isTelegram: true,
    };
  } catch {
    return null;
  }
}

interface ClientSession {
  player: PlayerIdentity | null;
  autoClaim: boolean;
  stakeBirr: number | null;
  isAdmin: boolean;
}

class BingoRoom {
  public readonly stakeBirr: number;
  public roundNumber = 1;
  public gamesPlayed = 0;
  public phase: GamePhase = 'OPENING';
  public isPaused = false;
  public phaseStartedAt = Date.now();
  public phaseEndsAt = Date.now() + SELECTION_DURATION_SEC * 1000;

  private pausedRemainingMs = 0;
  private pausedNextCallDeltaMs = 0;

  private shuffledDeck: number[] = [];
  public queuedNumbers: number[] = [];
  public calledNumbers: number[] = [];
  private calledSet = new Set<number>();
  private nextCallAt = 0;
  private pendingAutoWinCheck: NodeJS.Timeout | null = null;

  public entries: CartelaEntry[] = [];
  public winners: RoundWinner[] = [];
  public displayedPlayersOverride: number | null = null;
  public adminTakeCount = 0;
  public activeSpecialEventId: string | null = null;

  constructor(
    stakeBirr: number,
    private readonly hub: BingoHub
  ) {
    this.stakeBirr = stakeBirr;
    this.startOpeningPhase(true);
  }

  public getActiveSpecialEvent(): SpecialEvent | null {
    return this.hub.getEventForRoom(this.stakeBirr, this.activeSpecialEventId);
  }

  public getPrizePool(): number {
    const totalEntriesCount = this.entries.length;
    const effectiveCount =
      this.displayedPlayersOverride !== null
        ? Math.max(totalEntriesCount, this.displayedPlayersOverride)
        : totalEntriesCount;
    const gross = effectiveCount * this.stakeBirr;
    const base = Math.max(0, Math.round(gross * (1 - this.hub.settings.commissionPercent / 100)));
    const ev = this.getActiveSpecialEvent();
    return ev ? base + Math.max(0, Math.round(ev.bonusPrizeBirr)) : base;
  }

  public getUniquePlayersCount(): number {
    return new Set(this.entries.filter((e) => !e.isHouseReserved).map((e) => e.playerId)).size;
  }

  public getDisplayedPlayersCount(): number {
    if (this.displayedPlayersOverride !== null) {
      return this.displayedPlayersOverride;
    }
    const houseCount = this.entries.filter((e) => e.isHouseReserved).length;
    return this.getUniquePlayersCount() + houseCount;
  }

  public applyAdminTakenCartelas() {
    if (this.phase !== 'OPENING') return;
    this.entries = this.entries.filter((e) => !e.isHouseReserved);
    const maxCap = this.hub.settings.maxCartelas || TOTAL_CARTELAS;
    const target = Math.max(0, Math.min(maxCap, this.adminTakeCount));
    if (target === 0) return;

    const takenNumbers = new Set(
      this.entries.filter((e) => !e.isCustom).map((e) => e.cartelaNumber)
    );
    const available: number[] = [];
    for (let i = 1; i <= maxCap; i++) {
      if (!takenNumbers.has(i)) available.push(i);
    }
    for (let i = available.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [available[i], available[j]] = [available[j], available[i]];
    }
    const count = Math.min(target, available.length);
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const num = available[i];
      this.entries.push({
        entryId: `${this.stakeBirr}_${this.roundNumber}_house_${num}_${crypto.randomUUID().slice(0, 6)}`,
        cartelaNumber: num,
        isCustom: false,
        isHouseReserved: true,
        grid: generateCartelaGrid(num),
        playerId: 'house_reserved',
        playerName: 'House',
        paidFromDeposit: 0,
        paidFromWon: 0,
        autoClaim: false,
        selectedAt: now,
      });
    }
  }

  private createShuffledDeck(): number[] {
    const arr = Array.from({ length: 75 }, (_, i) => i + 1);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private clearPendingAutoWin() {
    if (this.pendingAutoWinCheck) {
      clearTimeout(this.pendingAutoWinCheck);
      this.pendingAutoWinCheck = null;
    }
  }

  public startOpeningPhase(isInitial = false, incrementRound = true) {
    this.clearPendingAutoWin();
    if (!isInitial && incrementRound) {
      this.roundNumber += 1;
    }
    const now = Date.now();
    this.phase = 'OPENING';
    this.isPaused = false;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + SELECTION_DURATION_SEC * 1000;
    this.shuffledDeck = [];
    this.calledNumbers = [];
    this.calledSet.clear();
    this.entries = [];
    this.winners = [];
    this.nextCallAt = 0;
    this.applyAdminTakenCartelas();
    if (!isInitial) {
      this.hub.broadcastRoom(this.stakeBirr, { type: 'phase:changed', state: this.getPublicState() });
      this.hub.broadcastLobby();
    }
  }

  public startCallingPhase() {
    this.clearPendingAutoWin();
    const now = Date.now();
    this.phase = 'CALLING';
    this.isPaused = false;
    this.phaseStartedAt = now;
    this.shuffledDeck = this.createShuffledDeck();
    this.calledNumbers = [];
    this.calledSet.clear();
    this.winners = [];
    const intervalMs = this.getCallIntervalMs();
    this.phaseEndsAt = now + 75 * intervalMs + 1500;
    this.nextCallAt = now + 900;
    this.hub.broadcastRoom(this.stakeBirr, { type: 'phase:changed', state: this.getPublicState() });
    this.hub.broadcastLobby();
  }

  public endRound(winners: RoundWinner[]) {
    this.clearPendingAutoWin();
    const now = Date.now();
    const realEntries = this.entries.filter((e) => !e.isHouseReserved);
    const totalPotBirr = realEntries.length * this.stakeBirr;
    const prizePoolBirr = this.getPrizePool();
    const commissionBirr = Math.max(
      0,
      Math.round(totalPotBirr * (this.hub.settings.commissionPercent / 100))
    );
    const endedRoundNumber = this.roundNumber;
    const roundStartedAt = this.phaseStartedAt;
    const roundPlayersCount = this.getUniquePlayersCount();
    const roundEntriesCount = realEntries.length;
    const roundCalledNumbers = [...this.calledNumbers];

    this.phase = 'ENDED';
    this.isPaused = false;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + ENDED_DURATION_SEC * 1000;
    this.winners = winners;
    this.gamesPlayed += 1;
    this.queuedNumbers = [];

    for (const w of winners) {
      w.playerRank = w.playerRank || this.hub.getPlayerRankTier(w.playerId);
      this.hub.creditWin(w.playerId, w.prizeAmount);
      this.hub.recordWinner(w);
    }

    if (realEntries.length > 0 || winners.length > 0) {
      void this.hub.recordRoundEndMissions(realEntries, winners);
    }

    if (roundEntriesCount > 0 || winners.length > 0) {
      void supabaseStore.recordRound({
        stakeBirr: this.stakeBirr,
        roundNumber: endedRoundNumber,
        playersCount: roundPlayersCount,
        entriesCount: roundEntriesCount,
        totalPotBirr,
        commissionPercent: this.hub.settings.commissionPercent,
        commissionBirr,
        prizePoolBirr,
        winners,
        calledNumbers: roundCalledNumbers,
        startedAtMs: roundStartedAt,
        endedAtMs: now,
      });
    }

    this.hub.broadcastRoom(this.stakeBirr, { type: 'round:ended', state: this.getPublicState() });
    this.hub.broadcastAdmins();
    this.hub.broadcastLobby();
  }

  public setPaused(paused: boolean) {
    if (this.isPaused === paused) return;
    const now = Date.now();
    if (paused) {
      this.isPaused = true;
      this.pausedRemainingMs = Math.max(0, this.phaseEndsAt - now);
      this.pausedNextCallDeltaMs = Math.max(0, this.nextCallAt - now);
      this.clearPendingAutoWin();
    } else {
      this.isPaused = false;
      this.phaseEndsAt = now + this.pausedRemainingMs;
      if (this.phase === 'CALLING') {
        this.nextCallAt = now + Math.max(300, this.pausedNextCallDeltaMs);
      }
    }
    this.hub.broadcastRoom(this.stakeBirr, { type: 'phase:changed', state: this.getPublicState() });
    this.hub.broadcastLobby();
  }

  public stopAndResetRound() {
    // Refund active cartela entries cleanly on admin stop
    for (const e of this.entries) {
      if (!e.isHouseReserved && (e.paidFromDeposit > 0 || e.paidFromWon > 0)) {
        this.hub.refundEntry(e.playerId, e.paidFromDeposit, e.paidFromWon);
      }
    }
    this.queuedNumbers = [];
    this.startOpeningPhase(false, false);
    this.hub.broadcastAdmins();
  }

  public forceEndRound() {
    if (this.phase === 'OPENING') {
      for (const e of this.entries) {
        if (!e.isHouseReserved && (e.paidFromDeposit > 0 || e.paidFromWon > 0)) {
          this.hub.refundEntry(e.playerId, e.paidFromDeposit, e.paidFromWon);
        }
      }
      this.endRound([]);
      return;
    }
    if (this.phase === 'CALLING') {
      const matched = this.findMatchingEntries(this.entries.filter((e) => !e.isHouseReserved));
      if (matched.length > 0) {
        const totalPrize = this.getPrizePool();
        const splitPrize = Math.max(0, Math.round(totalPrize / matched.length));
        const now = Date.now();
        const winners: RoundWinner[] = matched.map((m) => ({
          playerId: m.entry.playerId,
          playerName: m.entry.playerName,
          playerRank: m.entry.playerRank || this.hub.getPlayerRankTier(m.entry.playerId),
          cartelaNumber: m.entry.cartelaNumber,
          isCustom: m.entry.isCustom,
          patternName: m.patternName,
          winningCells: m.winningCells,
          winningNumber: m.winningNumber,
          prizeAmount: splitPrize,
          stakeBirr: this.stakeBirr,
          grid: m.entry.grid,
          callsCount: this.calledNumbers.length,
          roundNumber: this.roundNumber,
          wonAt: now,
        }));
        this.endRound(winners);
      } else {
        this.endRound([]);
      }
    }
  }

  public setQueuedNumbers(nums: number[]) {
    const clean: number[] = [];
    const seen = new Set<number>();
    for (const n of nums) {
      if (Number.isInteger(n) && n >= 1 && n <= 75 && !this.calledSet.has(n) && !seen.has(n)) {
        seen.add(n);
        clean.push(n);
      }
    }
    this.queuedNumbers = clean;
    this.hub.broadcastAdmins();
  }

  public drawSpecificOrNext(requestedNum?: number): number | null {
    if (this.phase !== 'CALLING') return null;
    let nextBall: number | undefined;

    if (
      typeof requestedNum === 'number' &&
      Number.isInteger(requestedNum) &&
      requestedNum >= 1 &&
      requestedNum <= 75 &&
      !this.calledSet.has(requestedNum)
    ) {
      nextBall = requestedNum;
      this.queuedNumbers = this.queuedNumbers.filter((n) => n !== nextBall);
      this.shuffledDeck = this.shuffledDeck.filter((n) => n !== nextBall);
    } else {
      while (this.queuedNumbers.length > 0) {
        const candidate = this.queuedNumbers.shift()!;
        if (!this.calledSet.has(candidate)) {
          nextBall = candidate;
          this.shuffledDeck = this.shuffledDeck.filter((n) => n !== candidate);
          break;
        }
      }
      if (nextBall === undefined) {
        while (this.shuffledDeck.length > 0) {
          const candidate = this.shuffledDeck.shift()!;
          if (!this.calledSet.has(candidate)) {
            nextBall = candidate;
            break;
          }
        }
      }
    }

    if (nextBall === undefined) return null;

    const now = Date.now();
    this.calledNumbers.push(nextBall);
    this.calledSet.add(nextBall);
    this.nextCallAt = now + this.getCallIntervalMs();

    this.hub.broadcastRoom(this.stakeBirr, {
      type: 'ball:called',
      stakeBirr: this.stakeBirr,
      ball: nextBall,
      calledNumbers: this.calledNumbers,
      remainingBallCount: 75 - this.calledNumbers.length,
      serverTime: now,
    });
    this.hub.broadcastAdmins();
    this.hub.broadcastLobby();

    const roundSnapshot = this.roundNumber;
    this.clearPendingAutoWin();
    this.pendingAutoWinCheck = setTimeout(() => {
      this.checkAutoClaimWinners(roundSnapshot);
      if (
        !this.isPaused &&
        this.phase === 'CALLING' &&
        this.roundNumber === roundSnapshot &&
        this.calledNumbers.length >= 75
      ) {
        this.endRound([]);
      }
    }, 650);

    return nextBall;
  }

  private getCallIntervalMs(): number {
    return Math.round(this.hub.settings.callIntervalSeconds * 1000);
  }

  private findMatchingEntries(list: CartelaEntry[]) {
    const matched: Array<{
      entry: CartelaEntry;
      patternName: string;
      winningCells: [number, number][];
      winningNumber: number | null;
    }> = [];
    for (const entry of list) {
      const res = checkWinningPattern(entry.grid, this.calledNumbers);
      if (res.won) {
        matched.push({
          entry,
          patternName: res.patternName,
          winningCells: res.winningCells,
          winningNumber: res.winningNumber,
        });
      }
    }
    return matched;
  }

  private checkAutoClaimWinners(roundAtCall: number) {
    if (this.isPaused || this.phase !== 'CALLING' || this.roundNumber !== roundAtCall) return;
    const autoEntries = this.entries.filter((e) => !e.isHouseReserved && e.autoClaim);
    if (autoEntries.length === 0) return;

    const matched = this.findMatchingEntries(autoEntries);
    if (matched.length === 0) return;

    const totalPrize = this.getPrizePool();
    const splitPrize = Math.max(0, Math.round(totalPrize / matched.length));
    const now = Date.now();

    const winners: RoundWinner[] = matched.map((m) => ({
      playerId: m.entry.playerId,
      playerName: m.entry.playerName,
      playerRank: m.entry.playerRank || this.hub.getPlayerRankTier(m.entry.playerId),
      cartelaNumber: m.entry.cartelaNumber,
      isCustom: m.entry.isCustom,
      patternName: m.patternName,
      winningCells: m.winningCells,
      winningNumber: m.winningNumber,
      prizeAmount: splitPrize,
      stakeBirr: this.stakeBirr,
      grid: m.entry.grid,
      callsCount: this.calledNumbers.length,
      roundNumber: this.roundNumber,
      wonAt: now,
    }));

    this.endRound(winners);
  }

  public tick() {
    if (this.activeSpecialEventId && !this.getActiveSpecialEvent()) {
      this.activeSpecialEventId = null;
    }
    if (this.isPaused) return;
    const now = Date.now();

    if (this.phase === 'OPENING') {
      if (now >= this.phaseEndsAt) {
        const activeEv = this.getActiveSpecialEvent();
        const realPlayersCount = this.getUniquePlayersCount();
        if (
          activeEv &&
          activeEv.minPlayers > 0 &&
          realPlayersCount > 0 &&
          realPlayersCount < activeEv.minPlayers
        ) {
          this.phaseEndsAt = now + 15_000;
          this.hub.broadcastRoom(this.stakeBirr, {
            type: 'action:error',
            message: `${activeEv.name} needs ${activeEv.minPlayers} players (${realPlayersCount}/${activeEv.minPlayers}). Extending countdown 15s.`,
          });
          this.hub.broadcastRoom(this.stakeBirr, { type: 'state:sync', state: this.getPublicState() });
          this.hub.broadcastLobby();
          return;
        }
        this.startCallingPhase();
      }
      return;
    }

    if (this.phase === 'CALLING') {
      if (now >= this.nextCallAt && this.calledNumbers.length < 75) {
        this.drawSpecificOrNext();
      }
      return;
    }

    if (this.phase === 'ENDED') {
      if (now >= this.phaseEndsAt) {
        this.startOpeningPhase(false, true);
      }
    }
  }

  public getSecondsRemaining(): number {
    if (this.isPaused) {
      return Math.max(0, Math.ceil(this.pausedRemainingMs / 1000));
    }
    return Math.max(0, Math.ceil((this.phaseEndsAt - Date.now()) / 1000));
  }

  public getSummary(): RoomSummary {
    return {
      stakeBirr: this.stakeBirr,
      roundNumber: this.roundNumber,
      gamesPlayed: this.gamesPlayed,
      phase: this.phase,
      isPaused: this.isPaused,
      secondsRemaining: this.getSecondsRemaining(),
      entriesCount: this.entries.filter((e) => !e.isHouseReserved).length,
      uniquePlayersCount: this.getUniquePlayersCount(),
      displayedPlayersCount: this.getDisplayedPlayersCount(),
      displayedPlayersOverride: this.displayedPlayersOverride,
      adminTakeCount: this.adminTakeCount,
      playersInRoom: this.hub.countRoomPlayers(this.stakeBirr),
      prizePool: this.getPrizePool(),
      calledCount: this.calledNumbers.length,
      currentBall: this.calledNumbers.length > 0 ? this.calledNumbers[this.calledNumbers.length - 1] : null,
    };
  }

  public getPublicState(): PublicGameState {
    const now = Date.now();
    return {
      stakeBirr: this.stakeBirr,
      roundNumber: this.roundNumber,
      gamesPlayed: this.gamesPlayed,
      phase: this.phase,
      isPaused: this.isPaused,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.isPaused ? now + this.pausedRemainingMs : this.phaseEndsAt,
      secondsRemaining: this.getSecondsRemaining(),
      calledNumbers: this.calledNumbers,
      currentBall: this.calledNumbers.length > 0 ? this.calledNumbers[this.calledNumbers.length - 1] : null,
      remainingBallCount: 75 - this.calledNumbers.length,
      entries: this.entries,
      uniquePlayersCount: this.getUniquePlayersCount(),
      displayedPlayersCount: this.getDisplayedPlayersCount(),
      displayedPlayersOverride: this.displayedPlayersOverride,
      adminTakeCount: this.adminTakeCount,
      onlineCount: this.hub.getTotalOnlineCount(),
      playersInRoom: this.hub.countRoomPlayers(this.stakeBirr),
      commissionPercent: this.hub.settings.commissionPercent,
      prizePool: this.getPrizePool(),
      callIntervalMs: this.getCallIntervalMs(),
      winners: this.winners,
      recentWinners: this.hub.getRecentWinners(15),
      leaderboard: this.hub.getLeaderboard(),
      botConfigured: Boolean(BOT_TOKEN),
      settings: {
        ...this.hub.settings,
        stakes: [...this.hub.settings.stakes],
        rankThresholds: { ...this.hub.settings.rankThresholds },
      },
      activeSpecialEvent: this.getActiveSpecialEvent(),
      serverTime: now,
    };
  }
}

class BingoHub {
  public settings: HouseSettings = {
    stakes: [...DEFAULT_STAKES],
    commissionPercent: Math.min(80, Math.max(0, Number(process.env.COMMISSION_PERCENT) || 20)),
    callIntervalSeconds: (() => {
      const sec = Number(process.env.CALL_INTERVAL_SECONDS);
      if (!Number.isFinite(sec) || sec < 1) return DEFAULT_CALL_INTERVAL_MS / 1000;
      return Math.min(120, sec);
    })(),
    maxCartelas: TOTAL_CARTELAS,
    seasonTheme: 'none',
    rankThresholds: { ...DEFAULT_RANK_THRESHOLDS },
    missionCompletionBonus: 50,
    onlineCountOverride: null,
  };

  public rooms = new Map<number, BingoRoom>();
  public recentWinners: RoundWinner[] = [];
  public customRecentWinners: RoundWinner[] | null = null;
  public customLeaderboard: LeaderboardEntry[] | null = null;
  public specialEvents: SpecialEvent[] = [];
  public dailyMissions: DailyMission[] = [];
  public extraAdminIds = new Set<string>();
  public bannedPlayers = new Set<string>();
  private totalDepositedMap = new Map<string, number>();
  private leaderboardMap = new Map<string, LeaderboardEntry>();
  private cachedLeaderboard: LeaderboardEntry[] | null = null;
  private temporaryEventStakes = new Set<number>();
  private wallets = new Map<string, PlayerWallet>();
  private playerNames = new Map<string, string>();
  private playerLanguages = new Map<string, AppLanguage>();
  private playerUsernames = new Map<string, string>();
  private clients = new Map<WebSocket, ClientSession>();
  private loopTimer: NodeJS.Timeout | null = null;
  private lobbyTicker: NodeJS.Timeout | null = null;
  private dbSyncTimer: NodeJS.Timeout | null = null;
  private lastPlayerSyncIso = new Date().toISOString();

  constructor() {
    for (const stake of this.settings.stakes) {
      this.rooms.set(stake, new BingoRoom(stake, this));
    }
    this.loopTimer = setInterval(() => {
      for (const room of this.rooms.values()) {
        room.tick();
      }
    }, 250);
    this.lobbyTicker = setInterval(() => {
      this.broadcastLobby();
    }, 1000);
    void this.hydrateFromSupabase();
    if (supabaseStore.isEnabled) {
      this.dbSyncTimer = setInterval(() => {
        void this.pullExternalWalletUpdates();
      }, 5000);
    }
  }

  public isAdminTelegramId(playerId: string): boolean {
    const clean = playerId.startsWith('tg_') ? playerId : `tg_${playerId}`;
    return ADMIN_TG_IDS.has(clean) || this.extraAdminIds.has(clean);
  }

  public getAllAdminIdsList(): string[] {
    const combined = new Set<string>([...ADMIN_TG_IDS, ...this.extraAdminIds]);
    return Array.from(combined);
  }

  public getPlayerRankTier(playerId: string): RankTierId {
    const totalDep = this.totalDepositedMap.get(playerId) || 0;
    return computeRankTier(totalDep, this.settings.rankThresholds);
  }

  public getActiveSpecialEvents(): SpecialEvent[] {
    const nowMs = Date.now();
    return this.specialEvents.filter(
      (ev) => ev.isActive && (!ev.endsAt || new Date(ev.endsAt).getTime() > nowMs)
    );
  }

  public getEventForRoom(stakeBirr: number, preferredEventId: string | null): SpecialEvent | null {
    const active = this.getActiveSpecialEvents();
    if (preferredEventId) {
      const exact = active.find((e) => e.id === preferredEventId && e.entryBirr === stakeBirr);
      if (exact) return exact;
    }
    return active.find((e) => e.entryBirr === stakeBirr) || null;
  }

  private applyLiveConfig(config: {
    adminPin?: string;
    commissionPercent?: number;
    callIntervalMs?: number;
    maxCartelas?: number;
    seasonTheme?: SeasonThemeId;
    rankThresholds?: typeof DEFAULT_RANK_THRESHOLDS;
    missionCompletionBonus?: number;
    extraAdminIds?: string[];
    customRecentWinners?: RoundWinner[] | null;
    customLeaderboard?: LeaderboardEntry[] | null;
  }) {
    if (config.adminPin) {
      EFFECTIVE_ADMIN_PIN = config.adminPin;
    }
    if (typeof config.commissionPercent === 'number' && Number.isFinite(config.commissionPercent)) {
      this.settings.commissionPercent = Math.min(80, Math.max(0, config.commissionPercent));
    }
    if (typeof config.callIntervalMs === 'number' && Number.isFinite(config.callIntervalMs) && config.callIntervalMs >= 1500) {
      this.settings.callIntervalSeconds = Math.min(60, Number((config.callIntervalMs / 1000).toFixed(1)));
    }
    if (typeof config.maxCartelas === 'number' && Number.isFinite(config.maxCartelas)) {
      this.settings.maxCartelas = Math.min(MAX_CARTELAS_LIMIT, Math.max(MIN_CARTELAS, Math.round(config.maxCartelas)));
    }
    if (config.seasonTheme) {
      this.settings.seasonTheme = config.seasonTheme;
    }
    if (config.rankThresholds) {
      const prev = this.settings.rankThresholds;
      const next = config.rankThresholds;
      const changed =
        prev.bronze !== next.bronze ||
        prev.silver !== next.silver ||
        prev.gold !== next.gold ||
        prev.diamond !== next.diamond ||
        prev.platinum !== next.platinum;
      this.settings.rankThresholds = { ...next };
      if (changed) {
        for (const [playerId, w] of this.wallets.entries()) {
          const totalDep = this.totalDepositedMap.get(playerId) || 0;
          const nextRank = computeRankTier(totalDep, this.settings.rankThresholds);
          if (w.rankTier !== nextRank) {
            w.rankTier = nextRank;
            for (const [ws, session] of this.clients.entries()) {
              if (session.player?.id === playerId && ws.readyState === WebSocket.OPEN) {
                this.send(ws, { type: 'wallet:sync', wallet: { ...w } });
              }
            }
          }
        }
      }
    }
    if (typeof config.missionCompletionBonus === 'number' && Number.isFinite(config.missionCompletionBonus)) {
      this.settings.missionCompletionBonus = Math.max(0, config.missionCompletionBonus);
    }
    if (Array.isArray(config.extraAdminIds)) {
      this.extraAdminIds = new Set(
        config.extraAdminIds
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (s.startsWith('tg_') ? s : `tg_${s}`))
      );
    }
    if (config.customRecentWinners !== undefined) {
      this.customRecentWinners = config.customRecentWinners ?? null;
    }
    if (config.customLeaderboard !== undefined) {
      this.customLeaderboard = config.customLeaderboard ?? null;
      this.cachedLeaderboard = null;
    }
  }

  private async hydrateFromSupabase() {
    if (!supabaseStore.isEnabled) return;
    const snap = await supabaseStore.loadInitialSnapshot();
    this.applyLiveConfig(snap.config);
    this.specialEvents = snap.specialEvents;
    this.dailyMissions = snap.dailyMissions;

    for (const p of snap.players) {
      const totalDep = Number(p.total_deposited_birr) || 0;
      this.totalDepositedMap.set(p.id, totalDep);
      if (p.is_banned) this.bannedPlayers.add(p.id);
      else this.bannedPlayers.delete(p.id);

      this.wallets.set(p.id, {
        depositedBalance: Number(p.deposited_birr) || 0,
        wonBalance: Number(p.won_birr) || 0,
        totalDeposited: totalDep,
        rankTier: computeRankTier(totalDep, this.settings.rankThresholds),
        isBanned: Boolean(p.is_banned),
      });
      this.playerNames.set(p.id, p.name);
      this.playerLanguages.set(p.id, p.language);
      if (p.username) this.playerUsernames.set(p.id, p.username);
    }
    // Hydrate recent winners & leaderboard from latest rounds in reverse chronological order
    const ordered = [...snap.recentRounds].reverse();
    for (const r of ordered) {
      for (const w of r.winners) {
        this.recordWinner(w);
      }
    }
    this.lastPlayerSyncIso = new Date().toISOString();
    this.broadcastLobby();
    for (const room of this.rooms.values()) {
      this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
    }
    this.broadcastAdmins();
  }

  private async pullExternalWalletUpdates() {
    const parsedMs = Date.parse(this.lastPlayerSyncIso);
    const checkIso = Number.isFinite(parsedMs)
      ? new Date(Math.max(0, parsedMs - 2000)).toISOString()
      : this.lastPlayerSyncIso;

    const [updated, liveSync] = await Promise.all([
      supabaseStore.fetchRecentlyUpdatedPlayers(checkIso),
      supabaseStore.getLiveHubSync(),
    ]);

    let changed = false;
    if (liveSync) {
      this.applyLiveConfig(liveSync.config);
      this.specialEvents = liveSync.specialEvents;
      this.dailyMissions = liveSync.dailyMissions;
      changed = true;
    }

    if (updated.length > 0) {
      let maxIso = this.lastPlayerSyncIso;
      for (const p of updated) {
        if (p.updated_at > maxIso) maxIso = p.updated_at;
        if (p.is_banned) this.bannedPlayers.add(p.id);
        else this.bannedPlayers.delete(p.id);
        this.totalDepositedMap.set(p.id, p.total_deposited_birr);

        const cur = this.wallets.get(p.id);
        const rankTier = computeRankTier(p.total_deposited_birr, this.settings.rankThresholds);
        if (
          !cur ||
          cur.depositedBalance !== p.deposited_birr ||
          cur.wonBalance !== p.won_birr ||
          cur.totalDeposited !== p.total_deposited_birr ||
          cur.rankTier !== rankTier ||
          cur.isBanned !== p.is_banned
        ) {
          const nextWallet: PlayerWallet = {
            depositedBalance: p.deposited_birr,
            wonBalance: p.won_birr,
            totalDeposited: p.total_deposited_birr,
            rankTier,
            isBanned: p.is_banned,
          };
          this.wallets.set(p.id, nextWallet);
          this.playerNames.set(p.id, p.name);
          changed = true;
          for (const [ws, session] of this.clients.entries()) {
            if (session.player?.id === p.id && ws.readyState === WebSocket.OPEN) {
              this.send(ws, { type: 'wallet:sync', wallet: { ...nextWallet } });
            }
          }
        }
      }
      this.lastPlayerSyncIso = maxIso;
    }

    if (changed) {
      this.broadcastLobby();
    }
  }

  public ensureWallet(playerId: string, name?: string, username?: string, language?: AppLanguage): PlayerWallet {
    if (name) {
      this.playerNames.set(playerId, name);
    }
    if (username !== undefined) {
      this.playerUsernames.set(playerId, username);
    }
    if (language && !this.playerLanguages.has(playerId)) {
      this.playerLanguages.set(playerId, language);
    }
    let w = this.wallets.get(playerId);
    const totalDep = this.totalDepositedMap.get(playerId) || 0;
    const rankTier = computeRankTier(totalDep, this.settings.rankThresholds);
    const isBanned = this.bannedPlayers.has(playerId);
    if (!w) {
      w = {
        depositedBalance: STARTING_DEPOSIT,
        wonBalance: 0,
        totalDeposited: totalDep,
        rankTier,
        isBanned,
      };
      this.wallets.set(playerId, w);
      void supabaseStore.upsertPlayer(
        playerId,
        this.playerNames.get(playerId) || 'Player',
        w,
        this.playerLanguages.get(playerId) || 'en',
        this.playerUsernames.get(playerId)
      );
    } else {
      w.totalDeposited = totalDep;
      w.rankTier = rankTier;
      w.isBanned = isBanned;
    }
    return w;
  }

  public hasPlayer(playerId: string): boolean {
    return this.wallets.has(playerId);
  }

  public getPlayerName(playerId: string): string | undefined {
    return this.playerNames.get(playerId);
  }

  public getAllPlayerIds(): string[] {
    return Array.from(this.wallets.keys());
  }

  public getPlayerLanguage(playerId: string): AppLanguage | undefined {
    return this.playerLanguages.get(playerId);
  }

  public setPlayerLanguage(playerId: string, language: AppLanguage) {
    this.playerLanguages.set(playerId, language);
    for (const [ws, session] of this.clients.entries()) {
      if (session.player?.id === playerId && ws.readyState === WebSocket.OPEN) {
        this.send(ws, { type: 'language:sync', language });
      }
    }
    const w = this.wallets.get(playerId);
    if (w) {
      void supabaseStore.upsertPlayer(
        playerId,
        this.playerNames.get(playerId) || 'Player',
        w,
        language,
        this.playerUsernames.get(playerId)
      );
    } else {
      void supabaseStore.setPlayerLanguage(playerId, language);
    }
  }

  public async creditDepositFromBot(
    playerId: string,
    name: string,
    amountBirr: number,
    isRealDeposit = false
  ): Promise<PlayerWallet> {
    const w = this.ensureWallet(playerId, name);
    w.depositedBalance = Math.round((w.depositedBalance + amountBirr) * 100) / 100;
    if (isRealDeposit && amountBirr > 0) {
      const nextTotal = Math.round(((this.totalDepositedMap.get(playerId) || 0) + amountBirr) * 100) / 100;
      this.totalDepositedMap.set(playerId, nextTotal);
      w.totalDeposited = nextTotal;
      w.rankTier = computeRankTier(nextTotal, this.settings.rankThresholds);
      void this.recordDepositMission(playerId, amountBirr);
    }
    this.syncPlayerWallet(playerId);
    this.broadcastAdmins();
    return { ...w };
  }

  public async deductWithdrawFromBot(playerId: string, name: string, amountBirr: number): Promise<PlayerWallet> {
    const w = this.ensureWallet(playerId, name);
    const amt = Math.max(0, amountBirr);
    const fromWon = Math.min(w.wonBalance, amt);
    const rem = amt - fromWon;
    const fromDep = Math.min(w.depositedBalance, rem);
    w.wonBalance = Math.max(0, Math.round((w.wonBalance - fromWon) * 100) / 100);
    w.depositedBalance = Math.max(0, Math.round((w.depositedBalance - fromDep) * 100) / 100);
    this.syncPlayerWallet(playerId);
    this.broadcastAdmins();
    return { ...w };
  }

  public chargeEntry(playerId: string, amount: number): { ok: boolean; fromDeposit: number; fromWon: number } {
    const w = this.ensureWallet(playerId);
    if (w.depositedBalance + w.wonBalance < amount) {
      return { ok: false, fromDeposit: 0, fromWon: 0 };
    }
    const fromDeposit = Math.min(w.depositedBalance, amount);
    const fromWon = amount - fromDeposit;
    w.depositedBalance -= fromDeposit;
    w.wonBalance -= fromWon;
    this.syncPlayerWallet(playerId);
    return { ok: true, fromDeposit, fromWon };
  }

  public refundEntry(playerId: string, fromDeposit: number, fromWon: number) {
    const w = this.ensureWallet(playerId);
    w.depositedBalance += fromDeposit;
    w.wonBalance += fromWon;
    this.syncPlayerWallet(playerId);
  }

  public creditWin(playerId: string, prizeAmount: number) {
    if (prizeAmount <= 0) return;
    const w = this.ensureWallet(playerId);
    w.wonBalance += prizeAmount;
    this.syncPlayerWallet(playerId);
  }

  public syncPlayerWallet(playerId: string) {
    const w = this.ensureWallet(playerId);
    void supabaseStore.upsertPlayer(
      playerId,
      this.playerNames.get(playerId) || 'Player',
      w,
      this.playerLanguages.get(playerId) || 'en',
      this.playerUsernames.get(playerId)
    );
    for (const [ws, session] of this.clients.entries()) {
      if (session.player?.id === playerId && ws.readyState === WebSocket.OPEN) {
        this.send(ws, { type: 'wallet:sync', wallet: { ...w } });
      }
    }
  }

  private getMissionDateStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private matchesPatternFilter(patternName: string, filter: string): boolean {
    const cleanFilter = filter.trim().toLowerCase();
    if (!cleanFilter) return true;
    const normPattern = patternName.trim().toLowerCase();
    if (cleanFilter.includes('corner')) return normPattern.includes('corner');
    if (cleanFilter.includes('diag')) return normPattern.includes('diag');
    if (cleanFilter.includes('row')) return normPattern.includes('row');
    if (cleanFilter.includes('col')) return normPattern.includes('column');
    return normPattern.includes(cleanFilter);
  }

  public async buildPlayerMissionState(playerId: string): Promise<PlayerMissionState> {
    const dateStr = this.getMissionDateStr();
    const activeMissions = this.dailyMissions.filter((m) => m.isActive);
    const prog = await supabaseStore.getPlayerMissionProgress(playerId, dateStr);
    return {
      date: dateStr,
      missions: activeMissions,
      progressMap: prog.progressMap,
      claimedIds: prog.claimedIds,
      allBonusClaimed: prog.allBonusClaimed,
      completionBonusBirr: this.settings.missionCompletionBonus,
    };
  }

  public async pushMissionsToPlayer(playerId: string) {
    const connected = Array.from(this.clients.entries()).filter(
      ([ws, s]) => s.player?.id === playerId && ws.readyState === WebSocket.OPEN
    );
    if (connected.length === 0) return;
    const state = await this.buildPlayerMissionState(playerId);
    for (const [ws] of connected) {
      this.send(ws, { type: 'missions:sync', missions: state });
    }
  }

  public async recordRoundEndMissions(realEntries: CartelaEntry[], winners: RoundWinner[]) {
    const active = this.dailyMissions.filter((m) => m.isActive);
    if (active.length === 0) return;
    const dateStr = this.getMissionDateStr();
    const playerIncrements = new Map<string, Record<string, number>>();
    const addInc = (pId: string, mId: string, delta: number) => {
      const map = playerIncrements.get(pId) || {};
      map[mId] = (map[mId] || 0) + delta;
      playerIncrements.set(pId, map);
    };

    const uniquePlayers = new Set(realEntries.map((e) => e.playerId));
    for (const pId of uniquePlayers) {
      for (const m of active) {
        if (m.missionType === 'play_rounds') addInc(pId, m.id, 1);
      }
    }

    for (const w of winners) {
      for (const m of active) {
        if (m.missionType === 'win_rounds') addInc(w.playerId, m.id, 1);
        if (m.missionType === 'win_pattern' && this.matchesPatternFilter(w.patternName, m.patternFilter)) {
          addInc(w.playerId, m.id, 1);
        }
      }
    }

    for (const [pId, inc] of playerIncrements.entries()) {
      await supabaseStore.incrementPlayerMissionProgress(pId, dateStr, inc);
      await this.pushMissionsToPlayer(pId);
    }
  }

  public async recordInviteMission(referrerFullId: string) {
    const active = this.dailyMissions.filter((m) => m.isActive && m.missionType === 'invite_friends');
    if (active.length === 0) return;
    const inc: Record<string, number> = {};
    for (const m of active) inc[m.id] = 1;
    await supabaseStore.incrementPlayerMissionProgress(referrerFullId, this.getMissionDateStr(), inc);
    await this.pushMissionsToPlayer(referrerFullId);
  }

  public async recordDepositMission(playerFullId: string, depositBirr: number) {
    const active = this.dailyMissions.filter((m) => m.isActive && m.missionType === 'deposit_birr');
    if (active.length === 0 || depositBirr <= 0) return;
    const inc: Record<string, number> = {};
    for (const m of active) inc[m.id] = Math.round(depositBirr);
    await supabaseStore.incrementPlayerMissionProgress(playerFullId, this.getMissionDateStr(), inc);
    await this.pushMissionsToPlayer(playerFullId);
  }

  public getTotalOnlineCount(): number {
    if (this.settings.onlineCountOverride !== null) {
      return this.settings.onlineCountOverride;
    }
    return this.clients.size;
  }

  public countRoomPlayers(stakeBirr: number): number {
    let count = 0;
    for (const session of this.clients.values()) {
      if (session.stakeBirr === stakeBirr) count++;
    }
    return count;
  }

  public recordWinner(w: RoundWinner) {
    const rank = w.playerRank || this.getPlayerRankTier(w.playerId);
    w.playerRank = rank;
    this.recentWinners.unshift(w);
    if (this.recentWinners.length > 30) {
      this.recentWinners.pop();
    }
    const existing = this.leaderboardMap.get(w.playerId);
    if (existing) {
      existing.wins += 1;
      existing.totalBirrWon += w.prizeAmount;
      existing.playerName = w.playerName;
      existing.playerRank = rank;
      existing.lastWonAt = w.wonAt;
    } else {
      this.leaderboardMap.set(w.playerId, {
        playerId: w.playerId,
        playerName: w.playerName,
        playerRank: rank,
        wins: 1,
        totalBirrWon: w.prizeAmount,
        lastWonAt: w.wonAt,
      });
    }
    this.cachedLeaderboard = null;
  }

  public getRecentWinners(limit = 15): RoundWinner[] {
    const source = this.customRecentWinners !== null ? this.customRecentWinners : this.recentWinners;
    return source.slice(0, limit);
  }

  public getLeaderboard(): LeaderboardEntry[] {
    if (this.customLeaderboard !== null) {
      return this.customLeaderboard.slice(0, 10);
    }
    if (!this.cachedLeaderboard) {
      this.cachedLeaderboard = Array.from(this.leaderboardMap.values())
        .sort((a, b) => b.wins - a.wins || b.totalBirrWon - a.totalBirrWon || b.lastWonAt - a.lastWonAt)
        .slice(0, 10);
    }
    return this.cachedLeaderboard;
  }

  public getLobbySnapshot(): LobbySnapshot {
    const activeEvents = this.getActiveSpecialEvents();
    // Prune expired temporary event-only rooms once they are empty and no clients remain in them
    for (const stake of Array.from(this.temporaryEventStakes)) {
      const r = this.rooms.get(stake);
      const usedByActiveEvent = activeEvents.some((e) => e.entryBirr === stake);
      if (
        !usedByActiveEvent &&
        (!r || (r.entries.length === 0 && r.phase === 'OPENING' && this.countRoomPlayers(stake) === 0))
      ) {
        this.rooms.delete(stake);
        this.temporaryEventStakes.delete(stake);
      }
    }

    const combinedStakes = Array.from(new Set([...this.settings.stakes, ...this.temporaryEventStakes])).sort(
      (a, b) => a - b
    );
    const rooms = combinedStakes
      .map((s) => this.rooms.get(s))
      .filter((r): r is BingoRoom => Boolean(r))
      .map((r) => r.getSummary());

    return {
      rooms,
      specialEvents: activeEvents,
      settings: {
        ...this.settings,
        stakes: [...this.settings.stakes],
        rankThresholds: { ...this.settings.rankThresholds },
      },
      onlineCount: this.getTotalOnlineCount(),
      botConfigured: Boolean(BOT_TOKEN),
      serverTime: Date.now(),
    };
  }

  public addClient(ws: WebSocket) {
    this.clients.set(ws, {
      player: null,
      autoClaim: true,
      stakeBirr: null,
      isAdmin: false,
    });
    this.send(ws, { type: 'lobby:sync', lobby: this.getLobbySnapshot() });
    this.broadcastPresence();
  }

  public removeClient(ws: WebSocket) {
    this.clients.delete(ws);
    this.broadcastPresence();
  }

  private broadcastPresence() {
    if (this.clients.size === 0) return;
    const total = this.getTotalOnlineCount();
    for (const [ws, session] of this.clients.entries()) {
      this.send(ws, {
        type: 'presence:updated',
        onlineCount: total,
        playersInRoom: session.stakeBirr !== null ? this.countRoomPlayers(session.stakeBirr) : undefined,
      });
    }
  }

  public broadcastLobby() {
    if (this.clients.size === 0) return;
    const snapshot = this.getLobbySnapshot();
    const payload = JSON.stringify({ type: 'lobby:sync', lobby: snapshot } satisfies ServerMessage);
    for (const ws of this.clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  public broadcastRoom(stakeBirr: number, msg: ServerMessage) {
    if (this.clients.size === 0) return;
    let payload: string | null = null;
    for (const [ws, session] of this.clients.entries()) {
      if (session.stakeBirr === stakeBirr && ws.readyState === WebSocket.OPEN) {
        if (payload === null) payload = JSON.stringify(msg);
        ws.send(payload);
      }
    }
  }

  private buildAdminPayload(): ServerMessage {
    const queuedByRoom: Record<number, number[]> = {};
    for (const [stake, room] of this.rooms.entries()) {
      queuedByRoom[stake] = [...room.queuedNumbers];
    }
    const wallets = Array.from(this.wallets.entries()).map(([playerId, wallet]) => ({
      playerId,
      name: this.playerNames.get(playerId) || playerId,
      wallet: { ...wallet },
      isBanned: this.bannedPlayers.has(playerId),
    }));
    return {
      type: 'admin:status',
      isAdmin: true,
      queuedByRoom,
      wallets,
      adminIds: this.getAllAdminIdsList(),
      recentWinners: this.getRecentWinners(15),
      leaderboard: this.getLeaderboard(),
      isCustomWinners: this.customRecentWinners !== null,
      isCustomLeaderboard: this.customLeaderboard !== null,
    };
  }

  public broadcastAdmins() {
    if (this.clients.size === 0) return;
    let payload: string | null = null;
    for (const [ws, session] of this.clients.entries()) {
      if (session.isAdmin && ws.readyState === WebSocket.OPEN) {
        if (payload === null) payload = JSON.stringify(this.buildAdminPayload());
        ws.send(payload);
      }
    }
  }

  private sendAdminStatus(ws: WebSocket, isAdmin: boolean, message?: string) {
    if (!isAdmin) {
      this.send(ws, { type: 'admin:status', isAdmin: false, queuedByRoom: {}, message });
      return;
    }
    const payload = this.buildAdminPayload();
    if (payload.type === 'admin:status') {
      payload.message = message;
    }
    this.send(ws, payload);
  }

  public handleMessage(ws: WebSocket, raw: string) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(ws, { type: 'action:error', message: 'Invalid message format.' });
      return;
    }

    const session = this.clients.get(ws);
    if (!session) return;

    if (msg.type === 'auth') {
      const cleanName = (msg.player?.name || 'Player').trim().slice(0, 32) || 'Player';
      const cleanId = (msg.player?.id || '').trim().slice(0, 64);
      if (!cleanId) {
        this.send(ws, { type: 'action:error', message: 'Missing player identity.' });
        return;
      }
      session.player = {
        id: cleanId,
        name: cleanName,
        username: msg.player.username,
        isTelegram: Boolean(msg.player.isTelegram),
      };
      if (typeof msg.autoClaim === 'boolean') {
        session.autoClaim = msg.autoClaim;
      }
      const wallet = this.ensureWallet(cleanId, cleanName, msg.player.username, msg.language);
      this.send(ws, { type: 'wallet:sync', wallet: { ...wallet } });

      const knownLang = this.getPlayerLanguage(cleanId);
      if (knownLang) {
        this.send(ws, { type: 'language:sync', language: knownLang });
      }

      if (msg.player.isTelegram && this.isAdminTelegramId(cleanId)) {
        session.isAdmin = true;
        this.sendAdminStatus(ws, true);
      }
      this.send(ws, { type: 'lobby:sync', lobby: this.getLobbySnapshot() });
      void this.pushMissionsToPlayer(cleanId);
      if (session.stakeBirr !== null) {
        const room = this.rooms.get(session.stakeBirr);
        if (room) this.send(ws, { type: 'state:sync', state: room.getPublicState() });
      }
      this.broadcastAdmins();
      return;
    }

    if (msg.type === 'set_language') {
      if (session.player && (msg.language === 'en' || msg.language === 'am' || msg.language === 'om')) {
        this.setPlayerLanguage(session.player.id, msg.language);
      }
      return;
    }

    if (msg.type === 'admin_auth') {
      if (msg.pin && msg.pin.trim() === EFFECTIVE_ADMIN_PIN) {
        session.isAdmin = true;
        this.sendAdminStatus(ws, true, 'Admin unlocked.');
      } else {
        session.isAdmin = false;
        this.sendAdminStatus(ws, false, 'Incorrect Admin PIN.');
      }
      return;
    }

    if (msg.type === 'join_room') {
      if (session.player && this.bannedPlayers.has(session.player.id)) {
        this.send(ws, { type: 'action:error', message: 'Your account has been suspended by an administrator.' });
        return;
      }
      const room = this.rooms.get(msg.stakeBirr);
      if (!room) {
        this.send(ws, { type: 'action:error', message: 'Stake room no longer exists.' });
        return;
      }
      session.stakeBirr = msg.stakeBirr;
      this.send(ws, { type: 'state:sync', state: room.getPublicState() });
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'join_special_event') {
      if (session.player && this.bannedPlayers.has(session.player.id)) {
        this.send(ws, { type: 'action:error', message: 'Your account has been suspended by an administrator.' });
        return;
      }
      const ev = this.getActiveSpecialEvents().find((e) => e.id === msg.eventId);
      if (!ev) {
        this.send(ws, { type: 'action:error', message: 'This special event has ended or is no longer active.' });
        return;
      }
      let room = this.rooms.get(ev.entryBirr);
      if (!room) {
        room = new BingoRoom(ev.entryBirr, this);
        this.rooms.set(ev.entryBirr, room);
        if (!this.settings.stakes.includes(ev.entryBirr)) {
          this.temporaryEventStakes.add(ev.entryBirr);
        }
      }
      room.activeSpecialEventId = ev.id;
      session.stakeBirr = ev.entryBirr;
      this.send(ws, { type: 'state:sync', state: room.getPublicState() });
      this.broadcastLobby();
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'leave_room') {
      session.stakeBirr = null;
      this.send(ws, { type: 'lobby:sync', lobby: this.getLobbySnapshot() });
      this.broadcastPresence();
      return;
    }

    const player = session.player;
    if (!player) {
      this.send(ws, { type: 'action:error', message: 'Reconnect to authenticate first.' });
      return;
    }

    if (msg.type === 'claim_mission' || msg.type === 'claim_all_missions') {
      if (this.bannedPlayers.has(player.id)) {
        this.send(ws, { type: 'action:error', message: 'Your account has been suspended by an administrator.' });
        return;
      }
      void (async () => {
        const dateStr = this.getMissionDateStr();
        const prog = await supabaseStore.getPlayerMissionProgress(player.id, dateStr);
        const activeMissions = this.dailyMissions.filter((m) => m.isActive);

        if (msg.type === 'claim_mission') {
          const mission = activeMissions.find((m) => m.id === msg.missionId);
          if (!mission) {
            this.send(ws, { type: 'action:error', message: 'Mission not found.' });
            return;
          }
          if (prog.claimedIds.includes(mission.id)) {
            this.send(ws, { type: 'action:error', message: 'Reward already claimed today.' });
            return;
          }
          const cur = Number(prog.progressMap[mission.id] || 0);
          if (cur < mission.targetCount) {
            this.send(ws, { type: 'action:error', message: `Progress ${cur}/${mission.targetCount} — complete mission first!` });
            return;
          }
          prog.claimedIds.push(mission.id);
          await supabaseStore.savePlayerMissionClaims(player.id, dateStr, prog);
          if (mission.rewardBirr > 0) {
            await this.creditDepositFromBot(player.id, player.name, mission.rewardBirr, false);
          }
          await this.pushMissionsToPlayer(player.id);
          this.send(ws, { type: 'action:ok', message: `Claimed +${mission.rewardBirr} Birr from "${mission.title}"!` });
          return;
        }

        if (msg.type === 'claim_all_missions') {
          if (activeMissions.length === 0) {
            this.send(ws, { type: 'action:error', message: 'No active daily missions.' });
            return;
          }
          if (prog.allBonusClaimed) {
            this.send(ws, { type: 'action:error', message: 'Grand completion bonus already claimed today.' });
            return;
          }
          const allDone = activeMissions.every((m) => Number(prog.progressMap[m.id] || 0) >= m.targetCount);
          if (!allDone) {
            this.send(ws, { type: 'action:error', message: 'Complete all active daily missions to unlock the grand bonus!' });
            return;
          }
          prog.allBonusClaimed = true;
          await supabaseStore.savePlayerMissionClaims(player.id, dateStr, prog);
          if (this.settings.missionCompletionBonus > 0) {
            await this.creditDepositFromBot(player.id, player.name, this.settings.missionCompletionBonus, false);
          }
          await this.pushMissionsToPlayer(player.id);
          this.send(ws, {
            type: 'action:ok',
            message: `Daily Grand Bonus unlocked: +${this.settings.missionCompletionBonus} Birr!`,
          });
        }
      })();
      return;
    }

    // --- Admin-only commands ---
    if (msg.type.startsWith('admin_')) {
      if (!session.isAdmin) {
        this.send(ws, { type: 'action:error', message: 'Admin access required.' });
        return;
      }

      if (msg.type === 'admin_toggle_ban') {
        const cleanTarget = String(msg.playerId || '').trim();
        if (!cleanTarget) return;
        const nextBanned = Boolean(msg.isBanned);
        if (nextBanned) this.bannedPlayers.add(cleanTarget);
        else this.bannedPlayers.delete(cleanTarget);
        void supabaseStore.togglePlayerBan(cleanTarget, nextBanned);
        const targetWallet = this.wallets.get(cleanTarget);
        if (targetWallet) {
          targetWallet.isBanned = nextBanned;
          for (const [clientWs, clientSession] of this.clients.entries()) {
            if (clientSession.player?.id === cleanTarget && clientWs.readyState === WebSocket.OPEN) {
              this.send(clientWs, { type: 'wallet:sync', wallet: { ...targetWallet } });
              if (nextBanned) {
                this.send(clientWs, { type: 'action:error', message: 'Your account has been suspended by an administrator.' });
              }
            }
          }
        }
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message: `${this.playerNames.get(cleanTarget) || cleanTarget} ${nextBanned ? 'banned' : 'unbanned'}.`,
        });
        return;
      }

      if (msg.type === 'admin_manage_admins') {
        const cleanIds = Array.from(
          new Set(
            (msg.adminIds || [])
              .map((s) => String(s).trim())
              .filter(Boolean)
              .map((s) => (s.startsWith('tg_') ? s : `tg_${s}`))
          )
        );
        const nonEnv = cleanIds.filter((id) => !ADMIN_TG_IDS.has(id));
        this.extraAdminIds = new Set(nonEnv);
        void supabaseStore.updateExtraAdminIds(nonEnv);
        for (const [clientWs, clientSession] of this.clients.entries()) {
          if (clientSession.player?.isTelegram && clientWs.readyState === WebSocket.OPEN) {
            const shouldBeAdmin = this.isAdminTelegramId(clientSession.player.id);
            if (clientSession.isAdmin !== shouldBeAdmin) {
              clientSession.isAdmin = shouldBeAdmin;
              this.sendAdminStatus(clientWs, shouldBeAdmin);
            }
          }
        }
        this.broadcastAdmins();
        this.send(ws, { type: 'action:ok', message: `Updated admin access list (${cleanIds.length} admin IDs).` });
        return;
      }

      if (msg.type === 'admin_topup_wallet') {
        const amt = Math.round(Number(msg.amount));
        if (!msg.playerId || !Number.isFinite(amt) || amt === 0) {
          this.send(ws, { type: 'action:error', message: 'Enter a valid Birr amount.' });
          return;
        }
        const w = this.ensureWallet(msg.playerId);
        w.depositedBalance = Math.max(0, w.depositedBalance + amt);
        if (amt > 0) {
          const prevTot = this.totalDepositedMap.get(msg.playerId) || 0;
          const nextTot = prevTot + amt;
          this.totalDepositedMap.set(msg.playerId, nextTot);
          w.totalDeposited = nextTot;
          w.rankTier = computeRankTier(nextTot, this.settings.rankThresholds);
        }
        this.syncPlayerWallet(msg.playerId);
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message: `Updated ${this.playerNames.get(msg.playerId) || msg.playerId} deposit (${amt > 0 ? `+${amt}` : amt} Birr).`,
        });
        return;
      }

      if (msg.type === 'admin_update_settings') {
        const comm = Number(msg.commissionPercent);
        const intervalSec = Number(msg.callIntervalSeconds);
        const maxCart = Number(msg.maxCartelas);
        if (Number.isFinite(comm)) {
          this.settings.commissionPercent = Math.min(80, Math.max(0, Math.round(comm)));
        }
        if (Number.isFinite(intervalSec)) {
          this.settings.callIntervalSeconds = Math.min(60, Math.max(1.5, Number(intervalSec.toFixed(1))));
        }
        if (Number.isFinite(maxCart)) {
          this.settings.maxCartelas = Math.min(MAX_CARTELAS_LIMIT, Math.max(MIN_CARTELAS, Math.round(maxCart)));
        }
        if (msg.seasonTheme) {
          this.settings.seasonTheme = msg.seasonTheme;
        }
        void supabaseStore.updateHouseSettings(
          this.settings.commissionPercent,
          this.settings.callIntervalSeconds,
          this.settings.maxCartelas,
          this.settings.seasonTheme
        );
        for (const room of this.rooms.values()) {
          room.applyAdminTakenCartelas();
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        this.broadcastLobby();
        this.send(ws, {
          type: 'action:ok',
          message: `Settings saved: ${this.settings.commissionPercent}% commission · ${this.settings.callIntervalSeconds}s speed · ${this.settings.maxCartelas} cartelas`,
        });
        return;
      }

      if (msg.type === 'admin_set_online_count') {
        if (msg.count === null) {
          this.settings.onlineCountOverride = null;
        } else {
          const val = Math.max(0, Math.min(999999, Math.round(Number(msg.count))));
          if (!Number.isFinite(val)) {
            this.send(ws, { type: 'action:error', message: 'Enter a valid online number.' });
            return;
          }
          this.settings.onlineCountOverride = val;
        }
        this.broadcastPresence();
        this.broadcastLobby();
        for (const room of this.rooms.values()) {
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        this.send(ws, {
          type: 'action:ok',
          message:
            this.settings.onlineCountOverride === null
              ? 'Online counter reset to live player count.'
              : `Online counter set to ${this.settings.onlineCountOverride}.`,
        });
        return;
      }

      if (msg.type === 'admin_set_room_players_count') {
        const targetRoom = this.rooms.get(msg.stakeBirr);
        if (!targetRoom) {
          this.send(ws, { type: 'action:error', message: 'Target room not found.' });
          return;
        }
        const maxCap = this.settings.maxCartelas || TOTAL_CARTELAS;
        if (msg.count === null) {
          targetRoom.displayedPlayersOverride = null;
          targetRoom.adminTakeCount = 0;
        } else {
          const val = Math.max(0, Math.min(999999, Math.round(Number(msg.count))));
          if (!Number.isFinite(val)) {
            this.send(ws, { type: 'action:error', message: 'Enter a valid players number.' });
            return;
          }
          targetRoom.displayedPlayersOverride = val;
          targetRoom.adminTakeCount = Math.min(maxCap, val);
        }
        if (targetRoom.phase === 'OPENING') {
          targetRoom.applyAdminTakenCartelas();
          this.broadcastRoom(targetRoom.stakeBirr, {
            type: 'entries:updated',
            stakeBirr: targetRoom.stakeBirr,
            entries: targetRoom.entries,
            uniquePlayersCount: targetRoom.getUniquePlayersCount(),
            prizePool: targetRoom.getPrizePool(),
          });
        }
        this.broadcastLobby();
        this.broadcastRoom(targetRoom.stakeBirr, { type: 'state:sync', state: targetRoom.getPublicState() });
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message:
            targetRoom.displayedPlayersOverride === null
              ? `${targetRoom.stakeBirr} Birr players count & auto-taken cartelas reset to live.`
              : `${targetRoom.stakeBirr} Birr players set to ${targetRoom.displayedPlayersOverride} (taking ${targetRoom.adminTakeCount} random cartelas, Pool: ${targetRoom.getPrizePool()} Birr).`,
        });
        return;
      }

      if (msg.type === 'admin_set_take_cartelas') {
        const targetRoom = this.rooms.get(msg.stakeBirr);
        if (!targetRoom) {
          this.send(ws, { type: 'action:error', message: 'Target room not found.' });
          return;
        }
        const maxCap = this.settings.maxCartelas || TOTAL_CARTELAS;
        const val = Math.round(Number(msg.count));
        if (!Number.isFinite(val) || val < 0 || val > maxCap) {
          this.send(ws, { type: 'action:error', message: `Enter a number between 0 and ${maxCap}.` });
          return;
        }
        targetRoom.adminTakeCount = val;
        if (targetRoom.phase === 'OPENING') {
          targetRoom.applyAdminTakenCartelas();
          this.broadcastRoom(targetRoom.stakeBirr, {
            type: 'entries:updated',
            stakeBirr: targetRoom.stakeBirr,
            entries: targetRoom.entries,
            uniquePlayersCount: targetRoom.getUniquePlayersCount(),
            prizePool: targetRoom.getPrizePool(),
          });
        }
        this.broadcastLobby();
        this.broadcastRoom(targetRoom.stakeBirr, { type: 'state:sync', state: targetRoom.getPublicState() });
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message:
            val === 0
              ? `Auto-take cartelas disabled for ${targetRoom.stakeBirr} Birr room.`
              : `${targetRoom.stakeBirr} Birr room will take ${val} random cartela(s) per round.`,
        });
        return;
      }

      if (msg.type === 'admin_reset_rounds') {
        const nextRoundNum = Math.max(1, Math.min(999999, Math.round(Number(msg.roundNumber ?? 1))));
        const nextGamesPlayed = Math.max(0, Math.min(999999, Math.round(Number(msg.gamesPlayed ?? 0))));
        if (!Number.isFinite(nextRoundNum) || !Number.isFinite(nextGamesPlayed)) {
          this.send(ws, { type: 'action:error', message: 'Enter valid round numbers.' });
          return;
        }
        const targets =
          msg.stakeBirr === 'all'
            ? Array.from(this.rooms.values())
            : this.rooms.has(msg.stakeBirr)
              ? [this.rooms.get(msg.stakeBirr)!]
              : [];
        if (targets.length === 0) {
          this.send(ws, { type: 'action:error', message: 'Target room not found.' });
          return;
        }
        for (const r of targets) {
          r.roundNumber = nextRoundNum;
          r.gamesPlayed = nextGamesPlayed;
          this.broadcastRoom(r.stakeBirr, { type: 'state:sync', state: r.getPublicState() });
        }
        this.broadcastLobby();
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message:
            msg.stakeBirr === 'all'
              ? `All rooms updated to Round #${nextRoundNum} (${nextGamesPlayed} played).`
              : `${msg.stakeBirr} Birr room updated to Round #${nextRoundNum} (${nextGamesPlayed} played).`,
        });
        return;
      }

      if (msg.type === 'admin_set_winners') {
        const maxCap = this.settings.maxCartelas || TOTAL_CARTELAS;
        if (msg.recentWinners === null) {
          this.customRecentWinners = null;
        } else if (Array.isArray(msg.recentWinners)) {
          const now = Date.now();
          this.customRecentWinners = msg.recentWinners.slice(0, 30).map((w, idx) => {
            const cartelaNum = Math.max(1, Math.min(maxCap, Math.round(Number(w.cartelaNumber) || 1)));
            const prize = Math.max(0, Math.round((Number(w.prizeAmount) || 0) * 100) / 100);
            const stake = Math.max(1, Math.round(Number(w.stakeBirr) || 10));
            const rNum = Math.max(1, Math.round(Number(w.roundNumber) || 1));
            const pName = String(w.playerName || `Player ${idx + 1}`).trim().slice(0, 48) || `Player ${idx + 1}`;
            return {
              playerId: String(w.playerId || `custom_${now}_${idx}`).slice(0, 64),
              playerName: pName,
              playerRank: w.playerRank,
              cartelaNumber: cartelaNum,
              isCustom: Boolean(w.isCustom),
              patternName: String(w.patternName || 'Line / Bingo').trim().slice(0, 40) || 'Line / Bingo',
              winningCells: Array.isArray(w.winningCells) ? w.winningCells : [],
              winningNumber: w.winningNumber ?? null,
              prizeAmount: prize,
              stakeBirr: stake,
              grid: Array.isArray(w.grid) && w.grid.length === 5 ? w.grid : generateCartelaGrid(cartelaNum),
              callsCount: Math.max(4, Math.round(Number(w.callsCount) || 18)),
              roundNumber: rNum,
              wonAt: Number(w.wonAt) || now - idx * 60_000,
            };
          });
        }

        if (msg.leaderboard === null) {
          this.customLeaderboard = null;
        } else if (Array.isArray(msg.leaderboard)) {
          const now = Date.now();
          this.customLeaderboard = msg.leaderboard.slice(0, 10).map((entry, idx) => {
            const pName = String(entry.playerName || `Player ${idx + 1}`).trim().slice(0, 48) || `Player ${idx + 1}`;
            return {
              playerId: String(entry.playerId || `custom_lb_${now}_${idx}`).slice(0, 64),
              playerName: pName,
              playerRank: entry.playerRank,
              wins: Math.max(0, Math.round(Number(entry.wins) || 0)),
              totalBirrWon: Math.max(0, Math.round((Number(entry.totalBirrWon) || 0) * 100) / 100),
              lastWonAt: Number(entry.lastWonAt) || now - idx * 60_000,
            };
          });
        }
        this.cachedLeaderboard = null;

        void supabaseStore.updateCustomWinnersAndLeaderboard(
          this.customRecentWinners,
          this.customLeaderboard
        );
        for (const room of this.rooms.values()) {
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        this.broadcastAdmins();
        this.send(ws, {
          type: 'action:ok',
          message:
            this.customRecentWinners === null && this.customLeaderboard === null
              ? 'Winners & Top 10 Leaderboard reset to live game history.'
              : 'Updated Winners & Top 10 Leaderboard saved.',
        });
        return;
      }

      if (msg.type === 'admin_add_stake') {
        const val = Math.round(Number(msg.stakeBirr));
        if (!Number.isFinite(val) || val < 1 || val > 10000) {
          this.send(ws, { type: 'action:error', message: 'Enter a stake amount between 1 and 10,000 Birr.' });
          return;
        }
        if (this.settings.stakes.includes(val)) {
          this.send(ws, { type: 'action:error', message: `${val} Birr room already exists.` });
          return;
        }
        this.temporaryEventStakes.delete(val);
        this.settings.stakes = [...this.settings.stakes, val].sort((a, b) => a - b);
        if (!this.rooms.has(val)) {
          this.rooms.set(val, new BingoRoom(val, this));
        }
        this.broadcastLobby();
        for (const room of this.rooms.values()) {
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        this.broadcastAdmins();
        this.send(ws, { type: 'action:ok', message: `Added ${val} Birr game room.` });
        return;
      }

      if (msg.type === 'admin_remove_stake') {
        const val = Number(msg.stakeBirr);
        if (this.settings.stakes.length <= 1) {
          this.send(ws, { type: 'action:error', message: 'At least one stake room must remain active.' });
          return;
        }
        const closingRoom = this.rooms.get(val);
        if (!closingRoom) return;
        for (const e of closingRoom.entries) {
          if (!e.isHouseReserved && (e.paidFromDeposit > 0 || e.paidFromWon > 0)) {
            this.refundEntry(e.playerId, e.paidFromDeposit, e.paidFromWon);
          }
        }
        this.settings.stakes = this.settings.stakes.filter((s) => s !== val);
        this.rooms.delete(val);
        for (const [clientWs, clientSession] of this.clients.entries()) {
          if (clientSession.stakeBirr === val) {
            clientSession.stakeBirr = null;
            this.send(clientWs, { type: 'action:error', message: `${val} Birr room was closed.` });
          }
        }
        this.broadcastLobby();
        for (const room of this.rooms.values()) {
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        this.broadcastAdmins();
        this.send(ws, { type: 'action:ok', message: `Removed ${val} Birr room.` });
        return;
      }

      if (
        msg.type === 'admin_pause' ||
        msg.type === 'admin_stop_round' ||
        msg.type === 'admin_end_round' ||
        msg.type === 'admin_queue_numbers' ||
        msg.type === 'admin_call_now'
      ) {
        const targetRoom = this.rooms.get(msg.stakeBirr);
        if (!targetRoom) {
          this.send(ws, { type: 'action:error', message: 'Target room not found.' });
          return;
        }

        if (msg.type === 'admin_pause') {
          targetRoom.setPaused(Boolean(msg.paused));
          this.send(ws, {
            type: 'action:ok',
            message: `${targetRoom.stakeBirr} Birr room ${msg.paused ? 'paused' : 'resumed'}.`,
          });
          return;
        }

        if (msg.type === 'admin_stop_round') {
          targetRoom.stopAndResetRound();
          this.send(ws, {
            type: 'action:ok',
            message: `Stopped & reset ${targetRoom.stakeBirr} Birr round to 30s countdown.`,
          });
          return;
        }

        if (msg.type === 'admin_end_round') {
          targetRoom.forceEndRound();
          this.send(ws, {
            type: 'action:ok',
            message: `Ended ${targetRoom.stakeBirr} Birr round.`,
          });
          return;
        }

        if (msg.type === 'admin_queue_numbers') {
          targetRoom.setQueuedNumbers(msg.numbers);
          this.send(ws, {
            type: 'action:ok',
            message: `Queued ${targetRoom.queuedNumbers.length} upcoming number(s) for ${targetRoom.stakeBirr} Birr room.`,
          });
          return;
        }

        if (msg.type === 'admin_call_now') {
          if (targetRoom.phase !== 'CALLING') {
            this.send(ws, { type: 'action:error', message: 'Can only call numbers during CALLING phase.' });
            return;
          }
          const drawn = targetRoom.drawSpecificOrNext(msg.number);
          if (drawn === null) {
            this.send(ws, { type: 'action:error', message: 'No eligible numbers left to call.' });
          } else {
            this.send(ws, {
              type: 'action:ok',
              message: `Called ${getBallLetter(drawn)}-${drawn}`,
            });
          }
          return;
        }
      }
      return;
    }

    // --- Player Actions (require an active room) ---
    if (this.bannedPlayers.has(player.id)) {
      this.send(ws, { type: 'action:error', message: 'Your account has been suspended by an administrator.' });
      return;
    }
    if (session.stakeBirr === null) {
      this.send(ws, { type: 'action:error', message: 'Choose a stake amount first.' });
      return;
    }
    const room = this.rooms.get(session.stakeBirr);
    if (!room) return;

    if (msg.type === 'set_auto_claim') {
      session.autoClaim = Boolean(msg.autoClaim);
      for (const e of room.entries) {
        if (e.playerId === player.id) {
          e.autoClaim = session.autoClaim;
        }
      }
      this.broadcastRoom(room.stakeBirr, {
        type: 'entries:updated',
        stakeBirr: room.stakeBirr,
        entries: room.entries,
        uniquePlayersCount: room.getUniquePlayersCount(),
        prizePool: room.getPrizePool(),
      });
      return;
    }

    if (msg.type === 'select_cartela') {
      if (room.phase !== 'OPENING') {
        this.send(ws, { type: 'action:error', message: 'Selection is locked! Wait for the next 30s round.' });
        return;
      }
      const maxCap = this.settings.maxCartelas || TOTAL_CARTELAS;
      const num = msg.cartelaNumber;
      if (!Number.isInteger(num) || num < 1 || num > maxCap) {
        this.send(ws, { type: 'action:error', message: `Invalid cartela number (1–${maxCap}).` });
        return;
      }
      const alreadyTaken = room.entries.find((e) => !e.isCustom && e.cartelaNumber === num);
      if (alreadyTaken) {
        this.send(ws, { type: 'action:error', message: `Cartela #${num} is already taken by ${alreadyTaken.playerName}.` });
        return;
      }

      let charge = this.chargeEntry(player.id, room.stakeBirr);
      if (!charge.ok) {
        if (session.isAdmin) {
          charge = { ok: true, fromDeposit: 0, fromWon: 0 };
        } else {
          this.send(ws, { type: 'action:error', message: `Insufficient balance (${room.stakeBirr} Birr needed).` });
          return;
        }
      }

      room.entries.push({
        entryId: `${room.stakeBirr}_${room.roundNumber}_${num}_${crypto.randomUUID().slice(0, 8)}`,
        cartelaNumber: num,
        isCustom: false,
        grid: generateCartelaGrid(num),
        playerId: player.id,
        playerName: player.name,
        playerRank: this.getPlayerRankTier(player.id),
        paidFromDeposit: charge.fromDeposit,
        paidFromWon: charge.fromWon,
        autoClaim: session.autoClaim,
        selectedAt: Date.now(),
      });
      this.broadcastRoom(room.stakeBirr, {
        type: 'entries:updated',
        stakeBirr: room.stakeBirr,
        entries: room.entries,
        uniquePlayersCount: room.getUniquePlayersCount(),
        prizePool: room.getPrizePool(),
      });
      this.broadcastLobby();
      this.broadcastAdmins();
      this.send(
        ws,
        {
          type: 'action:ok',
          message:
            charge.fromDeposit + charge.fromWon > 0
              ? `Locked Cartela #${num} (-${room.stakeBirr} Birr)`
              : `Locked Cartela #${num}`,
        }
      );
      return;
    }

    if (msg.type === 'select_custom_cartela') {
      if (room.phase !== 'OPENING') {
        this.send(ws, { type: 'action:error', message: 'Selection is locked! Wait for the next 30s round.' });
        return;
      }
      const check = validateCustomGrid(msg.grid);
      if (!check.valid) {
        this.send(ws, { type: 'action:error', message: check.reason || 'Invalid custom cartela.' });
        return;
      }

      let charge = this.chargeEntry(player.id, room.stakeBirr);
      if (!charge.ok) {
        if (session.isAdmin) {
          charge = { ok: true, fromDeposit: 0, fromWon: 0 };
        } else {
          this.send(ws, { type: 'action:error', message: `Insufficient balance (${room.stakeBirr} Birr needed).` });
          return;
        }
      }

      room.entries.push({
        entryId: `${room.stakeBirr}_${room.roundNumber}_custom_${crypto.randomUUID().slice(0, 8)}`,
        cartelaNumber: 0,
        isCustom: true,
        grid: msg.grid,
        playerId: player.id,
        playerName: player.name,
        playerRank: this.getPlayerRankTier(player.id),
        paidFromDeposit: charge.fromDeposit,
        paidFromWon: charge.fromWon,
        autoClaim: session.autoClaim,
        selectedAt: Date.now(),
      });
      this.broadcastRoom(room.stakeBirr, {
        type: 'entries:updated',
        stakeBirr: room.stakeBirr,
        entries: room.entries,
        uniquePlayersCount: room.getUniquePlayersCount(),
        prizePool: room.getPrizePool(),
      });
      this.broadcastLobby();
      this.broadcastAdmins();
      this.send(ws, { type: 'action:ok', message: `Custom Cartela added` });
      return;
    }

    if (msg.type === 'release_cartela') {
      if (room.phase !== 'OPENING') {
        this.send(ws, { type: 'action:error', message: 'Cartelas are locked during number calling.' });
        return;
      }
      const idx = room.entries.findIndex((e) => e.entryId === msg.entryId && e.playerId === player.id);
      if (idx === -1) {
        this.send(ws, { type: 'action:error', message: 'Cartela not found.' });
        return;
      }
      const [removed] = room.entries.splice(idx, 1);
      this.refundEntry(player.id, removed.paidFromDeposit, removed.paidFromWon);
      this.broadcastRoom(room.stakeBirr, {
        type: 'entries:updated',
        stakeBirr: room.stakeBirr,
        entries: room.entries,
        uniquePlayersCount: room.getUniquePlayersCount(),
        prizePool: room.getPrizePool(),
      });
      this.broadcastLobby();
      this.broadcastAdmins();
      return;
    }

    if (msg.type === 'claim_bingo') {
      if (room.phase !== 'CALLING') {
        this.send(ws, { type: 'action:error', message: 'Claims are only active during number calling.' });
        return;
      }
      const entry = room.entries.find((e) => e.entryId === msg.entryId && e.playerId === player.id);
      if (!entry) {
        this.send(ws, { type: 'action:error', message: 'You do not have that cartela in this round.' });
        return;
      }
      const result = checkWinningPattern(entry.grid, room.calledNumbers);
      if (!result.won) {
        this.send(ws, {
          type: 'action:error',
          message: 'No winning line yet! Complete a Row, Column, Diagonal, or 4 Corners.',
        });
        return;
      }

      const allWinning: Array<{
        entry: CartelaEntry;
        patternName: string;
        winningCells: [number, number][];
        winningNumber: number | null;
      }> = [
        {
          entry,
          patternName: result.patternName,
          winningCells: result.winningCells,
          winningNumber: result.winningNumber,
        },
      ];
      for (const other of room.entries) {
        if (other.entryId === entry.entryId || other.isHouseReserved || !other.autoClaim) continue;
        const otherRes = checkWinningPattern(other.grid, room.calledNumbers);
        if (otherRes.won) {
          allWinning.push({
            entry: other,
            patternName: otherRes.patternName,
            winningCells: otherRes.winningCells,
            winningNumber: otherRes.winningNumber,
          });
        }
      }

      const splitPrize = Math.max(0, Math.round(room.getPrizePool() / allWinning.length));
      const now = Date.now();
      room.endRound(
        allWinning.map((m) => ({
          playerId: m.entry.playerId,
          playerName: m.entry.playerName,
          playerRank: m.entry.playerRank || this.getPlayerRankTier(m.entry.playerId),
          cartelaNumber: m.entry.cartelaNumber,
          isCustom: m.entry.isCustom,
          patternName: m.patternName,
          winningCells: m.winningCells,
          winningNumber: m.winningNumber,
          prizeAmount: splitPrize,
          stakeBirr: room.stakeBirr,
          grid: m.entry.grid,
          callsCount: room.calledNumbers.length,
          roundNumber: room.roundNumber,
          wonAt: now,
        }))
      );
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public async handleExternalAdminRpc(fnName: string, params: Record<string, any>) {
    const res = await supabaseStore.executeAdminRpc(fnName, params, {
      expectedPin: EFFECTIVE_ADMIN_PIN,
      getLivePlayers: () => {
        const now = new Date().toISOString();
        const ids = new Set<string>([
          ...this.wallets.keys(),
          ...this.playerNames.keys(),
        ]);
        const list: Array<{
          id: string;
          name: string;
          username: string | null;
          language: AppLanguage;
          deposited_birr: number;
          won_birr: number;
          total_deposited_birr: number;
          is_banned: boolean;
          updated_at: string;
        }> = [];
        for (const id of ids) {
          const w = this.wallets.get(id) || {
            depositedBalance: INITIAL_DEPOSIT_BIRR,
            wonBalance: 0,
          };
          list.push({
            id,
            name: this.playerNames.get(id) || id,
            username: this.playerUsernames.get(id) || null,
            language: this.playerLanguages.get(id) || 'en',
            deposited_birr: Number(w.depositedBalance || 0),
            won_birr: Number(w.wonBalance || 0),
            total_deposited_birr: Number(this.totalDepositedMap.get(id) ?? w.totalDeposited ?? 0),
            is_banned: this.bannedPlayers.has(id),
            updated_at: now,
          });
        }
        return list;
      },
      onSyncFromMem: (next) => {
        this.applyLiveConfig(next.config);
        this.specialEvents = next.specialEvents;
        this.dailyMissions = next.dailyMissions;
        this.broadcastLobby();
        for (const room of this.rooms.values()) {
          this.broadcastRoom(room.stakeBirr, { type: 'state:sync', state: room.getPublicState() });
        }
        for (const [ws, sess] of this.clients.entries()) {
          if (sess.player) {
            void this.pushMissionsToPlayer(sess.player.id);
          }
          if (sess.player?.isTelegram && ws.readyState === WebSocket.OPEN) {
            const shouldBeAdmin = this.isAdminTelegramId(sess.player.id);
            if (sess.isAdmin !== shouldBeAdmin) {
              sess.isAdmin = shouldBeAdmin;
              this.sendAdminStatus(ws, shouldBeAdmin);
            }
          }
        }
        this.broadcastAdmins();
      },
      onAdjustPlayerBalance: (playerId, depDelta, wonDelta) => {
        const w = this.ensureWallet(playerId);
        w.depositedBalance = Math.max(0, w.depositedBalance + depDelta);
        w.wonBalance = Math.max(0, w.wonBalance + wonDelta);
        if (depDelta > 0) {
          const prevTot = this.totalDepositedMap.get(playerId) || 0;
          const nextTot = prevTot + depDelta;
          this.totalDepositedMap.set(playerId, nextTot);
          w.totalDeposited = nextTot;
          w.rankTier = computeRankTier(nextTot, this.settings.rankThresholds);
        }
        this.syncPlayerWallet(playerId);
        this.broadcastAdmins();
      },
      onTogglePlayerBan: (playerId, isBanned) => {
        if (isBanned) this.bannedPlayers.add(playerId);
        else this.bannedPlayers.delete(playerId);
        const targetWallet = this.wallets.get(playerId);
        if (targetWallet) {
          targetWallet.isBanned = isBanned;
          for (const [clientWs, clientSession] of this.clients.entries()) {
            if (clientSession.player?.id === playerId && clientWs.readyState === WebSocket.OPEN) {
              this.send(clientWs, { type: 'wallet:sync', wallet: { ...targetWallet } });
              if (isBanned) {
                this.send(clientWs, {
                  type: 'action:error',
                  message: 'Your account has been suspended by an administrator.',
                });
              }
            }
          }
        }
        this.broadcastAdmins();
      },
      onClearScope: (scope) => {
        if (scope === 'rounds' || scope === 'all') {
          this.recentWinners = [];
          this.leaderboardMap.clear();
          this.cachedLeaderboard = null;
          this.broadcastLobby();
        }
        if (scope === 'players' || scope === 'all') {
          this.wallets.clear();
          this.totalDepositedMap.clear();
          this.bannedPlayers.clear();
        }
        this.broadcastAdmins();
      },
    });
    return res;
  }

  public stop() {
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.lobbyTicker) clearInterval(this.lobbyTicker);
    if (this.dbSyncTimer) clearInterval(this.dbSyncTimer);
  }
}

const hub = new BingoHub();

function resolveMiniAppUrl(fallbackUrl: string): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const chosen = envUrl && envUrl !== 'MY_APP_URL' ? envUrl : fallbackUrl;
  if (chosen.includes('ais-dev-')) {
    return chosen.replace('ais-dev-', 'ais-pre-');
  }
  return chosen;
}

const botHandler = new TelegramBotHandler(
  BOT_TOKEN,
  {
    getWalletSnapshot: (playerId, name, username) => hub.ensureWallet(playerId, name, username),
    hasPlayer: (playerId) => hub.hasPlayer(playerId),
    getPlayerName: (playerId) => hub.getPlayerName(playerId),
    getAllPlayerIds: () => hub.getAllPlayerIds(),
    creditDepositFromBot: (playerId, name, amount, isRealDeposit) =>
      hub.creditDepositFromBot(playerId, name, amount, isRealDeposit),
    deductWithdrawFromBot: (playerId, name, amount) => hub.deductWithdrawFromBot(playerId, name, amount),
    setPlayerLanguage: (playerId, language) => hub.setPlayerLanguage(playerId, language),
    getPlayerLanguage: (playerId) => hub.getPlayerLanguage(playerId),
    isTelegramAdminId: (tgId) => hub.isAdminTelegramId(tgId),
    isPlayerBanned: (playerId) => hub.bannedPlayers.has(playerId),
    recordInviteMission: (referrerFullId) => {
      void hub.recordInviteMission(referrerFullId);
    },
  },
  resolveMiniAppUrl
);

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  return botHandler.callApi(method, body);
}

let pollingOffset = 0;
let pollingActive = false;

function shouldUsePolling(): boolean {
  if (!BOT_TOKEN) return false;
  if (USE_POLLING) return true;
  const envUrl = (process.env.APP_URL || '').trim();
  if (!envUrl || envUrl === 'MY_APP_URL' || envUrl.includes('ais-dev-') || envUrl.includes('localhost')) {
    return true;
  }
  return false;
}

async function startTelegramPolling() {
  if (!shouldUsePolling() || pollingActive) return;
  pollingActive = true;
  const appUrl = getAppUrl();

  await callTelegramApi('deleteWebhook', { drop_pending_updates: false });
  console.log('[Telegram Bot] Long-polling active (outbound getUpdates)...');

  const poll = async () => {
    try {
      const allowed = encodeURIComponent(JSON.stringify(['message', 'callback_query']));
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${pollingOffset}&timeout=20&allowed_updates=${allowed}`
      );
      const data = (await res.json()) as {
        ok: boolean;
        description?: string;
        result?: Array<Record<string, any>>;
      };
      if (!data.ok) {
        console.error('[Telegram Polling Error]:', data.description || data);
      } else if (Array.isArray(data.result)) {
        for (const upd of data.result) {
          pollingOffset = Math.max(pollingOffset, Number(upd.update_id) + 1);
          await botHandler.handleUpdate(upd, appUrl);
        }
      }
    } catch {
      // Retry smoothly
    }
    setTimeout(poll, 800);
  };
  poll();
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const lobby = hub.getLobbySnapshot();
    res.json({
      ok: true,
      onlineCount: lobby.onlineCount,
      rooms: lobby.rooms.map((r) => ({
        stakeBirr: r.stakeBirr,
        roundNumber: r.roundNumber,
        phase: r.phase,
        isPaused: r.isPaused,
      })),
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  app.get('/api/state', (req, res) => {
    const stake = Number(req.query.stake);
    if (stake && hub.rooms.has(stake)) {
      res.json(hub.rooms.get(stake)!.getPublicState());
      return;
    }
    res.json(hub.getLobbySnapshot());
  });

  app.post('/api/admin/rpc', async (req, res) => {
    const { fn, params } = (req.body || {}) as { fn?: string; params?: Record<string, any> };
    if (!fn || typeof fn !== 'string') {
      res.status(400).json({ error: 'Missing RPC function name.' });
      return;
    }
    const result = await hub.handleExternalAdminRpc(fn, params || {});
    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    res.json({ data: result.data ?? null });
  });

  app.post('/api/auth/telegram', (req, res) => {
    const { initData } = req.body as { initData?: string };
    if (!BOT_TOKEN) {
      res.status(200).json({ verified: false, reason: 'No TELEGRAM_BOT_TOKEN set; using client profile.' });
      return;
    }
    const player = verifyTelegramInitData(initData || '', BOT_TOKEN);
    if (!player) {
      res.status(401).json({ verified: false, reason: 'Invalid Telegram initData signature.' });
      return;
    }
    res.json({ verified: true, player });
  });

  app.get('/api/telegram/status', async (_req, res) => {
    if (!BOT_TOKEN) {
      res.json({ botConfigured: false, pollingActive: false });
      return;
    }
    const info = await callTelegramApi('getWebhookInfo', {});
    res.json({
      botConfigured: true,
      pollingActive,
      appUrl: resolveMiniAppUrl(getAppUrl()),
      webhookInfo: info?.result || null,
    });
  });

  app.post('/api/telegram/webhook', async (req, res) => {
    res.sendStatus(200);
    if (!BOT_TOKEN) return;
    try {
      await botHandler.handleUpdate(req.body, getAppUrl(req));
    } catch {
      // Ignore webhook error
    }
  });

  app.post('/api/telegram/register-webhook', async (req, res) => {
    if (!BOT_TOKEN) {
      res.status(400).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server.' });
      return;
    }
    const baseUrl = resolveMiniAppUrl(getAppUrl(req));
    if (baseUrl.includes('ais-dev-')) {
      res.status(400).json({
        ok: false,
        error: 'AI Studio dev URL requires login cookies, so polling is used here instead. Deploy to Render/Koyeb (or use your public APP_URL) for webhooks.',
      });
      return;
    }
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const result = await callTelegramApi('setWebhook', { url: webhookUrl });
    res.json({ ok: true, webhookUrl, telegramResponse: result });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    hub.addClient(ws);
    ws.on('message', (data) => {
      hub.handleMessage(ws, data.toString());
    });
    ws.on('close', () => {
      hub.removeClient(ws);
    });
    ws.on('error', () => {
      hub.removeClient(ws);
    });
  });

  const adminDist = path.resolve(__dirname, 'admin-dashboard', 'dist');
  if (fs.existsSync(adminDist)) {
    app.get('/admin', (req, res, next) => {
      if (!req.path.endsWith('/')) {
        res.redirect(301, req.originalUrl.replace(/^\/admin(?=\?|$)/, '/admin/'));
        return;
      }
      next();
    });
    app.use('/admin', express.static(adminDist, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }));
    app.get('/admin/*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Cartela 24/7 Multi-Room Server running on http://0.0.0.0:${PORT}`);
    startTelegramPolling();
    if (BOT_TOKEN) {
      setInterval(() => {
        void botHandler.processPendingBroadcasts();
      }, 3000);
    }
  });
}

startServer();
