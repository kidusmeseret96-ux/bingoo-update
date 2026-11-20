export type BingoLetter = 'B' | 'I' | 'N' | 'G' | 'O';

export type GamePhase = 'OPENING' | 'CALLING' | 'ENDED';

export type AppLanguage = 'en' | 'am' | 'om';

export const BINGO_LETTERS: BingoLetter[] = ['B', 'I', 'N', 'G', 'O'];

export const TOTAL_CARTELAS = 400;
export const MIN_CARTELAS = 100;
export const MAX_CARTELAS_LIMIT = 600;
export const SELECTION_DURATION_SEC = 30;
export const DEFAULT_CALL_INTERVAL_MS = 3500;
export const ENDED_DURATION_SEC = 4;
export const DEFAULT_STAKES = [10, 20];
export const INITIAL_DEPOSIT_BIRR = 100;

export type RankTierId = 'bronze' | 'silver' | 'gold' | 'diamond' | 'platinum';

export interface RankThresholds {
  bronze: number;
  silver: number;
  gold: number;
  diamond: number;
  platinum: number;
}

export const DEFAULT_RANK_THRESHOLDS: RankThresholds = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  diamond: 5000,
  platinum: 15000,
};

export function computeRankTier(
  totalDepositedBirr: number,
  thresholds: RankThresholds = DEFAULT_RANK_THRESHOLDS
): RankTierId {
  const amt = Number(totalDepositedBirr) || 0;
  if (amt >= (thresholds.platinum ?? 15000)) return 'platinum';
  if (amt >= (thresholds.diamond ?? 5000)) return 'diamond';
  if (amt >= (thresholds.gold ?? 2000)) return 'gold';
  if (amt >= (thresholds.silver ?? 500)) return 'silver';
  return 'bronze';
}

export type SeasonThemeId = 'none' | 'christmas' | 'enkutatash' | 'golden' | 'cyber';

export type SpecialEventThemeId =
  | 'christmas'
  | 'enkutatash'
  | 'football'
  | 'golden'
  | 'cyber'
  | 'emerald'
  | 'sunset'
  | 'amethyst'
  | 'diamond_ice'
  | 'rose_gold';

export interface SpecialEvent {
  id: string;
  name: string;
  descriptionText: string;
  themeKey: SpecialEventThemeId;
  entryBirr: number;
  bonusPrizeBirr: number;
  minPlayers: number;
  endsAt: string | null;
  isActive: boolean;
}

export type MissionType =
  | 'play_rounds'
  | 'win_rounds'
  | 'win_pattern'
  | 'invite_friends'
  | 'deposit_birr';

export interface DailyMission {
  id: string;
  title: string;
  missionType: MissionType;
  targetCount: number;
  patternFilter: string;
  rewardBirr: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PlayerMissionState {
  date: string;
  missions: DailyMission[];
  progressMap: Record<string, number>;
  claimedIds: string[];
  allBonusClaimed: boolean;
  completionBonusBirr: number;
}

export type PresetBankKey =
  | 'telebirr'
  | 'cbe'
  | 'cbe_birr'
  | 'abyssinia'
  | 'awash'
  | 'kaffi'
  | 'ebirr'
  | 'coop';

export interface PresetBankDefinition {
  key: PresetBankKey;
  sortOrder: number;
  names: Record<AppLanguage, string>;
}

export const PRESET_BANKS: PresetBankDefinition[] = [
  { key: 'telebirr', sortOrder: 1, names: { en: 'Telebirr', am: 'ቴሌብር', om: 'Telebirr' } },
  { key: 'cbe', sortOrder: 2, names: { en: 'CBE', am: 'ሲቢኢ (CBE)', om: 'CBE' } },
  { key: 'cbe_birr', sortOrder: 3, names: { en: 'CBE Birr', am: 'ሲቢኢ ብር', om: 'CBE Birr' } },
  { key: 'abyssinia', sortOrder: 4, names: { en: 'Abyssinia Bank', am: 'አቢሲኒያ ባንክ', om: 'Baankii Abyssinia' } },
  { key: 'awash', sortOrder: 5, names: { en: 'Awash Bank', am: 'አዋሽ ባንክ', om: 'Baankii Awash' } },
  { key: 'kaffi', sortOrder: 6, names: { en: 'Kaffi', am: 'ካፊ', om: 'Kaffi' } },
  { key: 'ebirr', sortOrder: 7, names: { en: 'E-Birr', am: 'ኢ-ብር', om: 'E-Birr' } },
  { key: 'coop', sortOrder: 8, names: { en: 'Coop', am: 'ኩፕ (Coop)', om: 'Baankii Coop' } },
];

export function getBallLetter(num: number): BingoLetter {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

export function getAudioFilename(num: number): string | null {
  if (!Number.isInteger(num) || num < 1 || num > 75) return null;
  const letter = getBallLetter(num).toLowerCase();
  return `${letter}${num}.mp3`;
}

export function getAmharicCallText(num: number): { native: string; phonetic: string } {
  const letter = getBallLetter(num);
  const letterAm: Record<BingoLetter, { am: string; ph: string }> = {
    B: { am: 'ቢ', ph: 'Bee' },
    I: { am: 'አይ', ph: 'Eye' },
    N: { am: 'ኤን', ph: 'En' },
    G: { am: 'ጂ', ph: 'Jee' },
    O: { am: 'ኦ', ph: 'Oh' },
  };

  const unitsAm = ['', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ'];
  const unitsPh = ['', 'and', 'hulet', 'sost', 'arat', 'amist', 'sidist', 'sebat', 'simint', 'zetegn'];

  const tensMap: Record<number, { am: string; amPrefix: string; ph: string }> = {
    10: { am: 'አስር', amPrefix: 'አስራ', ph: 'asir' },
    20: { am: 'ሀያ', amPrefix: 'ሀያ', ph: 'haya' },
    30: { am: 'ሰላሳ', amPrefix: 'ሰላሳ', ph: 'selasa' },
    40: { am: 'አርባ', amPrefix: 'አርባ', ph: 'arba' },
    50: { am: 'ሀምሳ', amPrefix: 'ሀምሳ', ph: 'hamsa' },
    60: { am: 'ስልሳ', amPrefix: 'ስልሳ', ph: 'silsa' },
    70: { am: 'ሰባ', amPrefix: 'ሰባ', ph: 'seba' },
  };

  let numAm = '';
  let numPh = '';

  if (num < 10) {
    numAm = unitsAm[num];
    numPh = unitsPh[num];
  } else {
    const tens = Math.floor(num / 10) * 10;
    const unit = num % 10;
    const t = tensMap[tens];
    if (unit === 0) {
      numAm = t.am;
      numPh = t.ph;
    } else if (tens === 10) {
      numAm = `${t.amPrefix} ${unitsAm[unit]}`;
      numPh = `asra ${unitsPh[unit]}`;
    } else {
      numAm = `${t.amPrefix} ${unitsAm[unit]}`;
      numPh = `${t.ph} ${unitsPh[unit]}`;
    }
  }

  return {
    native: `${letterAm[letter].am} ${numAm}`,
    phonetic: `${letterAm[letter].ph}, ${numPh}`,
  };
}

export function getOromoCallText(num: number): { native: string; phonetic: string } {
  const letter = getBallLetter(num);
  const letterOm: Record<BingoLetter, { om: string; ph: string }> = {
    B: { om: 'Bii', ph: 'Bee' },
    I: { om: 'Aay', ph: 'Eye' },
    N: { om: 'Een', ph: 'En' },
    G: { om: 'Jii', ph: 'Jee' },
    O: { om: 'Oo', ph: 'Oh' },
  };

  const unitsOm = ['', 'tokko', 'lama', 'sadii', 'afur', 'shan', "ja'a", 'torba', 'saddeet', 'sagal'];
  const unitsPh = ['', 'tokko', 'lama', 'sadi', 'afur', 'shan', 'jaha', 'torba', 'saddeet', 'sagal'];

  const tensExactOm: Record<number, { om: string; prefixOm: string; phPrefix: string }> = {
    10: { om: 'kudhan', prefixOm: 'kudha', phPrefix: 'kudha' },
    20: { om: 'digdama', prefixOm: 'digdamii', phPrefix: 'digdami' },
    30: { om: 'soddoma', prefixOm: 'soddomii', phPrefix: 'soddomi' },
    40: { om: 'afurtama', prefixOm: 'afurtamii', phPrefix: 'afurtami' },
    50: { om: 'shantama', prefixOm: 'shantamii', phPrefix: 'shantami' },
    60: { om: 'jaatama', prefixOm: 'jaatamii', phPrefix: 'jatami' },
    70: { om: 'torbaatama', prefixOm: 'torbaatamii', phPrefix: 'torbatami' },
  };

  let numOm = '';
  let numPh = '';

  if (num < 10) {
    numOm = unitsOm[num];
    numPh = unitsPh[num];
  } else {
    const tens = Math.floor(num / 10) * 10;
    const unit = num % 10;
    const t = tensExactOm[tens];
    if (unit === 0) {
      numOm = t.om;
      numPh = t.om;
    } else {
      numOm = `${t.prefixOm} ${unitsOm[unit]}`;
      numPh = `${t.phPrefix} ${unitsPh[unit]}`;
    }
  }

  return {
    native: `${letterOm[letter].om} ${numOm}`,
    phonetic: `${letterOm[letter].ph}, ${numPh}`,
  };
}

export function getLocalizedCallText(num: number, lang: AppLanguage): { display: string; speak: string; speechLang: string } {
  const letter = getBallLetter(num);
  if (lang === 'am') {
    const am = getAmharicCallText(num);
    return { display: am.native, speak: am.native, speechLang: 'am-ET' };
  }
  if (lang === 'om') {
    const om = getOromoCallText(num);
    return { display: om.native, speak: om.phonetic, speechLang: 'om-ET' };
  }
  return { display: `${letter}-${num}`, speak: `${letter}, ${num}`, speechLang: 'en-US' };
}

export function getColumnRange(col: number): [number, number] {
  const min = col * 15 + 1;
  const max = col * 15 + 15;
  return [min, max];
}

// Exact deterministic PRNG matching offline-game.js (seededRandom(id * 7919))
function seededRandom(seed: number): () => number {
  let value = seed | 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCartelaGrid(cartelaId: number): number[][] {
  const random = seededRandom(Number(cartelaId) * 7919);
  const columns: number[][] = [];

  for (let col = 0; col < 5; col++) {
    const [low, high] = getColumnRange(col);
    const pool = Array.from({ length: high - low + 1 }, (_, i) => low + i);
    const picked: number[] = [];
    for (let i = 0; i < 5; i++) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    picked.sort((a, b) => a - b);
    columns.push(picked);
  }

  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (__, col) => (row === 2 && col === 2 ? 0 : columns[col][row]))
  );
}

export function validateCustomGrid(grid: number[][]): { valid: boolean; reason?: string } {
  if (!Array.isArray(grid) || grid.length !== 5) {
    return { valid: false, reason: 'Grid must have 5 rows.' };
  }
  const seen = new Set<number>();
  for (let r = 0; r < 5; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 5) {
      return { valid: false, reason: 'Each row must have 5 cells.' };
    }
    for (let c = 0; c < 5; c++) {
      const val = grid[r][c];
      if (r === 2 && c === 2) {
        if (val !== 0) return { valid: false, reason: 'Center cell must be FREE (0).' };
        continue;
      }
      const [min, max] = getColumnRange(c);
      if (!Number.isInteger(val) || val < min || val > max) {
        return {
          valid: false,
          reason: `Column ${BINGO_LETTERS[c]} must contain integers from ${min} to ${max}.`,
        };
      }
      if (seen.has(val)) {
        return { valid: false, reason: `Duplicate number ${val} in cartela.` };
      }
      seen.add(val);
    }
  }
  return { valid: true };
}

export interface WinCheckResult {
  won: boolean;
  patternName: string;
  winningCells: [number, number][];
  winningNumber: number | null;
}

export function checkWinningPattern(
  grid: number[][],
  calledNumbers: number[] | Set<number>
): WinCheckResult {
  const calledList = Array.isArray(calledNumbers) ? calledNumbers : Array.from(calledNumbers);
  const calledSet = calledNumbers instanceof Set ? calledNumbers : new Set(calledList);

  const isMarked = (r: number, c: number): boolean => {
    if (r === 2 && c === 2) return true;
    return calledSet.has(grid[r][c]);
  };

  const findWinningBall = (cells: [number, number][]): number | null => {
    for (let i = calledList.length - 1; i >= 0; i--) {
      const num = calledList[i];
      if (cells.some(([r, c]) => !(r === 2 && c === 2) && grid[r][c] === num)) {
        return num;
      }
    }
    return calledList.length > 0 ? calledList[calledList.length - 1] : null;
  };

  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => isMarked(r, c))) {
      const cells: [number, number][] = [0, 1, 2, 3, 4].map((c) => [r, c]);
      return {
        won: true,
        patternName: `Row ${r + 1}`,
        winningCells: cells,
        winningNumber: findWinningBall(cells),
      };
    }
  }

  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => isMarked(r, c))) {
      const cells: [number, number][] = [0, 1, 2, 3, 4].map((r) => [r, c]);
      return {
        won: true,
        patternName: `Column ${BINGO_LETTERS[c]}`,
        winningCells: cells,
        winningNumber: findWinningBall(cells),
      };
    }
  }

  if ([0, 1, 2, 3, 4].every((i) => isMarked(i, i))) {
    const cells: [number, number][] = [0, 1, 2, 3, 4].map((i) => [i, i]);
    return {
      won: true,
      patternName: 'Main Diagonal',
      winningCells: cells,
      winningNumber: findWinningBall(cells),
    };
  }

  if ([0, 1, 2, 3, 4].every((i) => isMarked(i, 4 - i))) {
    const cells: [number, number][] = [0, 1, 2, 3, 4].map((i) => [i, 4 - i]);
    return {
      won: true,
      patternName: 'Reverse Diagonal',
      winningCells: cells,
      winningNumber: findWinningBall(cells),
    };
  }

  const corners: [number, number][] = [
    [0, 0],
    [0, 4],
    [4, 0],
    [4, 4],
  ];
  if (corners.every(([r, c]) => isMarked(r, c))) {
    return {
      won: true,
      patternName: 'Four Corners',
      winningCells: corners,
      winningNumber: findWinningBall(corners),
    };
  }

  return { won: false, patternName: '', winningCells: [], winningNumber: null };
}

export interface PlayerIdentity {
  id: string;
  name: string;
  username?: string;
  isTelegram: boolean;
}

export interface PlayerWallet {
  depositedBalance: number;
  wonBalance: number;
  totalDeposited?: number;
  rankTier?: RankTierId;
  isBanned?: boolean;
}

export interface CartelaEntry {
  entryId: string;
  cartelaNumber: number;
  isCustom: boolean;
  isHouseReserved?: boolean;
  grid: number[][];
  playerId: string;
  playerName: string;
  playerRank?: RankTierId;
  paidFromDeposit: number;
  paidFromWon: number;
  autoClaim: boolean;
  selectedAt: number;
}

export interface RoundWinner {
  playerId: string;
  playerName: string;
  playerRank?: RankTierId;
  cartelaNumber: number;
  isCustom: boolean;
  patternName: string;
  winningCells: [number, number][];
  winningNumber: number | null;
  prizeAmount: number;
  stakeBirr: number;
  grid: number[][];
  callsCount: number;
  roundNumber: number;
  wonAt: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  playerRank?: RankTierId;
  wins: number;
  totalBirrWon: number;
  lastWonAt: number;
}

export interface RoomSummary {
  stakeBirr: number;
  roundNumber: number;
  gamesPlayed: number;
  phase: GamePhase;
  isPaused: boolean;
  secondsRemaining: number;
  entriesCount: number;
  uniquePlayersCount: number;
  displayedPlayersCount: number;
  displayedPlayersOverride: number | null;
  adminTakeCount: number;
  playersInRoom: number;
  prizePool: number;
  calledCount: number;
  currentBall: number | null;
}

export interface HouseSettings {
  stakes: number[];
  commissionPercent: number;
  callIntervalSeconds: number;
  maxCartelas: number;
  seasonTheme: SeasonThemeId;
  rankThresholds: RankThresholds;
  missionCompletionBonus: number;
  onlineCountOverride: number | null;
}

export interface PublicGameState {
  stakeBirr: number;
  roundNumber: number;
  gamesPlayed: number;
  phase: GamePhase;
  isPaused: boolean;
  phaseStartedAt: number;
  phaseEndsAt: number;
  secondsRemaining: number;
  calledNumbers: number[];
  currentBall: number | null;
  remainingBallCount: number;
  entries: CartelaEntry[];
  uniquePlayersCount: number;
  displayedPlayersCount: number;
  displayedPlayersOverride: number | null;
  adminTakeCount: number;
  onlineCount: number;
  playersInRoom: number;
  commissionPercent: number;
  prizePool: number;
  callIntervalMs: number;
  winners: RoundWinner[];
  recentWinners: RoundWinner[];
  leaderboard: LeaderboardEntry[];
  botConfigured: boolean;
  settings: HouseSettings;
  activeSpecialEvent?: SpecialEvent | null;
  serverTime: number;
}

export interface LobbySnapshot {
  rooms: RoomSummary[];
  specialEvents: SpecialEvent[];
  settings: HouseSettings;
  onlineCount: number;
  botConfigured: boolean;
  serverTime: number;
}

export type ClientMessage =
  | { type: 'auth'; player: PlayerIdentity; autoClaim?: boolean; language?: AppLanguage }
  | { type: 'set_language'; language: AppLanguage }
  | { type: 'join_room'; stakeBirr: number }
  | { type: 'join_special_event'; eventId: string }
  | { type: 'leave_room' }
  | { type: 'set_auto_claim'; autoClaim: boolean }
  | { type: 'select_cartela'; cartelaNumber: number }
  | { type: 'select_custom_cartela'; grid: number[][] }
  | { type: 'release_cartela'; entryId: string }
  | { type: 'claim_bingo'; entryId: string }
  | { type: 'claim_mission'; missionId: string }
  | { type: 'claim_all_missions' }
  // Admin-only commands
  | { type: 'admin_auth'; pin: string }
  | { type: 'admin_pause'; stakeBirr: number; paused: boolean }
  | { type: 'admin_stop_round'; stakeBirr: number }
  | { type: 'admin_end_round'; stakeBirr: number }
  | { type: 'admin_queue_numbers'; stakeBirr: number; numbers: number[] }
  | { type: 'admin_call_now'; stakeBirr: number; number?: number }
  | { type: 'admin_update_settings'; commissionPercent: number; callIntervalSeconds: number; maxCartelas?: number; seasonTheme?: SeasonThemeId }
  | { type: 'admin_set_online_count'; count: number | null }
  | { type: 'admin_set_room_players_count'; stakeBirr: number; count: number | null }
  | { type: 'admin_set_take_cartelas'; stakeBirr: number; count: number }
  | { type: 'admin_reset_rounds'; stakeBirr: number | 'all'; roundNumber?: number; gamesPlayed?: number }
  | { type: 'admin_set_winners'; recentWinners: RoundWinner[] | null; leaderboard: LeaderboardEntry[] | null }
  | { type: 'admin_add_stake'; stakeBirr: number }
  | { type: 'admin_remove_stake'; stakeBirr: number }
  | { type: 'admin_topup_wallet'; playerId: string; amount: number }
  | { type: 'admin_toggle_ban'; playerId: string; isBanned: boolean }
  | { type: 'admin_manage_admins'; adminIds: string[] };

export type ServerMessage =
  | { type: 'lobby:sync'; lobby: LobbySnapshot }
  | { type: 'wallet:sync'; wallet: PlayerWallet }
  | { type: 'language:sync'; language: AppLanguage }
  | { type: 'missions:sync'; missions: PlayerMissionState }
  | { type: 'state:sync'; state: PublicGameState }
  | { type: 'phase:changed'; state: PublicGameState }
  | { type: 'ball:called'; stakeBirr: number; ball: number; calledNumbers: number[]; remainingBallCount: number; serverTime: number }
  | { type: 'entries:updated'; stakeBirr: number; entries: CartelaEntry[]; uniquePlayersCount: number; prizePool: number }
  | { type: 'presence:updated'; onlineCount: number; playersInRoom?: number }
  | { type: 'round:ended'; state: PublicGameState }
  | {
      type: 'admin:status';
      isAdmin: boolean;
      queuedByRoom: Record<number, number[]>;
      wallets?: Array<{ playerId: string; name: string; wallet: PlayerWallet; isBanned?: boolean }>;
      adminIds?: string[];
      recentWinners?: RoundWinner[];
      leaderboard?: LeaderboardEntry[];
      isCustomWinners?: boolean;
      isCustomLeaderboard?: boolean;
      message?: string;
    }
  | { type: 'action:error'; message: string }
  | { type: 'action:ok'; message: string };
