import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Flag,
  Plus,
  Trash2,
  Zap,
  Sliders,
  ShieldCheck,
  Wallet,
  Users,
  Server,
  Trophy,
  ArrowUp,
  ArrowDown,
  Save,
} from 'lucide-react';
import {
  BINGO_LETTERS,
  HouseSettings,
  LeaderboardEntry,
  MAX_CARTELAS_LIMIT,
  MIN_CARTELAS,
  PlayerWallet,
  RoomSummary,
  RoundWinner,
  SeasonThemeId,
  TOTAL_CARTELAS,
  generateCartelaGrid,
  getBallLetter,
  getColumnRange,
} from '../../shared/bingo';
import { RankBadge } from './RankBadge';

interface WalletRecord {
  playerId: string;
  name: string;
  wallet: PlayerWallet;
  isBanned?: boolean;
}

interface AdminModalProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  rooms: RoomSummary[];
  activeStake: number | null;
  calledNumbersByActiveRoom: number[];
  queuedByRoom: Record<number, number[]>;
  wallets: WalletRecord[];
  adminIds: string[];
  recentWinners: RoundWinner[];
  leaderboard: LeaderboardEntry[];
  isCustomWinners: boolean;
  isCustomLeaderboard: boolean;
  settings: HouseSettings;
  liveOnlineCount: number;
  onUnlockAdmin: (pin: string) => void;
  onPauseRoom: (stakeBirr: number, paused: boolean) => void;
  onStopRound: (stakeBirr: number) => void;
  onEndRound: (stakeBirr: number) => void;
  onQueueNumbers: (stakeBirr: number, numbers: number[]) => void;
  onCallNow: (stakeBirr: number, num?: number) => void;
  onUpdateSettings: (
    commissionPercent: number,
    callIntervalSeconds: number,
    maxCartelas?: number,
    seasonTheme?: SeasonThemeId
  ) => void;
  onSetOnlineCount: (count: number | null) => void;
  onSetRoomPlayersCount: (stakeBirr: number, count: number | null) => void;
  onSetTakeCartelas: (stakeBirr: number, count: number) => void;
  onResetRounds: (stakeBirr: number | 'all', roundNumber?: number, gamesPlayed?: number) => void;
  onSetWinners: (recentWinners: RoundWinner[] | null, leaderboard: LeaderboardEntry[] | null) => void;
  onAddStake: (stakeBirr: number) => void;
  onRemoveStake: (stakeBirr: number) => void;
  onTopupWallet: (playerId: string, amount: number) => void;
  onToggleBan: (playerId: string, isBanned: boolean) => void;
  onManageAdmins: (adminIds: string[]) => void;
  onOpenHostGuide: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  open,
  onClose,
  isAdmin,
  rooms,
  activeStake,
  calledNumbersByActiveRoom,
  queuedByRoom,
  wallets,
  adminIds,
  recentWinners,
  leaderboard,
  isCustomWinners,
  isCustomLeaderboard,
  settings,
  liveOnlineCount,
  onUnlockAdmin,
  onPauseRoom,
  onStopRound,
  onEndRound,
  onQueueNumbers,
  onCallNow,
  onUpdateSettings,
  onSetOnlineCount,
  onSetRoomPlayersCount,
  onSetTakeCartelas,
  onResetRounds,
  onSetWinners,
  onAddStake,
  onRemoveStake,
  onTopupWallet,
  onToggleBan,
  onManageAdmins,
  onOpenHostGuide,
}) => {
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<'controls' | 'settings' | 'winners' | 'wallets'>('controls');
  const [selectedRoomStake, setSelectedRoomStake] = useState<number>(
    activeStake ?? rooms[0]?.stakeBirr ?? 10
  );
  const [commissionInput, setCommissionInput] = useState(String(settings.commissionPercent));
  const [intervalInput, setIntervalInput] = useState(String(settings.callIntervalSeconds));
  const [maxCartelasInput, setMaxCartelasInput] = useState(
    String(settings.maxCartelas || TOTAL_CARTELAS)
  );
  const [seasonThemeInput, setSeasonThemeInput] = useState<SeasonThemeId>(
    settings.seasonTheme || 'none'
  );
  const [onlineInput, setOnlineInput] = useState(
    settings.onlineCountOverride !== null ? String(settings.onlineCountOverride) : String(liveOnlineCount)
  );
  const [takeCartelasInput, setTakeCartelasInput] = useState('0');
  const [roundNumberInput, setRoundNumberInput] = useState('1');
  const [gamesPlayedInput, setGamesPlayedInput] = useState('0');
  const [roomPlayersInputs, setRoomPlayersInputs] = useState<Record<number, string>>({});
  const [newStakeInput, setNewStakeInput] = useState('');
  const [newAdminIdInput, setNewAdminIdInput] = useState('');
  const [callImmediateMode, setCallImmediateMode] = useState(false);
  const [topupAmount, setTopupAmount] = useState('100');

  // Winners & Top 10 draft editor state
  const [draftLeaderboard, setDraftLeaderboard] = useState<LeaderboardEntry[]>(leaderboard);
  const [draftWinners, setDraftWinners] = useState<RoundWinner[]>(recentWinners);
  const [newLbName, setNewLbName] = useState('');
  const [newLbWins, setNewLbWins] = useState('1');
  const [newLbBirr, setNewLbBirr] = useState('200');
  const [newWinName, setNewWinName] = useState('');
  const [newWinBirr, setNewWinBirr] = useState('200');
  const [newWinRound, setNewWinRound] = useState('1');
  const [newWinStake, setNewWinStake] = useState('20');
  const [newWinCartela, setNewWinCartela] = useState('7');

  const wasOpenRef = useRef(false);
  const lastRoomSyncRef = useRef<{
    stake: number | null;
    adminTakeCount: number;
    roundNumber: number;
    gamesPlayed: number;
  }>({ stake: null, adminTakeCount: -1, roundNumber: -1, gamesPlayed: -1 });
  const lastRoomPlayersOverrideRef = useRef<Record<number, number | null>>({});
  const lastSettingsSyncRef = useRef<{
    commissionPercent: number;
    callIntervalSeconds: number;
    maxCartelas: number;
    seasonTheme: SeasonThemeId;
    onlineCountOverride: number | null;
  } | null>(null);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    if (justOpened || !open) {
      setDraftLeaderboard(leaderboard);
    }
  }, [open, leaderboard]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    if (justOpened || !open) {
      setDraftWinners(recentWinners);
    }
  }, [open, recentWinners]);

  useEffect(() => {
    if (activeStake !== null) {
      setSelectedRoomStake(activeStake);
    } else if (rooms.length > 0 && !rooms.some((r) => r.stakeBirr === selectedRoomStake)) {
      setSelectedRoomStake(rooms[0].stakeBirr);
    }
  }, [activeStake, rooms, selectedRoomStake]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const target = rooms.find((r) => r.stakeBirr === selectedRoomStake) || rooms[0];
    if (target) {
      const prev = lastRoomSyncRef.current;
      const roomChanged = prev.stake !== target.stakeBirr;
      const takeVal = target.adminTakeCount ?? 0;
      const roundVal = target.roundNumber ?? 1;
      const gamesVal = target.gamesPlayed ?? 0;
      if (justOpened || roomChanged || prev.adminTakeCount !== takeVal) {
        setTakeCartelasInput(String(takeVal));
      }
      if (justOpened || roomChanged || prev.roundNumber !== roundVal) {
        setRoundNumberInput(String(roundVal));
      }
      if (justOpened || roomChanged || prev.gamesPlayed !== gamesVal) {
        setGamesPlayedInput(String(gamesVal));
      }
      lastRoomSyncRef.current = {
        stake: target.stakeBirr,
        adminTakeCount: takeVal,
        roundNumber: roundVal,
        gamesPlayed: gamesVal,
      };
    }
  }, [open, selectedRoomStake, rooms]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    setRoomPlayersInputs((prev) => {
      let changed = false;
      const next: Record<number, string> = { ...prev };
      for (const r of rooms) {
        const hadKey = Object.prototype.hasOwnProperty.call(prev, r.stakeBirr);
        const prevOverride = lastRoomPlayersOverrideRef.current[r.stakeBirr];
        const serverVal = r.displayedPlayersOverride !== null ? r.displayedPlayersOverride : null;
        if (justOpened || !hadKey || prevOverride !== serverVal) {
          next[r.stakeBirr] = String(
            r.displayedPlayersOverride !== null ? r.displayedPlayersOverride : r.displayedPlayersCount
          );
          lastRoomPlayersOverrideRef.current[r.stakeBirr] = serverVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [open, rooms]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const prev = lastSettingsSyncRef.current;
    const curMax = settings.maxCartelas || TOTAL_CARTELAS;
    const curTheme = settings.seasonTheme || 'none';
    if (justOpened || !prev || prev.commissionPercent !== settings.commissionPercent) {
      setCommissionInput(String(settings.commissionPercent));
    }
    if (justOpened || !prev || prev.callIntervalSeconds !== settings.callIntervalSeconds) {
      setIntervalInput(String(settings.callIntervalSeconds));
    }
    if (justOpened || !prev || prev.maxCartelas !== curMax) {
      setMaxCartelasInput(String(curMax));
    }
    if (justOpened || !prev || prev.seasonTheme !== curTheme) {
      setSeasonThemeInput(curTheme);
    }
    if (justOpened || !prev || prev.onlineCountOverride !== settings.onlineCountOverride) {
      setOnlineInput(
        settings.onlineCountOverride !== null ? String(settings.onlineCountOverride) : String(liveOnlineCount)
      );
    }
    lastSettingsSyncRef.current = {
      commissionPercent: settings.commissionPercent,
      callIntervalSeconds: settings.callIntervalSeconds,
      maxCartelas: curMax,
      seasonTheme: curTheme,
      onlineCountOverride: settings.onlineCountOverride,
    };
  }, [
    open,
    settings.commissionPercent,
    settings.callIntervalSeconds,
    settings.maxCartelas,
    settings.seasonTheme,
    settings.onlineCountOverride,
    liveOnlineCount,
  ]);

  useEffect(() => {
    wasOpenRef.current = open;
  }, [open]);

  if (!open) return null;

  const maxCartelaCap = Math.max(
    MIN_CARTELAS,
    Math.min(MAX_CARTELAS_LIMIT, Math.round(settings.maxCartelas || TOTAL_CARTELAS))
  );
  const targetRoom = rooms.find((r) => r.stakeBirr === selectedRoomStake) || rooms[0];
  const queued = targetRoom ? queuedByRoom[targetRoom.stakeBirr] || [] : [];
  const calledSet = new Set(
    targetRoom && activeStake === targetRoom.stakeBirr ? calledNumbersByActiveRoom : []
  );

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    onUnlockAdmin(pin.trim());
    setPin('');
  };

  const handleNumberTap = (num: number) => {
    if (!targetRoom) return;
    if (calledSet.has(num)) return;

    if (callImmediateMode && targetRoom.phase === 'CALLING') {
      onCallNow(targetRoom.stakeBirr, num);
      return;
    }

    if (queued.includes(num)) {
      onQueueNumbers(
        targetRoom.stakeBirr,
        queued.filter((n) => n !== num)
      );
    } else {
      onQueueNumbers(targetRoom.stakeBirr, [...queued, num]);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const clampedCartelas = Math.max(
      MIN_CARTELAS,
      Math.min(MAX_CARTELAS_LIMIT, Math.round(Number(maxCartelasInput) || TOTAL_CARTELAS))
    );
    onUpdateSettings(
      Number(commissionInput),
      Number(intervalInput),
      clampedCartelas,
      seasonThemeInput
    );
  };

  const handleSetOnlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(onlineInput);
    if (!Number.isFinite(num) || num < 0) return;
    onSetOnlineCount(Math.round(num));
  };

  const handleAddStakeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(newStakeInput);
    if (!Number.isFinite(amount) || amount < 1) return;
    onAddStake(Math.round(amount));
    setNewStakeInput('');
  };

  const handleAddAdminId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newAdminIdInput
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^-?\d{4,}$/.test(s));
    if (cleaned.length === 0) return;
    const merged = Array.from(new Set([...adminIds, ...cleaned]));
    onManageAdmins(merged);
    setNewAdminIdInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090216]/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto hall-scroll rounded-t-3xl sm:rounded-2xl bg-[#FFF5FA] dark:bg-[#15072E] border border-pink-200 dark:border-purple-500/35 text-purple-950 dark:text-purple-50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-white/95 dark:bg-[#15072E]/95 backdrop-blur-md border-b border-pink-200 dark:border-purple-500/30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pink-600 dark:text-amber-400" />
            <h2 id="admin-modal-title" className="font-display text-lg font-bold">
              Owner Admin Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin panel"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-purple-600 dark:text-purple-300 hover:bg-pink-100 dark:hover:bg-[#230B48] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAdmin ? (
          <form onSubmit={handlePinSubmit} className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-pink-600 dark:text-amber-400 font-semibold text-sm">
              <Lock className="w-4 h-4" />
              Owner Verification Required
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-200">
              Admin controls are hidden from regular players. Enter your <code className="font-mono font-bold">ADMIN_PIN</code> to unlock.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Admin PIN"
                autoFocus
                className="flex-1 h-12 px-4 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 text-sm focus:outline-none focus:border-pink-500"
              />
              <button
                type="submit"
                className="h-12 px-5 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white font-semibold text-sm hover:brightness-110 cursor-pointer whitespace-nowrap"
              >
                Unlock
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-5">
            {/* Sub-tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-pink-100/80 dark:bg-[#0D0320] rounded-xl border border-pink-200 dark:border-purple-500/30">
              <button
                type="button"
                onClick={() => setTab('controls')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'controls'
                    ? 'bg-white dark:bg-[#230B48] text-pink-600 dark:text-amber-300 shadow-xs'
                    : 'text-purple-700 dark:text-purple-300 hover:text-purple-950 dark:hover:text-white'
                }`}
              >
                Live Game
              </button>
              <button
                type="button"
                onClick={() => setTab('winners')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'winners'
                    ? 'bg-white dark:bg-[#230B48] text-pink-600 dark:text-amber-300 shadow-xs'
                    : 'text-purple-700 dark:text-purple-300 hover:text-purple-950 dark:hover:text-white'
                }`}
              >
                Winners & Top 10
              </button>
              <button
                type="button"
                onClick={() => setTab('settings')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'settings'
                    ? 'bg-white dark:bg-[#230B48] text-pink-600 dark:text-amber-300 shadow-xs'
                    : 'text-purple-700 dark:text-purple-300 hover:text-purple-950 dark:hover:text-white'
                }`}
              >
                Settings & Online
              </button>
              <button
                type="button"
                onClick={() => setTab('wallets')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'wallets'
                    ? 'bg-white dark:bg-[#230B48] text-pink-600 dark:text-amber-300 shadow-xs'
                    : 'text-purple-700 dark:text-purple-300 hover:text-purple-950 dark:hover:text-white'
                }`}
              >
                Deposits ({wallets.length})
              </button>
            </div>

            {tab === 'controls' && targetRoom && (
              <div className="space-y-5">
                {/* Room Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-purple-600 dark:text-purple-300 mr-1">Target Room:</span>
                  {rooms.map((r) => (
                    <button
                      key={r.stakeBirr}
                      type="button"
                      onClick={() => setSelectedRoomStake(r.stakeBirr)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer border ${
                        targetRoom.stakeBirr === r.stakeBirr
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 border-amber-300'
                          : 'bg-white dark:bg-[#1F0B3F] text-purple-800 dark:text-purple-100 border-pink-200 dark:border-purple-500/30'
                      }`}
                    >
                      {r.stakeBirr} Birr ({r.phase})
                    </button>
                  ))}
                </div>

                {/* Pause / Stop / End Round Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onPauseRoom(targetRoom.stakeBirr, !targetRoom.isPaused)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer border ${
                      targetRoom.isPaused
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white dark:bg-[#1F0B3F] text-purple-950 dark:text-amber-300 border-pink-200 dark:border-purple-500/30'
                    }`}
                  >
                    {targetRoom.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {targetRoom.isPaused ? 'Resume Game' : 'Pause Game'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onStopRound(targetRoom.stakeBirr)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-white dark:bg-[#1F0B3F] text-purple-950 dark:text-white border border-pink-200 dark:border-purple-500/30 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-pink-600 dark:text-amber-400" />
                    Stop & Refund
                  </button>

                  <button
                    type="button"
                    onClick={() => onEndRound(targetRoom.stakeBirr)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-rose-600 text-white border border-rose-500 hover:bg-rose-500 cursor-pointer"
                  >
                    <Flag className="w-4 h-4" />
                    End Round Now
                  </button>
                </div>

                {/* Auto-Take Random Cartelas Per Round */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Math.max(0, Math.min(maxCartelaCap, Math.round(Number(takeCartelasInput) || 0)));
                    onSetTakeCartelas(targetRoom.stakeBirr, n);
                  }}
                  className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold">
                        Auto-Take Random Cartelas ({targetRoom.stakeBirr} Birr)
                      </h3>
                      <p className="text-[11px] text-purple-600 dark:text-purple-300">
                        Automatically locks this many random available numbers as taken in each round.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-pink-600 dark:text-amber-400 font-bold">
                      Active: {targetRoom.adminTakeCount} / {maxCartelaCap}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={maxCartelaCap}
                      value={takeCartelasInput}
                      onChange={(e) => setTakeCartelasInput(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 font-mono text-sm focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="submit"
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 font-bold text-xs hover:brightness-105 cursor-pointer whitespace-nowrap"
                    >
                      Apply Each Round
                    </button>
                    {targetRoom.adminTakeCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTakeCartelasInput('0');
                          onSetTakeCartelas(targetRoom.stakeBirr, 0);
                        }}
                        className="h-10 px-3 rounded-xl bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 font-semibold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Off
                      </button>
                    )}
                  </div>
                </form>

                {/* Reset / Set Round # & Rounds Played Counter */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const rNum = Math.max(1, Math.round(Number(roundNumberInput) || 1));
                    const gPlayed = Math.max(0, Math.round(Number(gamesPlayedInput) || 0));
                    onResetRounds(targetRoom.stakeBirr, rNum, gPlayed);
                  }}
                  className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold">
                        Rounds Played Counter ({targetRoom.stakeBirr} Birr)
                      </h3>
                      <p className="text-[11px] text-purple-600 dark:text-purple-300">
                        Edit or reset Round # (Lobby & Header) and Rounds Played (Winners screen).
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-pink-600 dark:text-amber-400 font-bold">
                      Round #{targetRoom.roundNumber} · {targetRoom.gamesPlayed} played
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-purple-600 dark:text-purple-300">Round #</span>
                      <input
                        type="number"
                        min={1}
                        max={999999}
                        value={roundNumberInput}
                        onChange={(e) => setRoundNumberInput(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 font-mono text-sm focus:outline-none focus:border-pink-500"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-purple-600 dark:text-purple-300">Rounds Played</span>
                      <input
                        type="number"
                        min={0}
                        max={999999}
                        value={gamesPlayedInput}
                        onChange={(e) => setGamesPlayedInput(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 font-mono text-sm focus:outline-none focus:border-pink-500"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white font-semibold text-xs hover:brightness-110 cursor-pointer whitespace-nowrap"
                    >
                      Set This Room
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRoundNumberInput('1');
                        setGamesPlayedInput('0');
                        onResetRounds(targetRoom.stakeBirr, 1, 0);
                      }}
                      className="h-9 px-3.5 rounded-xl bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 font-semibold text-xs hover:bg-pink-200 dark:hover:bg-[#311264] cursor-pointer whitespace-nowrap"
                    >
                      Reset Room (#1 · 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRoundNumberInput('1');
                        setGamesPlayedInput('0');
                        onResetRounds('all', 1, 0);
                      }}
                      className="h-9 px-3.5 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-500 cursor-pointer whitespace-nowrap"
                    >
                      Reset All Rooms (#1 · 0)
                    </button>
                  </div>
                </form>

                {/* Select Numbers to Be Called Out */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold">
                        Select Numbers to Call ({targetRoom.stakeBirr} Birr)
                      </h3>
                      <p className="text-[11px] text-purple-600 dark:text-purple-300">
                        Queue as many numbers as you want (1–75) before or during the game.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCallImmediateMode((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                          callImmediateMode
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 border-amber-300'
                            : 'bg-pink-50 dark:bg-[#0D0320] text-purple-800 dark:text-purple-100 border-pink-200 dark:border-purple-500/30'
                        }`}
                      >
                        <Zap className="w-3 h-3 inline mr-1" />
                        {callImmediateMode ? 'Tap = Call Now' : 'Tap = Queue Next'}
                      </button>
                      {targetRoom.phase === 'CALLING' && (
                        <button
                          type="button"
                          onClick={() => onCallNow(targetRoom.stakeBirr)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                        >
                          Call Next Now
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Queued List */}
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-lg bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30">
                    <span className="text-[11px] text-purple-600 dark:text-purple-300 mr-1">
                      Queue ({queued.length}):
                    </span>
                    {queued.length === 0 ? (
                      <span className="text-[11px] text-purple-500 dark:text-purple-300">Random draw (none queued)</span>
                    ) : (
                      <>
                        {queued.map((n, idx) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              onQueueNumbers(
                                targetRoom.stakeBirr,
                                queued.filter((q) => q !== n)
                              )
                            }
                            className="px-2 py-0.5 rounded bg-amber-400 text-purple-950 font-mono text-[11px] font-bold cursor-pointer"
                          >
                            {idx + 1}. {getBallLetter(n)}-{n} ×
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => onQueueNumbers(targetRoom.stakeBirr, [])}
                          className="ml-auto text-[11px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </div>

                  {/* 1-75 Selector Grid */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {BINGO_LETTERS.map((letter, colIdx) => {
                      const [min] = getColumnRange(colIdx);
                      const nums = Array.from({ length: 15 }, (_, i) => min + i);
                      return (
                        <div key={letter} className="space-y-1">
                          <div className="text-center text-[11px] font-bold text-pink-600 dark:text-amber-300 pb-1 border-b border-pink-200 dark:border-purple-500/30">
                            {letter}
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {nums.map((n) => {
                              const isCalled = calledSet.has(n);
                              const qIdx = queued.indexOf(n);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={isCalled}
                                  onClick={() => handleNumberTap(n)}
                                  className={`h-8 rounded font-mono text-[11px] font-bold tabular-nums cursor-pointer ${
                                    isCalled
                                      ? 'bg-pink-100/70 dark:bg-purple-950/50 text-purple-300 dark:text-purple-600 cursor-not-allowed'
                                      : qIdx !== -1
                                        ? 'bg-amber-400 text-purple-950 ring-1 ring-amber-300'
                                        : 'bg-pink-50 dark:bg-[#0D0320] text-purple-900 dark:text-purple-100 border border-pink-200 dark:border-purple-500/30 hover:border-pink-500'
                                  }`}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'winners' && (
              <div className="space-y-5">
                {/* Top 10 Leaderboard Editor */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        Top 10 Leaderboard ({isCustomLeaderboard ? 'Custom' : 'Live Auto'})
                      </h3>
                      <p className="text-[11px] text-purple-600 dark:text-purple-300">
                        Edit names, wins, amounts, reorder ranks (#1–#10), or create new players.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCustomLeaderboard && (
                        <button
                          type="button"
                          onClick={() => onSetWinners(isCustomWinners ? draftWinners : null, null)}
                          className="px-3 py-1.5 rounded-lg bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 text-xs font-semibold cursor-pointer"
                        >
                          Reset Auto
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onSetWinners(isCustomWinners ? draftWinners : null, draftLeaderboard.slice(0, 10))
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white text-xs font-semibold hover:brightness-110 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Top 10
                      </button>
                    </div>
                  </div>

                  {/* Create New Top 10 Entry */}
                  <div className="grid grid-cols-12 gap-2 p-2.5 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30">
                    <input
                      type="text"
                      value={newLbName}
                      onChange={(e) => setNewLbName(e.target.value)}
                      placeholder="New player name..."
                      className="col-span-5 h-9 px-2.5 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newLbWins}
                      onChange={(e) => setNewLbWins(e.target.value)}
                      placeholder="Wins"
                      className="col-span-2 h-9 px-2 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newLbBirr}
                      onChange={(e) => setNewLbBirr(e.target.value)}
                      placeholder="Birr won"
                      className="col-span-3 h-9 px-2 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <button
                      type="button"
                      disabled={draftLeaderboard.length >= 10 || !newLbName.trim()}
                      onClick={() => {
                        const name = newLbName.trim();
                        if (!name) return;
                        const entry: LeaderboardEntry = {
                          playerId: `custom_lb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          playerName: name,
                          wins: Math.max(0, Math.round(Number(newLbWins) || 1)),
                          totalBirrWon: Math.max(0, Number(newLbBirr) || 0),
                          lastWonAt: Date.now(),
                        };
                        setDraftLeaderboard((prev) => [...prev, entry].slice(0, 10));
                        setNewLbName('');
                      }}
                      className="col-span-2 h-9 px-2 rounded-lg bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold hover:bg-emerald-500 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>

                  {/* Draft Top 10 List */}
                  {draftLeaderboard.length === 0 ? (
                    <p className="text-xs text-purple-600 dark:text-purple-300">
                      No leaderboard entries yet. Add custom players above.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {draftLeaderboard.slice(0, 10).map((entry, idx) => (
                        <div
                          key={entry.playerId + '-' + idx}
                          className="grid grid-cols-12 items-center gap-1.5 p-2 rounded-lg bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30"
                        >
                          <span className="col-span-1 font-mono text-xs font-bold text-purple-600 dark:text-purple-300 text-center">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={entry.playerName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftLeaderboard((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, playerName: val } : it))
                              );
                            }}
                            className="col-span-4 h-8 px-2 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 text-xs"
                          />
                          <input
                            type="number"
                            min={0}
                            value={entry.wins}
                            onChange={(e) => {
                              const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                              setDraftLeaderboard((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, wins: val } : it))
                              );
                            }}
                            title="Wins"
                            className="col-span-2 h-8 px-2 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                          />
                          <input
                            type="number"
                            min={0}
                            value={entry.totalBirrWon}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDraftLeaderboard((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, totalBirrWon: val } : it))
                              );
                            }}
                            title="Total Birr Won"
                            className="col-span-2 h-8 px-2 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                          />
                          <div className="col-span-3 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setDraftLeaderboard((prev) => {
                                  if (idx === 0) return prev;
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                })
                              }
                              className="p-1.5 rounded bg-pink-100 dark:bg-[#230B48] disabled:opacity-30 cursor-pointer"
                              aria-label="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx >= draftLeaderboard.length - 1}
                              onClick={() =>
                                setDraftLeaderboard((prev) => {
                                  if (idx >= prev.length - 1) return prev;
                                  const next = [...prev];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  return next;
                                })
                              }
                              className="p-1.5 rounded bg-pink-100 dark:bg-[#230B48] disabled:opacity-30 cursor-pointer"
                              aria-label="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftLeaderboard((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Winners Editor */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-bold">
                        Recent Winners List ({isCustomWinners ? 'Custom' : 'Live Auto'})
                      </h3>
                      <p className="text-[11px] text-purple-600 dark:text-purple-300">
                        Create custom winners with player name, Birr won, round #, stake, and cartela #.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCustomWinners && (
                        <button
                          type="button"
                          onClick={() => onSetWinners(null, isCustomLeaderboard ? draftLeaderboard : null)}
                          className="px-3 py-1.5 rounded-lg bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 text-xs font-semibold cursor-pointer"
                        >
                          Reset Auto
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onSetWinners(draftWinners, isCustomLeaderboard ? draftLeaderboard : null)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white text-xs font-semibold hover:brightness-110 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Winners
                      </button>
                    </div>
                  </div>

                  {/* Create Custom Winner Form */}
                  <div className="grid grid-cols-12 gap-2 p-2.5 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30">
                    <input
                      type="text"
                      value={newWinName}
                      onChange={(e) => setNewWinName(e.target.value)}
                      placeholder="Winner name..."
                      className="col-span-4 h-9 px-2.5 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newWinBirr}
                      onChange={(e) => setNewWinBirr(e.target.value)}
                      placeholder="Amount"
                      title="Amount Won (Birr)"
                      className="col-span-2 h-9 px-2 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={newWinRound}
                      onChange={(e) => setNewWinRound(e.target.value)}
                      placeholder="Round #"
                      title="Round Won In"
                      className="col-span-2 h-9 px-2 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={newWinStake}
                      onChange={(e) => setNewWinStake(e.target.value)}
                      placeholder="Stake"
                      title="Stake Birr"
                      className="col-span-1 h-9 px-1.5 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      max={maxCartelaCap}
                      value={newWinCartela}
                      onChange={(e) => setNewWinCartela(e.target.value)}
                      placeholder="#"
                      title="Cartela #"
                      className="col-span-1 h-9 px-1.5 rounded-lg bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                    />
                    <button
                      type="button"
                      disabled={!newWinName.trim()}
                      onClick={() => {
                        const name = newWinName.trim();
                        if (!name) return;
                        const cNum = Math.max(1, Math.min(maxCartelaCap, Math.round(Number(newWinCartela) || 1)));
                        const row: RoundWinner = {
                          playerId: `custom_w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          playerName: name,
                          cartelaNumber: cNum,
                          isCustom: false,
                          patternName: '1 Line',
                          winningCells: [],
                          winningNumber: null,
                          prizeAmount: Math.max(0, Number(newWinBirr) || 0),
                          stakeBirr: Math.max(1, Math.round(Number(newWinStake) || 10)),
                          grid: generateCartelaGrid(cNum),
                          callsCount: 18,
                          roundNumber: Math.max(1, Math.round(Number(newWinRound) || 1)),
                          wonAt: Date.now(),
                        };
                        setDraftWinners((prev) => [row, ...prev].slice(0, 30));
                        setNewWinName('');
                      }}
                      className="col-span-2 h-9 px-2 rounded-lg bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold hover:bg-emerald-500 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>

                  {/* Draft Winners Rows */}
                  {draftWinners.length === 0 ? (
                    <p className="text-xs text-purple-600 dark:text-purple-300">
                      No winners listed yet. Add custom winners above.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {draftWinners.map((w, idx) => (
                        <div
                          key={`${w.playerId}-${idx}`}
                          className="grid grid-cols-12 items-center gap-1.5 p-2 rounded-lg bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30"
                        >
                          <input
                            type="text"
                            value={w.playerName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDraftWinners((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, playerName: val } : it))
                              );
                            }}
                            className="col-span-4 h-8 px-2 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 text-xs"
                          />
                          <input
                            type="number"
                            min={0}
                            value={w.prizeAmount}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDraftWinners((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, prizeAmount: val } : it))
                              );
                            }}
                            title="Birr Won"
                            className="col-span-2 h-8 px-1.5 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                          />
                          <input
                            type="number"
                            min={1}
                            value={w.roundNumber}
                            onChange={(e) => {
                              const val = Math.max(1, Math.round(Number(e.target.value) || 1));
                              setDraftWinners((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, roundNumber: val } : it))
                              );
                            }}
                            title="Round #"
                            className="col-span-2 h-8 px-1.5 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                          />
                          <input
                            type="number"
                            min={1}
                            value={w.stakeBirr}
                            onChange={(e) => {
                              const val = Math.max(1, Math.round(Number(e.target.value) || 10));
                              setDraftWinners((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, stakeBirr: val } : it))
                              );
                            }}
                            title="Stake Birr"
                            className="col-span-1 h-8 px-1 rounded bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 font-mono text-xs"
                          />
                          <div className="col-span-3 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setDraftWinners((prev) => {
                                  if (idx === 0) return prev;
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                })
                              }
                              className="p-1.5 rounded bg-pink-100 dark:bg-[#230B48] disabled:opacity-30 cursor-pointer"
                              aria-label="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx >= draftWinners.length - 1}
                              onClick={() =>
                                setDraftWinners((prev) => {
                                  if (idx >= prev.length - 1) return prev;
                                  const next = [...prev];
                                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                                  return next;
                                })
                              }
                              className="p-1.5 rounded bg-pink-100 dark:bg-[#230B48] disabled:opacity-30 cursor-pointer"
                              aria-label="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftWinners((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="space-y-5">
                {/* Online Counter Override */}
                <form
                  onSubmit={handleSetOnlineSubmit}
                  className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-display text-sm font-bold">
                      <Users className="w-4 h-4 text-pink-600 dark:text-amber-400" />
                      Displayed Online Count
                    </div>
                    <span className="text-[11px] font-mono text-purple-600 dark:text-purple-300">
                      {settings.onlineCountOverride === null ? 'Auto (Live)' : `Custom: ${settings.onlineCountOverride}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={999999}
                      value={onlineInput}
                      onChange={(e) => setOnlineInput(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 font-mono text-sm focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="submit"
                      className="h-11 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white font-semibold text-xs hover:brightness-110 cursor-pointer whitespace-nowrap"
                    >
                      Set Online
                    </button>
                    {settings.onlineCountOverride !== null && (
                      <button
                        type="button"
                        onClick={() => onSetOnlineCount(null)}
                        className="h-11 px-3 rounded-xl bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 font-semibold text-xs cursor-pointer whitespace-nowrap"
                      >
                        Reset Live
                      </button>
                    )}
                  </div>
                </form>

                {/* Displayed Players Count Per Stake Room */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-display text-sm font-bold">
                      <Users className="w-4 h-4 text-pink-600 dark:text-amber-400" />
                      Stake Room Players &amp; Random Cartelas
                    </div>
                    <p className="text-[11px] text-purple-600 dark:text-purple-300">
                      Setting players count takes that many random cartelas and scales each room&apos;s Prize Pool (e.g., 10 players in 20 Birr = 200 gross).
                    </p>
                  </div>
                  <div className="space-y-2">
                    {rooms.map((r) => (
                      <div key={r.stakeBirr} className="flex flex-wrap items-center gap-2">
                        <span className="w-20 text-xs font-mono font-bold text-purple-800 dark:text-purple-100 shrink-0">
                          {r.stakeBirr} Birr
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={999999}
                          value={roomPlayersInputs[r.stakeBirr] ?? String(r.displayedPlayersCount)}
                          onChange={(e) =>
                            setRoomPlayersInputs((prev) => ({
                              ...prev,
                              [r.stakeBirr]: e.target.value,
                            }))
                          }
                          className="flex-1 min-w-[90px] h-10 px-3 rounded-xl bg-pink-50/70 dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/35 font-mono text-sm focus:outline-none focus:border-pink-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Number(roomPlayersInputs[r.stakeBirr]);
                            if (!Number.isFinite(val) || val < 0) return;
                            onSetRoomPlayersCount(r.stakeBirr, Math.round(val));
                          }}
                          className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white font-semibold text-xs hover:brightness-110 cursor-pointer whitespace-nowrap"
                        >
                          Set
                        </button>
                        {r.displayedPlayersOverride !== null && (
                          <button
                            type="button"
                            onClick={() => onSetRoomPlayersCount(r.stakeBirr, null)}
                            className="h-10 px-3 rounded-xl bg-pink-100 dark:bg-[#230B48] text-purple-800 dark:text-purple-100 font-semibold text-xs cursor-pointer whitespace-nowrap"
                          >
                            Reset Live
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commission, Calling Speed, Total Cartelas & Seasonal Effects */}
                <form
                  onSubmit={handleSaveSettings}
                  className="p-4 rounded-xl bg-white dark:bg-[#1F0B38] border border-fuchsia-200 dark:border-[#3B1764] space-y-4"
                >
                  <div className="flex items-center gap-2 font-display text-sm font-bold">
                    <Sliders className="w-4 h-4 text-fuchsia-600 dark:text-amber-400" />
                    House Commission, Cartela Limit (100–600) & Season FX
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs text-purple-700 dark:text-purple-200">House Commission (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={80}
                        value={commissionInput}
                        onChange={(e) => setCommissionInput(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-sm focus:outline-none focus:border-fuchsia-500"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-purple-700 dark:text-purple-200">Call Interval (seconds)</span>
                      <input
                        type="number"
                        step="0.5"
                        min={1.5}
                        max={60}
                        value={intervalInput}
                        onChange={(e) => setIntervalInput(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-sm focus:outline-none focus:border-fuchsia-500"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-purple-700 dark:text-purple-200">Total Cartelas (100–600)</span>
                      <input
                        type="number"
                        min={MIN_CARTELAS}
                        max={MAX_CARTELAS_LIMIT}
                        value={maxCartelasInput}
                        onChange={(e) => setMaxCartelasInput(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-sm focus:outline-none focus:border-fuchsia-500"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-purple-700 dark:text-purple-200">Mini App Seasonal Effect</span>
                      <select
                        value={seasonThemeInput}
                        onChange={(e) => setSeasonThemeInput(e.target.value as SeasonThemeId)}
                        className="w-full h-11 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] text-sm focus:outline-none focus:border-fuchsia-500"
                      >
                        <option value="none">None (Default)</option>
                        <option value="christmas">Christmas (Snowfall)</option>
                        <option value="enkutatash">Enkutatash (Adey Abeba Flowers)</option>
                        <option value="golden">Golden Gala (Gold Sparkles)</option>
                        <option value="cyber">Cyber Neon (Prism Particles)</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="h-11 px-5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 font-bold text-xs hover:brightness-105 cursor-pointer"
                  >
                    Save House Settings
                  </button>
                </form>

                {/* Admin Telegram IDs Manager */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B38] border border-fuchsia-200 dark:border-[#3B1764] space-y-3">
                  <div>
                    <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-fuchsia-600 dark:text-amber-400" />
                      Admin Access Telegram IDs
                    </h3>
                    <p className="text-xs text-purple-600 dark:text-purple-300">
                      Add numeric Telegram User IDs who unlock Admin Panel automatically.
                    </p>
                  </div>

                  <form onSubmit={handleAddAdminId} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAdminIdInput}
                      onChange={(e) => setNewAdminIdInput(e.target.value)}
                      placeholder="e.g. 5123456789"
                      className="flex-1 h-10 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-sm focus:outline-none focus:border-fuchsia-500"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-semibold text-xs hover:brightness-110 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Admin
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {adminIds.length === 0 ? (
                      <span className="text-xs text-purple-500 dark:text-purple-300">
                        No extra DB admins added yet (env ADMIN_TELEGRAM_IDS always active).
                      </span>
                    ) : (
                      adminIds.map((id) => (
                        <div
                          key={id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] text-xs font-mono font-bold"
                        >
                          <span>{id}</span>
                          <button
                            type="button"
                            onClick={() => onManageAdmins(adminIds.filter((x) => x !== id))}
                            aria-label={`Remove admin ${id}`}
                            className="text-rose-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Stake Rooms */}
                <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B38] border border-fuchsia-200 dark:border-[#3B1764] space-y-4">
                  <div>
                    <h3 className="font-display text-sm font-bold">Entry Screen Stake Options (Birr)</h3>
                    <p className="text-xs text-purple-600 dark:text-purple-300">
                      Add any custom Birr amount — appears immediately on the Select your stake screen.
                    </p>
                  </div>

                  <form onSubmit={handleAddStakeSubmit} className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={newStakeInput}
                      onChange={(e) => setNewStakeInput(e.target.value)}
                      placeholder="Type amount (e.g. 50)"
                      className="flex-1 h-11 px-3 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-sm focus:outline-none focus:border-fuchsia-500"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Add Birr Option
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {rooms.map((r) => (
                      <div
                        key={r.stakeBirr}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] text-xs font-mono font-bold"
                      >
                        <span>{r.stakeBirr} Birr</span>
                        {rooms.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveStake(r.stakeBirr)}
                            aria-label={`Remove ${r.stakeBirr} Birr room`}
                            className="text-rose-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hosting / Telegram Bot Guide shortcut inside Admin */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenHostGuide();
                  }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-fuchsia-600 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  <Server className="w-4 h-4" />
                  Telegram Webhook & Free Hosting Setup
                </button>
              </div>
            )}

            {tab === 'wallets' && (
              <div className="p-4 rounded-xl bg-white dark:bg-[#1F0B38] border border-fuchsia-200 dark:border-[#3B1764] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-fuchsia-600 dark:text-amber-400" />
                      Players, Top-Up & Ban Control
                    </h3>
                    <p className="text-xs text-purple-600 dark:text-purple-300">
                      Credit Birr or ban/unban registered players instantly.
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-purple-600 dark:text-purple-300">Amount:</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="w-24 h-9 px-2.5 rounded-lg bg-fuchsia-50 dark:bg-[#0B0314] border border-fuchsia-200 dark:border-[#3B1764] font-mono text-xs"
                    />
                  </label>
                </div>

                {wallets.length === 0 ? (
                  <p className="text-xs text-purple-500 dark:text-purple-300">No players registered in this session yet.</p>
                ) : (
                  <div className="divide-y divide-fuchsia-100 dark:divide-[#2E1052]">
                    {wallets.map((w) => {
                      const banned = Boolean(w.isBanned || w.wallet.isBanned);
                      return (
                        <div key={w.playerId} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm flex items-center gap-1.5 truncate">
                              <span className="truncate">{w.name}</span>
                              {w.wallet.rankTier && <RankBadge rank={w.wallet.rankTier} size="xs" />}
                              {banned && (
                                <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                                  Banned
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-purple-600 dark:text-purple-300 tabular-nums">
                              Dep: {w.wallet.depositedBalance} · Won: {w.wallet.wonBalance} Birr
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleBan(w.playerId, !banned)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                                banned
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                              }`}
                            >
                              {banned ? 'Unban' : 'Ban'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const amt = Number(topupAmount);
                                if (Number.isFinite(amt) && amt > 0) {
                                  onTopupWallet(w.playerId, Math.round(amt));
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 text-xs font-bold hover:brightness-105 cursor-pointer whitespace-nowrap"
                            >
                              +{topupAmount || 0} Birr
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
