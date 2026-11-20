import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_RANK_THRESHOLDS,
  MAX_CARTELAS_LIMIT,
  MIN_CARTELAS,
  PRESET_BANKS,
  TOTAL_CARTELAS,
  type AppLanguage,
  type DailyMission,
  type LeaderboardEntry,
  type MissionType,
  type PlayerWallet,
  type PresetBankKey,
  type RankThresholds,
  type RoundWinner,
  type SeasonThemeId,
  type SpecialEvent,
  type SpecialEventThemeId,
} from './shared/bingo.ts';

export interface PaymentButtonRecord {
  id: string;
  flow_type: 'deposit' | 'withdraw';
  bank_key: PresetBankKey;
  label: string;
  response_text: string;
  copyable_text: string;
  sort_order: number;
  is_active: boolean;
}

export interface BotTemplateButtonConfig {
  label: string;
  action_type: 'template' | 'callback' | 'url' | 'web_app';
  action_value: string;
}

export interface BotTextTemplateRecord {
  id: string;
  template_key: string;
  language: AppLanguage;
  title: string;
  message_text: string;
  buttons_config: BotTemplateButtonConfig[];
  is_custom: boolean;
}

export interface VoucherRecord {
  id: string;
  code: string;
  bonus_birr: number;
  creator_name: string;
  is_active: boolean;
  uses_count: number;
  total_deposited_birr: number;
  created_at: string;
}

export interface BotAppConfig {
  adminGroupId: string;
  extraGroupIds: string[];
  extraAdminIds: string[];
  depositIntroText: string;
  withdrawIntroText: string;
  withdrawPromptText: string;
  commissionPercent: number;
  callIntervalMs: number;
  maxCartelas: number;
  vouchersEnabled: boolean;
  seasonTheme: SeasonThemeId;
  rankThresholds: RankThresholds;
  missionCompletionBonus: number;
  adminPin: string;
  referralSignupBonus: number;
  referralDeposit50Bonus: number;
  referralDepositBonus: number;
  customRecentWinners: RoundWinner[] | null;
  customLeaderboard: LeaderboardEntry[] | null;
}

export interface BotSessionRecord {
  telegram_user_id: string;
  language: AppLanguage;
  pending_action: 'awaiting_deposit_voucher' | 'awaiting_deposit_proof' | 'awaiting_withdraw_info' | null;
  selected_button_id: string | null;
  selected_button_label: string | null;
  selected_bank_key: PresetBankKey | null;
  temp_voucher_code: string | null;
}

export interface AdminGroupMessageRef {
  chat_id: string;
  message_id: number;
}

export interface TransactionRecord {
  id: string;
  player_id: string;
  player_name: string;
  player_username: string | null;
  tx_type: 'deposit' | 'withdraw';
  bank_key: string | null;
  button_id: string | null;
  button_label: string | null;
  user_message: string | null;
  user_photo_file_id: string | null;
  amount_birr: number | null;
  voucher_code: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'done' | 'incorrect';
  resolved_by: string | null;
  admin_group_id: string | null;
  admin_group_message_id: number | null;
  admin_group_messages?: AdminGroupMessageRef[];
  created_at: string;
  resolved_at: string | null;
}

export interface StoredPlayerRow {
  id: string;
  name: string;
  username: string | null;
  language: AppLanguage;
  deposited_birr: number;
  won_birr: number;
  total_deposited_birr: number;
  contact_phone: string | null;
  contact_shared: boolean;
  is_banned: boolean;
  last_active_at: string;
  updated_at: string;
}

export interface ReferralRecord {
  id: string;
  referrer_id: string;
  referrer_name: string;
  referrer_username: string | null;
  referred_id: string;
  referred_name: string;
  referred_username: string | null;
  signup_bonus_birr: number;
  deposit_50_bonus_birr: number;
  deposit_50_bonus_paid: boolean;
  first_50_deposit_birr: number | null;
  deposit_50_bonus_paid_at: string | null;
  deposit_bonus_birr: number;
  deposit_bonus_paid: boolean;
  first_qualifying_deposit_birr: number | null;
  created_at: string;
  deposit_bonus_paid_at: string | null;
}

export interface BotBroadcastRecord {
  id: string;
  message_text: string;
  segment: string;
  season_theme: SeasonThemeId;
  scheduled_for: string | null;
  status: 'pending' | 'sending' | 'completed' | 'failed';
  total_count: number;
  sent_count: number;
  failed_count: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PlayerMissionProgressRow {
  progressMap: Record<string, number>;
  claimedIds: string[];
  allBonusClaimed: boolean;
}

export function parseGroupIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const cleaned = part.trim();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

function normalizeSeasonTheme(raw: unknown): SeasonThemeId {
  if (raw === 'christmas' || raw === 'enkutatash' || raw === 'golden' || raw === 'cyber') {
    return raw;
  }
  return 'none';
}

function normalizeEventTheme(raw: unknown): SpecialEventThemeId {
  const valid: SpecialEventThemeId[] = [
    'christmas',
    'enkutatash',
    'football',
    'golden',
    'cyber',
    'emerald',
    'sunset',
    'amethyst',
    'diamond_ice',
    'rose_gold',
  ];
  return valid.includes(raw as SpecialEventThemeId) ? (raw as SpecialEventThemeId) : 'golden';
}

function normalizeMissionType(raw: unknown): MissionType {
  const valid: MissionType[] = ['play_rounds', 'win_rounds', 'win_pattern', 'invite_friends', 'deposit_birr'];
  return valid.includes(raw as MissionType) ? (raw as MissionType) : 'play_rounds';
}

function parseRankThresholds(raw: unknown): RankThresholds {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RANK_THRESHOLDS };
  const obj = raw as Record<string, unknown>;
  const numOr = (k: keyof RankThresholds, fallback: number) => {
    const v = Number(obj[k]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    bronze: numOr('bronze', DEFAULT_RANK_THRESHOLDS.bronze),
    silver: numOr('silver', DEFAULT_RANK_THRESHOLDS.silver),
    gold: numOr('gold', DEFAULT_RANK_THRESHOLDS.gold),
    diamond: numOr('diamond', DEFAULT_RANK_THRESHOLDS.diamond),
    platinum: numOr('platinum', DEFAULT_RANK_THRESHOLDS.platinum),
  };
}

function buildDefaultPresetButtons(): PaymentButtonRecord[] {
  const rows: PaymentButtonRecord[] = [];
  for (const b of PRESET_BANKS) {
    rows.push({
      id: `preset_dep_${b.key}`,
      flow_type: 'deposit',
      bank_key: b.key,
      label: b.names.en,
      response_text: `Send your deposit via ${b.names.en}, then reply here with a screenshot or confirmation message.`,
      copyable_text: '',
      sort_order: b.sortOrder,
      is_active: true,
    });
  }
  for (const b of PRESET_BANKS) {
    rows.push({
      id: `preset_wd_${b.key}`,
      flow_type: 'withdraw',
      bank_key: b.key,
      label: b.names.en,
      response_text: '',
      copyable_text: '',
      sort_order: b.sortOrder,
      is_active: true,
    });
  }
  return rows;
}

class SupabaseStore {
  private client: SupabaseClient | null = null;
  public readonly isEnabled: boolean = false;

  private memConfig: BotAppConfig = {
    adminGroupId: (process.env.ADMIN_GROUP_ID || '').trim(),
    extraGroupIds: parseGroupIdList(process.env.EXTRA_ADMIN_GROUP_IDS || ''),
    extraAdminIds: [],
    depositIntroText: 'Choose a bank or wallet below to deposit:',
    withdrawIntroText: 'Choose your withdrawal bank or wallet below:',
    withdrawPromptText: 'Send your full name, account number, and the Birr amount you want to withdraw:',
    commissionPercent: Math.min(80, Math.max(0, Number(process.env.COMMISSION_PERCENT) || 20)),
    callIntervalMs: Math.max(1500, Math.round((Number(process.env.CALL_INTERVAL_SECONDS) || 3.5) * 1000)),
    maxCartelas: TOTAL_CARTELAS,
    vouchersEnabled: false,
    seasonTheme: 'none',
    rankThresholds: { ...DEFAULT_RANK_THRESHOLDS },
    missionCompletionBonus: 50,
    adminPin: (process.env.ADMIN_PIN || '1234').trim(),
    referralSignupBonus: 20,
    referralDeposit50Bonus: 20,
    referralDepositBonus: 20,
    customRecentWinners: null,
    customLeaderboard: null,
  };

  private memButtons: PaymentButtonRecord[] = buildDefaultPresetButtons();
  private memSessions = new Map<string, BotSessionRecord>();
  private memTransactions = new Map<string, TransactionRecord>();
  private memReferralsByReferred = new Map<string, ReferralRecord>();
  private memKnownPlayerIds = new Set<string>();
  private memPlayerContacts = new Map<string, boolean>();
  private memPlayerPhones = new Map<string, string>();
  private memBannedPlayers = new Set<string>();
  private memTotalDeposited = new Map<string, number>();
  private memTemplates: BotTextTemplateRecord[] = [];
  private memVouchers = new Map<string, VoucherRecord>();
  private memMissionProgress = new Map<string, PlayerMissionProgressRow>();
  private memSpecialEvents: Array<{
    id: string;
    name: string;
    description_text: string;
    theme_key: string;
    entry_birr: number;
    bonus_prize_birr: number;
    min_players: number;
    ends_at: string | null;
    is_active: boolean;
    created_at: string;
  }> = [];
  private memDailyMissions: Array<{
    id: string;
    title: string;
    mission_type: MissionType;
    target_count: number;
    pattern_filter: string;
    reward_birr: number;
    is_active: boolean;
    sort_order: number;
    created_at: string;
  }> = [];
  private memBroadcasts: BotBroadcastRecord[] = [];
  private memRounds: Array<{
    id: string;
    stake_birr: number;
    round_number: number;
    players_count: number;
    entries_count: number;
    total_pot_birr: number;
    commission_percent: number;
    commission_birr: number;
    prize_pool_birr: number;
    winners: RoundWinner[];
    called_numbers: number[];
    started_at: string | null;
    ended_at: string;
  }> = [];
  private botConfigCache: { config: BotAppConfig; buttons: PaymentButtonRecord[]; expiresAt: number } | null = null;
  private botTemplatesCache: { data: BotTextTemplateRecord[]; expiresAt: number } | null = null;

  public invalidateBotCaches() {
    this.botConfigCache = null;
    this.botTemplatesCache = null;
  }

  constructor() {
    const url = (process.env.SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (url && key) {
      this.client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.isEnabled = true;
      console.log('[Supabase] Connected via HTTPS API.');
    } else {
      console.log(
        '[Supabase] Not configured yet (running with in-memory fallback until SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are set).'
      );
    }
  }

  public getAllTargetGroupIds(config: BotAppConfig): string[] {
    const list: string[] = [];
    const seen = new Set<string>();
    const add = (id: string | undefined | null) => {
      const cleaned = (id || '').trim();
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        list.push(cleaned);
      }
    };
    add(config.adminGroupId);
    add(process.env.ADMIN_GROUP_ID);
    for (const extra of config.extraGroupIds) {
      add(extra);
    }
    return list;
  }

  private mapSpecialEventRow(row: Record<string, any>): SpecialEvent {
    return {
      id: String(row.id),
      name: String(row.name || 'Special Event'),
      descriptionText: String(row.description_text || ''),
      themeKey: normalizeEventTheme(row.theme_key),
      entryBirr: Math.max(1, Number(row.entry_birr) || 20),
      bonusPrizeBirr: Math.max(0, Number(row.bonus_prize_birr) || 0),
      minPlayers: Math.max(0, Number(row.min_players) || 0),
      endsAt: row.ends_at ? String(row.ends_at) : null,
      isActive: Boolean(row.is_active),
    };
  }

  private mapMissionRow(row: Record<string, any>): DailyMission {
    return {
      id: String(row.id),
      title: String(row.title || 'Daily Mission'),
      missionType: normalizeMissionType(row.mission_type),
      targetCount: Math.max(1, Number(row.target_count) || 1),
      patternFilter: String(row.pattern_filter || ''),
      rewardBirr: Math.max(0, Number(row.reward_birr) || 0),
      isActive: Boolean(row.is_active),
      sortOrder: Number(row.sort_order) || 0,
    };
  }

  public async loadInitialSnapshot(): Promise<{
    config: BotAppConfig;
    players: StoredPlayerRow[];
    recentRounds: Array<{ winners: RoundWinner[]; ended_at: string }>;
    specialEvents: SpecialEvent[];
    dailyMissions: DailyMission[];
  }> {
    if (!this.client) {
      const nowMs = Date.now();
      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        players: [],
        recentRounds: [],
        specialEvents: this.memSpecialEvents
          .filter((e) => e.is_active && (!e.ends_at || new Date(e.ends_at).getTime() > nowMs))
          .map((r) => this.mapSpecialEventRow(r)),
        dailyMissions: this.memDailyMissions
          .filter((m) => m.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => this.mapMissionRow(r)),
      };
    }
    try {
      const [settingsRes, playersRes, roundsRes, eventsRes, missionsRes] = await Promise.all([
        this.client.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        this.client
          .from('players')
          .select('id, name, username, language, deposited_birr, won_birr, total_deposited_birr, contact_phone, contact_shared, is_banned, last_active_at, updated_at')
          .limit(2000),
        this.client.from('rounds').select('winners, ended_at').order('ended_at', { ascending: false }).limit(30),
        this.client.from('special_events').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        this.client.from('daily_missions').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);

      if (settingsRes.data) {
        this.applySettingsRow(settingsRes.data);
      }

      const players: StoredPlayerRow[] = (playersRes.data || []).map((p) => {
        const id = String(p.id);
        this.memKnownPlayerIds.add(id);
        const contactShared = Boolean(p.contact_shared);
        const isBanned = Boolean(p.is_banned);
        const totalDep = Number(p.total_deposited_birr) || 0;
        this.memPlayerContacts.set(id, contactShared);
        if (isBanned) this.memBannedPlayers.add(id);
        this.memTotalDeposited.set(id, totalDep);
        return {
          id,
          name: String(p.name || 'Player'),
          username: p.username ? String(p.username) : null,
          language: p.language === 'am' || p.language === 'om' ? p.language : 'en',
          deposited_birr: Number(p.deposited_birr) || 0,
          won_birr: Number(p.won_birr) || 0,
          total_deposited_birr: totalDep,
          contact_phone: p.contact_phone ? String(p.contact_phone) : null,
          contact_shared: contactShared,
          is_banned: isBanned,
          last_active_at: String(p.last_active_at || p.updated_at || new Date().toISOString()),
          updated_at: String(p.updated_at || new Date().toISOString()),
        };
      });

      const recentRounds = (roundsRes.data || []).map((r) => ({
        winners: Array.isArray(r.winners) ? (r.winners as RoundWinner[]) : [],
        ended_at: String(r.ended_at),
      }));

      const nowMs = Date.now();
      const specialEvents = (eventsRes.data || [])
        .map((r) => this.mapSpecialEventRow(r))
        .filter((e) => !e.endsAt || new Date(e.endsAt).getTime() > nowMs);

      const dailyMissions = (missionsRes.data || []).map((r) => this.mapMissionRow(r));

      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        players,
        recentRounds,
        specialEvents,
        dailyMissions,
      };
    } catch (err) {
      console.error('[Supabase] Initial load error:', err);
      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        players: [],
        recentRounds: [],
        specialEvents: [],
        dailyMissions: [],
      };
    }
  }

  private applySettingsRow(s: Record<string, any>) {
    const envGroup = (process.env.ADMIN_GROUP_ID || '').trim();
    const signupBonus = Number(s.referral_signup_bonus);
    const deposit50Bonus = Number(s.referral_deposit_50_bonus);
    const depositBonus = Number(s.referral_deposit_bonus);
    const rawMaxCartelas = Number(s.max_cartelas);
    const missionBonus = Number(s.mission_completion_bonus);
    this.memConfig = {
      adminGroupId: String(s.admin_group_id || envGroup || '').trim(),
      extraGroupIds: parseGroupIdList(s.extra_group_ids ? String(s.extra_group_ids) : ''),
      extraAdminIds: parseGroupIdList(s.extra_admin_ids ? String(s.extra_admin_ids) : ''),
      depositIntroText: String(s.deposit_intro_text || this.memConfig.depositIntroText),
      withdrawIntroText: String(s.withdraw_intro_text || this.memConfig.withdrawIntroText),
      withdrawPromptText: String(s.withdraw_prompt_text || this.memConfig.withdrawPromptText),
      commissionPercent: Number.isFinite(Number(s.commission_percent))
        ? Number(s.commission_percent)
        : this.memConfig.commissionPercent,
      callIntervalMs: Number.isFinite(Number(s.call_interval_ms))
        ? Number(s.call_interval_ms)
        : this.memConfig.callIntervalMs,
      maxCartelas: Number.isFinite(rawMaxCartelas)
        ? Math.min(MAX_CARTELAS_LIMIT, Math.max(MIN_CARTELAS, Math.round(rawMaxCartelas)))
        : TOTAL_CARTELAS,
      vouchersEnabled: Boolean(s.vouchers_enabled),
      seasonTheme: normalizeSeasonTheme(s.season_theme),
      rankThresholds: parseRankThresholds(s.rank_thresholds),
      missionCompletionBonus: Number.isFinite(missionBonus) && missionBonus >= 0 ? missionBonus : 50,
      adminPin: String(s.admin_pin || this.memConfig.adminPin),
      referralSignupBonus: Number.isFinite(signupBonus) && signupBonus >= 0 ? signupBonus : 20,
      referralDeposit50Bonus: Number.isFinite(deposit50Bonus) && deposit50Bonus >= 0 ? deposit50Bonus : 20,
      referralDepositBonus: Number.isFinite(depositBonus) && depositBonus >= 0 ? depositBonus : 20,
      customRecentWinners: Array.isArray(s.custom_recent_winners)
        ? (s.custom_recent_winners as RoundWinner[])
        : null,
      customLeaderboard: Array.isArray(s.custom_leaderboard)
        ? (s.custom_leaderboard as LeaderboardEntry[])
        : null,
    };
  }

  public async getLiveHubSync(): Promise<{
    config: BotAppConfig;
    specialEvents: SpecialEvent[];
    dailyMissions: DailyMission[];
  } | null> {
    if (!this.client) return null;
    try {
      const [settingsRes, eventsRes, missionsRes] = await Promise.all([
        this.client.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        this.client.from('special_events').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        this.client.from('daily_missions').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      ]);
      if (settingsRes.data) {
        this.applySettingsRow(settingsRes.data);
      }
      const nowMs = Date.now();
      const specialEvents = (eventsRes.data || [])
        .map((r) => this.mapSpecialEventRow(r))
        .filter((e) => !e.endsAt || new Date(e.endsAt).getTime() > nowMs);
      const dailyMissions = (missionsRes.data || []).map((r) => this.mapMissionRow(r));
      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        specialEvents,
        dailyMissions,
      };
    } catch {
      return null;
    }
  }

  public async getBotConfigAndButtons(): Promise<{
    config: BotAppConfig;
    buttons: PaymentButtonRecord[];
  }> {
    if (!this.client) {
      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        buttons: this.memButtons.filter((b) => b.is_active),
      };
    }

    if (this.botConfigCache && Date.now() < this.botConfigCache.expiresAt) {
      return {
        config: {
          ...this.botConfigCache.config,
          extraGroupIds: [...this.botConfigCache.config.extraGroupIds],
          extraAdminIds: [...this.botConfigCache.config.extraAdminIds],
          rankThresholds: { ...this.botConfigCache.config.rankThresholds },
        },
        buttons: this.botConfigCache.buttons,
      };
    }

    try {
      const [settingsRes, buttonsRes] = await Promise.all([
        this.client.from('app_settings').select('*').eq('id', 1).maybeSingle(),
        this.client
          .from('payment_buttons')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      if (settingsRes.data) {
        this.applySettingsRow(settingsRes.data);
      }

      const rawButtons = buttonsRes.data || [];
      const buttons: PaymentButtonRecord[] = [];
      for (const b of rawButtons) {
        const bankKey = b.bank_key as PresetBankKey;
        if (!bankKey || !PRESET_BANKS.some((p) => p.key === bankKey)) continue;
        buttons.push({
          id: String(b.id),
          flow_type: b.flow_type === 'withdraw' ? 'withdraw' : 'deposit',
          bank_key: bankKey,
          label: String(b.label),
          response_text: String(b.response_text || ''),
          copyable_text: String(b.copyable_text || ''),
          sort_order: Number(b.sort_order) || 0,
          is_active: Boolean(b.is_active),
        });
      }

      if (buttons.length === 0) {
        return {
          config: {
            ...this.memConfig,
            extraGroupIds: [...this.memConfig.extraGroupIds],
            extraAdminIds: [...this.memConfig.extraAdminIds],
            rankThresholds: { ...this.memConfig.rankThresholds },
          },
          buttons: this.memButtons.filter((b) => b.is_active),
        };
      }

      const configCopy: BotAppConfig = {
        ...this.memConfig,
        extraGroupIds: [...this.memConfig.extraGroupIds],
        extraAdminIds: [...this.memConfig.extraAdminIds],
        rankThresholds: { ...this.memConfig.rankThresholds },
      };
      this.botConfigCache = {
        config: configCopy,
        buttons,
        expiresAt: Date.now() + 4000,
      };

      return {
        config: {
          ...configCopy,
          extraGroupIds: [...configCopy.extraGroupIds],
          extraAdminIds: [...configCopy.extraAdminIds],
          rankThresholds: { ...configCopy.rankThresholds },
        },
        buttons,
      };
    } catch (err) {
      console.error('[Supabase] getBotConfigAndButtons error:', err);
      return {
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        buttons: this.memButtons.filter((b) => b.is_active),
      };
    }
  }

  public async getBotTemplates(): Promise<BotTextTemplateRecord[]> {
    if (!this.client) return this.memTemplates;
    if (this.botTemplatesCache && Date.now() < this.botTemplatesCache.expiresAt) {
      return this.botTemplatesCache.data;
    }
    try {
      const { data } = await this.client.from('bot_text_templates').select('*');
      if (!data) return this.memTemplates;
      const mapped: BotTextTemplateRecord[] = data.map((t) => ({
        id: String(t.id),
        template_key: String(t.template_key),
        language: t.language === 'am' || t.language === 'om' ? t.language : 'en',
        title: String(t.title || t.template_key),
        message_text: String(t.message_text || ''),
        buttons_config: Array.isArray(t.buttons_config)
          ? (t.buttons_config as BotTemplateButtonConfig[])
          : [],
        is_custom: Boolean(t.is_custom),
      }));
      this.memTemplates = mapped;
      this.botTemplatesCache = { data: mapped, expiresAt: Date.now() + 4000 };
      return mapped;
    } catch {
      return this.memTemplates;
    }
  }

  public async setAdminGroupId(groupId: string) {
    this.memConfig.adminGroupId = groupId;
    this.invalidateBotCaches();
    if (!this.client) return;
    try {
      await this.client
        .from('app_settings')
        .update({ admin_group_id: groupId, updated_at: new Date().toISOString() })
        .eq('id', 1);
    } catch (err) {
      console.error('[Supabase] setAdminGroupId error:', err);
    }
  }

  public async updateHouseSettings(
    commissionPercent: number,
    callIntervalSeconds: number,
    maxCartelas?: number,
    seasonTheme?: SeasonThemeId
  ) {
    this.memConfig.commissionPercent = commissionPercent;
    this.memConfig.callIntervalMs = Math.round(callIntervalSeconds * 1000);
    if (typeof maxCartelas === 'number') {
      this.memConfig.maxCartelas = Math.min(MAX_CARTELAS_LIMIT, Math.max(MIN_CARTELAS, Math.round(maxCartelas)));
    }
    if (seasonTheme) {
      this.memConfig.seasonTheme = seasonTheme;
    }
    this.invalidateBotCaches();
    if (!this.client) return;
    try {
      const patch: Record<string, unknown> = {
        commission_percent: commissionPercent,
        call_interval_ms: Math.round(callIntervalSeconds * 1000),
        updated_at: new Date().toISOString(),
      };
      if (typeof maxCartelas === 'number') {
        patch.max_cartelas = this.memConfig.maxCartelas;
      }
      if (seasonTheme) {
        patch.season_theme = seasonTheme;
      }
      await this.client.from('app_settings').update(patch).eq('id', 1);
    } catch (err) {
      console.error('[Supabase] updateHouseSettings error:', err);
    }
  }

  public async updateExtraAdminIds(adminIds: string[]) {
    this.memConfig.extraAdminIds = [...adminIds];
    this.invalidateBotCaches();
    if (!this.client) return;
    try {
      await this.client
        .from('app_settings')
        .update({
          extra_admin_ids: adminIds.join(','),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } catch (err) {
      console.error('[Supabase] updateExtraAdminIds error:', err);
    }
  }

  public async updateCustomWinnersAndLeaderboard(
    recentWinners: RoundWinner[] | null,
    leaderboard: LeaderboardEntry[] | null
  ) {
    this.memConfig.customRecentWinners = recentWinners;
    this.memConfig.customLeaderboard = leaderboard;
    if (!this.client) return;
    try {
      await this.client
        .from('app_settings')
        .update({
          custom_recent_winners: recentWinners,
          custom_leaderboard: leaderboard,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } catch (err) {
      console.error('[Supabase] updateCustomWinnersAndLeaderboard error:', err);
    }
  }

  public async upsertPlayer(
    playerId: string,
    name: string,
    wallet: PlayerWallet,
    language?: AppLanguage,
    username?: string
  ) {
    this.memKnownPlayerIds.add(playerId);
    if (typeof wallet.totalDeposited === 'number') {
      this.memTotalDeposited.set(playerId, wallet.totalDeposited);
    }
    if (!this.client) return;
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        id: playerId,
        name: name.slice(0, 64),
        deposited_birr: wallet.depositedBalance,
        won_birr: wallet.wonBalance,
        last_active_at: now,
        updated_at: now,
      };
      if (typeof wallet.totalDeposited === 'number') {
        payload.total_deposited_birr = wallet.totalDeposited;
      }
      if (language) payload.language = language;
      if (username !== undefined) payload.username = username || null;
      await this.client.from('players').upsert(payload, { onConflict: 'id' });
    } catch (err) {
      console.error('[Supabase] upsertPlayer error:', err);
    }
  }

  public async savePlayerContact(
    playerId: string,
    phone: string,
    fullName: string,
    username?: string
  ) {
    this.memPlayerContacts.set(playerId, true);
    this.memPlayerPhones.set(playerId, phone.slice(0, 32));
    this.memKnownPlayerIds.add(playerId);
    if (!this.client) return;
    try {
      const now = new Date().toISOString();
      await this.client.from('players').upsert(
        {
          id: playerId,
          name: fullName.slice(0, 64),
          username: username || null,
          contact_phone: phone.slice(0, 32),
          contact_shared: true,
          last_active_at: now,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
    } catch (err) {
      console.error('[Supabase] savePlayerContact error:', err);
    }
  }

  public async togglePlayerBan(playerId: string, isBanned: boolean) {
    if (isBanned) this.memBannedPlayers.add(playerId);
    else this.memBannedPlayers.delete(playerId);
    if (!this.client) return;
    try {
      await this.client
        .from('players')
        .update({ is_banned: isBanned, updated_at: new Date().toISOString() })
        .eq('id', playerId);
    } catch (err) {
      console.error('[Supabase] togglePlayerBan error:', err);
    }
  }

  public async getPlayerInfo(playerId: string): Promise<{
    exists: boolean;
    name?: string;
    username?: string | null;
    language?: AppLanguage;
    contactShared?: boolean;
    isBanned?: boolean;
    totalDeposited?: number;
  }> {
    if (this.client) {
      try {
        const { data } = await this.client
          .from('players')
          .select('id, name, username, language, contact_shared, is_banned, total_deposited_birr')
          .eq('id', playerId)
          .maybeSingle();
        if (data) {
          this.memKnownPlayerIds.add(playerId);
          this.memPlayerContacts.set(playerId, Boolean(data.contact_shared));
          if (data.is_banned) this.memBannedPlayers.add(playerId);
          else this.memBannedPlayers.delete(playerId);
          const totalDep = Number(data.total_deposited_birr) || 0;
          this.memTotalDeposited.set(playerId, totalDep);
          return {
            exists: true,
            name: String(data.name || 'Player'),
            username: data.username ? String(data.username) : null,
            language: data.language === 'am' || data.language === 'om' ? data.language : 'en',
            contactShared: Boolean(data.contact_shared),
            isBanned: Boolean(data.is_banned),
            totalDeposited: totalDep,
          };
        }
        return { exists: false, contactShared: false, isBanned: false, totalDeposited: 0 };
      } catch {
        // fallback to memory
      }
    }
    return {
      exists: this.memKnownPlayerIds.has(playerId),
      contactShared: this.memPlayerContacts.get(playerId) || false,
      isBanned: this.memBannedPlayers.has(playerId),
      totalDeposited: this.memTotalDeposited.get(playerId) || 0,
    };
  }

  public async setPlayerLanguage(playerId: string, language: AppLanguage) {
    if (!this.client) return;
    try {
      await this.client
        .from('players')
        .update({ language, updated_at: new Date().toISOString() })
        .eq('id', playerId);
    } catch (err) {
      console.error('[Supabase] setPlayerLanguage error:', err);
    }
  }

  public async fetchRecentlyUpdatedPlayers(sinceIso: string): Promise<StoredPlayerRow[]> {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('players')
        .select('id, name, username, language, deposited_birr, won_birr, total_deposited_birr, contact_phone, contact_shared, is_banned, last_active_at, updated_at')
        .gt('updated_at', sinceIso)
        .limit(200);
      if (error || !data) return [];
      return data.map((p) => {
        const id = String(p.id);
        if (p.is_banned) this.memBannedPlayers.add(id);
        else this.memBannedPlayers.delete(id);
        return {
          id,
          name: String(p.name || 'Player'),
          username: p.username ? String(p.username) : null,
          language: p.language === 'am' || p.language === 'om' ? p.language : 'en',
          deposited_birr: Number(p.deposited_birr) || 0,
          won_birr: Number(p.won_birr) || 0,
          total_deposited_birr: Number(p.total_deposited_birr) || 0,
          contact_phone: p.contact_phone ? String(p.contact_phone) : null,
          contact_shared: Boolean(p.contact_shared),
          is_banned: Boolean(p.is_banned),
          last_active_at: String(p.last_active_at || p.updated_at),
          updated_at: String(p.updated_at),
        };
      });
    } catch {
      return [];
    }
  }

  public async recordRound(params: {
    stakeBirr: number;
    roundNumber: number;
    playersCount: number;
    entriesCount: number;
    totalPotBirr: number;
    commissionPercent: number;
    commissionBirr: number;
    prizePoolBirr: number;
    winners: RoundWinner[];
    calledNumbers: number[];
    startedAtMs: number;
    endedAtMs: number;
  }) {
    const rec = {
      id: `rnd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      stake_birr: params.stakeBirr,
      round_number: params.roundNumber,
      players_count: params.playersCount,
      entries_count: params.entriesCount,
      total_pot_birr: params.totalPotBirr,
      commission_percent: params.commissionPercent,
      commission_birr: params.commissionBirr,
      prize_pool_birr: params.prizePoolBirr,
      winners: params.winners,
      called_numbers: params.calledNumbers,
      started_at: new Date(params.startedAtMs).toISOString(),
      ended_at: new Date(params.endedAtMs).toISOString(),
    };
    this.memRounds.unshift(rec);
    if (this.memRounds.length > 200) this.memRounds.length = 200;
    if (!this.client) return;
    try {
      await this.client.from('rounds').insert({
        stake_birr: params.stakeBirr,
        round_number: params.roundNumber,
        players_count: params.playersCount,
        entries_count: params.entriesCount,
        total_pot_birr: params.totalPotBirr,
        commission_percent: params.commissionPercent,
        commission_birr: params.commissionBirr,
        prize_pool_birr: params.prizePoolBirr,
        winners: params.winners,
        called_numbers: params.calledNumbers,
        started_at: new Date(params.startedAtMs).toISOString(),
        ended_at: new Date(params.endedAtMs).toISOString(),
      });
    } catch (err) {
      console.error('[Supabase] recordRound error:', err);
    }
  }

  public async getBotSession(tgUserId: string): Promise<BotSessionRecord> {
    const fallback = this.memSessions.get(tgUserId) || {
      telegram_user_id: tgUserId,
      language: 'en' as AppLanguage,
      pending_action: null,
      selected_button_id: null,
      selected_button_label: null,
      selected_bank_key: null,
      temp_voucher_code: null,
    };
    if (!this.client) return fallback;
    try {
      const { data } = await this.client
        .from('bot_sessions')
        .select('*')
        .eq('telegram_user_id', tgUserId)
        .maybeSingle();
      if (!data) return fallback;
      const rec: BotSessionRecord = {
        telegram_user_id: tgUserId,
        language: data.language === 'am' || data.language === 'om' ? data.language : 'en',
        pending_action:
          data.pending_action === 'awaiting_deposit_voucher' ||
          data.pending_action === 'awaiting_deposit_proof' ||
          data.pending_action === 'awaiting_withdraw_info'
            ? data.pending_action
            : null,
        selected_button_id: data.selected_button_id ? String(data.selected_button_id) : null,
        selected_button_label: data.selected_button_label ? String(data.selected_button_label) : null,
        selected_bank_key: (data.selected_bank_key as PresetBankKey) || null,
        temp_voucher_code: data.temp_voucher_code ? String(data.temp_voucher_code) : null,
      };
      this.memSessions.set(tgUserId, rec);
      return rec;
    } catch {
      return fallback;
    }
  }

  public async saveBotSession(session: BotSessionRecord) {
    this.memSessions.set(session.telegram_user_id, session);
    if (!this.client) return;
    try {
      await this.client.from('bot_sessions').upsert(
        {
          telegram_user_id: session.telegram_user_id,
          language: session.language,
          pending_action: session.pending_action,
          selected_button_id: this.isUuid(session.selected_button_id) ? session.selected_button_id : null,
          selected_button_label: session.selected_button_label,
          selected_bank_key: session.selected_bank_key,
          temp_voucher_code: session.temp_voucher_code,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_user_id' }
      );
    } catch (err) {
      console.error('[Supabase] saveBotSession error:', err);
    }
  }

  private isUuid(val: string | null): boolean {
    return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  }

  // --- Vouchers ---

  public async getActiveVoucherByCode(code: string): Promise<VoucherRecord | null> {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    if (!this.client) {
      const mem = this.memVouchers.get(clean);
      return mem && mem.is_active ? mem : null;
    }
    try {
      const { data } = await this.client
        .from('vouchers')
        .select('*')
        .eq('code', clean)
        .eq('is_active', true)
        .maybeSingle();
      if (!data) return null;
      return {
        id: String(data.id),
        code: String(data.code),
        bonus_birr: Number(data.bonus_birr) || 0,
        creator_name: String(data.creator_name || 'Admin'),
        is_active: Boolean(data.is_active),
        uses_count: Number(data.uses_count) || 0,
        total_deposited_birr: Number(data.total_deposited_birr) || 0,
        created_at: String(data.created_at),
      };
    } catch {
      return null;
    }
  }

  public async recordVoucherDepositUse(code: string, depositBirr: number): Promise<VoucherRecord | null> {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    const existing = await this.getActiveVoucherByCode(clean);
    if (!existing) return null;

    if (!this.client) {
      const updated = {
        ...existing,
        uses_count: existing.uses_count + 1,
        total_deposited_birr: existing.total_deposited_birr + depositBirr,
      };
      this.memVouchers.set(clean, updated);
      return updated;
    }

    try {
      const { data } = await this.client
        .from('vouchers')
        .update({
          uses_count: existing.uses_count + 1,
          total_deposited_birr: existing.total_deposited_birr + depositBirr,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      return (data as VoucherRecord) || existing;
    } catch {
      return existing;
    }
  }

  // --- Transactions ---

  public async createTransaction(input: {
    playerId: string;
    playerName: string;
    playerUsername: string | null;
    txType: 'deposit' | 'withdraw';
    bankKey: string | null;
    buttonId: string | null;
    buttonLabel: string | null;
    userMessage: string | null;
    userPhotoFileId: string | null;
    adminGroupId: string | null;
    voucherCode?: string | null;
  }): Promise<TransactionRecord> {
    const fallback: TransactionRecord = {
      id: crypto.randomUUID(),
      player_id: input.playerId,
      player_name: input.playerName,
      player_username: input.playerUsername,
      tx_type: input.txType,
      bank_key: input.bankKey,
      button_id: input.buttonId,
      button_label: input.buttonLabel,
      user_message: input.userMessage,
      user_photo_file_id: input.userPhotoFileId,
      amount_birr: null,
      voucher_code: input.voucherCode || null,
      status: 'pending',
      resolved_by: null,
      admin_group_id: input.adminGroupId,
      admin_group_message_id: null,
      admin_group_messages: [],
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    this.memTransactions.set(fallback.id, fallback);

    if (!this.client) return fallback;
    try {
      const { data, error } = await this.client
        .from('transactions')
        .insert({
          player_id: input.playerId,
          player_name: input.playerName,
          player_username: input.playerUsername,
          tx_type: input.txType,
          bank_key: input.bankKey,
          button_id: this.isUuid(input.buttonId) ? input.buttonId : null,
          button_label: input.buttonLabel,
          user_message: input.userMessage,
          user_photo_file_id: input.userPhotoFileId,
          voucher_code: input.voucherCode || null,
          status: 'pending',
          admin_group_id: input.adminGroupId,
        })
        .select('*')
        .single();

      if (!error && data) {
        const rec = data as TransactionRecord;
        this.memTransactions.set(rec.id, rec);
        return rec;
      }
    } catch (err) {
      console.error('[Supabase] createTransaction error:', err);
    }
    return fallback;
  }

  public async getTransaction(id: string): Promise<TransactionRecord | null> {
    if (this.client) {
      try {
        const { data } = await this.client.from('transactions').select('*').eq('id', id).maybeSingle();
        if (data) return data as TransactionRecord;
      } catch {
        // fallback to memory
      }
    }
    return this.memTransactions.get(id) || null;
  }

  public async updateTransaction(
    id: string,
    patch: Partial<{
      status: TransactionRecord['status'];
      amount_birr: number | null;
      resolved_by: string | null;
      admin_group_message_id: number | null;
      admin_group_messages: AdminGroupMessageRef[];
      resolved_at: string | null;
    }>
  ) {
    const existing = this.memTransactions.get(id);
    if (existing) {
      this.memTransactions.set(id, { ...existing, ...patch });
    }
    if (!this.client) return;
    try {
      await this.client.from('transactions').update(patch).eq('id', id);
    } catch (err) {
      console.error('[Supabase] updateTransaction error:', err);
    }
  }

  // --- Player Daily Missions Progress ---

  public async getPlayerMissionProgress(playerId: string, missionDate: string): Promise<PlayerMissionProgressRow> {
    const cacheKey = `${playerId}::${missionDate}`;
    const mem = this.memMissionProgress.get(cacheKey) || {
      progressMap: {},
      claimedIds: [],
      allBonusClaimed: false,
    };
    if (!this.client) return { progressMap: { ...mem.progressMap }, claimedIds: [...mem.claimedIds], allBonusClaimed: mem.allBonusClaimed };
    try {
      const { data } = await this.client
        .from('player_mission_progress')
        .select('progress_map, claimed_ids, all_bonus_claimed')
        .eq('player_id', playerId)
        .eq('mission_date', missionDate)
        .maybeSingle();
      if (!data) return mem;
      const row: PlayerMissionProgressRow = {
        progressMap:
          data.progress_map && typeof data.progress_map === 'object'
            ? (data.progress_map as Record<string, number>)
            : {},
        claimedIds: Array.isArray(data.claimed_ids) ? (data.claimed_ids as string[]) : [],
        allBonusClaimed: Boolean(data.all_bonus_claimed),
      };
      this.memMissionProgress.set(cacheKey, row);
      return row;
    } catch {
      return mem;
    }
  }

  public async incrementPlayerMissionProgress(
    playerId: string,
    missionDate: string,
    increments: Record<string, number>
  ): Promise<PlayerMissionProgressRow> {
    const current = await this.getPlayerMissionProgress(playerId, missionDate);
    const nextMap = { ...current.progressMap };
    for (const [mId, delta] of Object.entries(increments)) {
      nextMap[mId] = (Number(nextMap[mId]) || 0) + delta;
    }
    const nextRow: PlayerMissionProgressRow = {
      progressMap: nextMap,
      claimedIds: [...current.claimedIds],
      allBonusClaimed: current.allBonusClaimed,
    };
    this.memMissionProgress.set(`${playerId}::${missionDate}`, nextRow);

    if (this.client) {
      try {
        await this.client.from('player_mission_progress').upsert(
          {
            player_id: playerId,
            mission_date: missionDate,
            progress_map: nextRow.progressMap,
            claimed_ids: nextRow.claimedIds,
            all_bonus_claimed: nextRow.allBonusClaimed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'player_id,mission_date' }
        );
      } catch (err) {
        console.error('[Supabase] incrementPlayerMissionProgress error:', err);
      }
    }
    return nextRow;
  }

  public async savePlayerMissionClaims(
    playerId: string,
    missionDate: string,
    progress: PlayerMissionProgressRow
  ) {
    this.memMissionProgress.set(`${playerId}::${missionDate}`, progress);
    if (!this.client) return;
    try {
      await this.client.from('player_mission_progress').upsert(
        {
          player_id: playerId,
          mission_date: missionDate,
          progress_map: progress.progressMap,
          claimed_ids: progress.claimedIds,
          all_bonus_claimed: progress.allBonusClaimed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'player_id,mission_date' }
      );
    } catch (err) {
      console.error('[Supabase] savePlayerMissionClaims error:', err);
    }
  }

  // --- Referrals ---

  public async getReferralByReferredId(referredId: string): Promise<ReferralRecord | null> {
    const mem = this.memReferralsByReferred.get(referredId);
    if (!this.client) return mem || null;
    try {
      const { data } = await this.client
        .from('referrals')
        .select('*')
        .eq('referred_id', referredId)
        .maybeSingle();
      if (data) {
        const rec = data as ReferralRecord;
        this.memReferralsByReferred.set(referredId, rec);
        return rec;
      }
      return null;
    } catch {
      return mem || null;
    }
  }

  public async createReferral(input: {
    referrerId: string;
    referrerName: string;
    referrerUsername: string | null;
    referredId: string;
    referredName: string;
    referredUsername: string | null;
    signupBonusBirr: number;
  }): Promise<ReferralRecord | null> {
    if (this.memReferralsByReferred.has(input.referredId)) return null;

    const fallback: ReferralRecord = {
      id: crypto.randomUUID(),
      referrer_id: input.referrerId,
      referrer_name: input.referrerName,
      referrer_username: input.referrerUsername,
      referred_id: input.referredId,
      referred_name: input.referredName,
      referred_username: input.referredUsername,
      signup_bonus_birr: input.signupBonusBirr,
      deposit_50_bonus_birr: 0,
      deposit_50_bonus_paid: false,
      first_50_deposit_birr: null,
      deposit_50_bonus_paid_at: null,
      deposit_bonus_birr: 0,
      deposit_bonus_paid: false,
      first_qualifying_deposit_birr: null,
      created_at: new Date().toISOString(),
      deposit_bonus_paid_at: null,
    };

    if (!this.client) {
      this.memReferralsByReferred.set(input.referredId, fallback);
      return fallback;
    }

    try {
      const { data, error } = await this.client
        .from('referrals')
        .insert({
          referrer_id: input.referrerId,
          referrer_name: input.referrerName,
          referrer_username: input.referrerUsername,
          referred_id: input.referredId,
          referred_name: input.referredName,
          referred_username: input.referredUsername,
          signup_bonus_birr: input.signupBonusBirr,
          deposit_50_bonus_birr: 0,
          deposit_50_bonus_paid: false,
          deposit_bonus_birr: 0,
          deposit_bonus_paid: false,
        })
        .select('*')
        .single();

      if (error || !data) {
        return null;
      }
      const rec = data as ReferralRecord;
      this.memReferralsByReferred.set(input.referredId, rec);
      return rec;
    } catch {
      return null;
    }
  }

  public async markReferralDeposit50BonusPaid(
    referredId: string,
    deposit50BonusBirr: number,
    qualifyingDepositBirr: number
  ): Promise<ReferralRecord | null> {
    const existing = await this.getReferralByReferredId(referredId);
    if (!existing || existing.deposit_50_bonus_paid || existing.deposit_bonus_paid) return null;

    const now = new Date().toISOString();
    const updated: ReferralRecord = {
      ...existing,
      deposit_50_bonus_birr: deposit50BonusBirr,
      deposit_50_bonus_paid: true,
      first_50_deposit_birr: qualifyingDepositBirr,
      deposit_50_bonus_paid_at: now,
    };
    this.memReferralsByReferred.set(referredId, updated);

    if (!this.client) return updated;
    try {
      const { data, error } = await this.client
        .from('referrals')
        .update({
          deposit_50_bonus_birr: deposit50BonusBirr,
          deposit_50_bonus_paid: true,
          first_50_deposit_birr: qualifyingDepositBirr,
          deposit_50_bonus_paid_at: now,
        })
        .eq('referred_id', referredId)
        .eq('deposit_50_bonus_paid', false)
        .eq('deposit_bonus_paid', false)
        .select('*')
        .maybeSingle();

      if (error || !data) return null;
      const rec = data as ReferralRecord;
      this.memReferralsByReferred.set(referredId, rec);
      return rec;
    } catch (err) {
      console.error('[Supabase] markReferralDeposit50BonusPaid error:', err);
      return null;
    }
  }

  public async markReferralDepositBonusPaid(
    referredId: string,
    depositBonusBirr: number,
    qualifyingDepositBirr: number
  ): Promise<ReferralRecord | null> {
    const existing = await this.getReferralByReferredId(referredId);
    if (!existing || existing.deposit_bonus_paid) return null;

    const now = new Date().toISOString();
    const updated: ReferralRecord = {
      ...existing,
      deposit_bonus_birr: depositBonusBirr,
      deposit_bonus_paid: true,
      first_qualifying_deposit_birr: qualifyingDepositBirr,
      deposit_bonus_paid_at: now,
    };
    this.memReferralsByReferred.set(referredId, updated);

    if (!this.client) return updated;
    try {
      const { data, error } = await this.client
        .from('referrals')
        .update({
          deposit_bonus_birr: depositBonusBirr,
          deposit_bonus_paid: true,
          first_qualifying_deposit_birr: qualifyingDepositBirr,
          deposit_bonus_paid_at: now,
        })
        .eq('referred_id', referredId)
        .eq('deposit_bonus_paid', false)
        .select('*')
        .maybeSingle();

      if (error || !data) return null;
      const rec = data as ReferralRecord;
      this.memReferralsByReferred.set(referredId, rec);
      return rec;
    } catch (err) {
      console.error('[Supabase] markReferralDepositBonusPaid error:', err);
      return null;
    }
  }

  public async getReferralStatsForUser(referrerId: string): Promise<{ invitedCount: number; earnedBirr: number }> {
    if (!this.client) {
      let invitedCount = 0;
      let earnedBirr = 0;
      for (const r of this.memReferralsByReferred.values()) {
        if (r.referrer_id === referrerId) {
          invitedCount += 1;
          earnedBirr +=
            Number(r.signup_bonus_birr || 0) +
            Number(r.deposit_50_bonus_birr || 0) +
            Number(r.deposit_bonus_birr || 0);
        }
      }
      return { invitedCount, earnedBirr };
    }

    try {
      const { data } = await this.client
        .from('referrals')
        .select('signup_bonus_birr, deposit_50_bonus_birr, deposit_bonus_birr')
        .eq('referrer_id', referrerId);
      const rows = data || [];
      let earnedBirr = 0;
      for (const r of rows) {
        earnedBirr +=
          Number(r.signup_bonus_birr || 0) +
          Number(r.deposit_50_bonus_birr || 0) +
          Number(r.deposit_bonus_birr || 0);
      }
      return { invitedCount: rows.length, earnedBirr };
    } catch {
      return { invitedCount: 0, earnedBirr: 0 };
    }
  }

  // --- Broadcast Queue & Targeted Recipients ---

  public async fetchPendingBroadcasts(): Promise<BotBroadcastRecord[]> {
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('bot_broadcasts')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);
      if (error || !data) return [];
      const nowMs = Date.now();
      return (data as BotBroadcastRecord[]).filter((b) => {
        if (!b.scheduled_for) return true;
        return new Date(b.scheduled_for).getTime() <= nowMs;
      });
    } catch {
      return [];
    }
  }

  public async updateBroadcast(
    id: string,
    patch: Partial<{
      status: BotBroadcastRecord['status'];
      total_count: number;
      sent_count: number;
      failed_count: number;
      error_message: string | null;
      completed_at: string | null;
    }>
  ) {
    if (!this.client) return;
    try {
      await this.client.from('bot_broadcasts').update(patch).eq('id', id);
    } catch (err) {
      console.error('[Supabase] updateBroadcast error:', err);
    }
  }

  public async listSegmentedTelegramUserIds(inMemoryPlayerIds: string[], segment = 'all'): Promise<string[]> {
    const ids = new Set<string>();
    const addRaw = (raw: string | null | undefined) => {
      if (!raw) return;
      const cleaned = raw.replace(/^tg_/, '').trim();
      if (/^\d+$/.test(cleaned) && !this.memBannedPlayers.has(`tg_${cleaned}`)) {
        ids.add(cleaned);
      }
    };

    if (segment === 'all') {
      for (const id of inMemoryPlayerIds) addRaw(id);
      for (const sessId of this.memSessions.keys()) addRaw(sessId);
    }

    if (this.client) {
      try {
        const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        let query = this.client
          .from('players')
          .select('id, language, is_banned, last_active_at, updated_at')
          .like('id', 'tg_%')
          .eq('is_banned', false)
          .limit(10000);

        if (segment === 'en' || segment === 'am' || segment === 'om') {
          query = query.eq('language', segment);
        }

        const { data: playerRows } = await query;
        for (const p of playerRows || []) {
          const activeTs = String(p.last_active_at || p.updated_at || '');
          if (segment === 'active' && activeTs < sevenDaysAgoIso) continue;
          if (segment === 'inactive' && activeTs >= sevenDaysAgoIso) continue;
          addRaw(String(p.id));
        }

        if (segment === 'all') {
          const { data: sessRows } = await this.client
            .from('bot_sessions')
            .select('telegram_user_id')
            .limit(10000);
          for (const s of sessRows || []) {
            addRaw(String(s.telegram_user_id));
          }
        }
      } catch (err) {
        console.error('[Supabase] listSegmentedTelegramUserIds error:', err);
      }
    }

    return Array.from(ids);
  }

  // --- Unified Admin Dashboard RPC Bridge (Supabase when connected, live local fallback in preview) ---

  public async executeAdminRpc(
    fnName: string,
    params: Record<string, any>,
    ctx: {
      expectedPin: string;
      getLivePlayers: () => Array<{
        id: string;
        name: string;
        username: string | null;
        language: AppLanguage;
        deposited_birr: number;
        won_birr: number;
        total_deposited_birr: number;
        is_banned: boolean;
        updated_at: string;
      }>;
      onSyncFromMem: (next: {
        config: BotAppConfig;
        specialEvents: SpecialEvent[];
        dailyMissions: DailyMission[];
      }) => void;
      onAdjustPlayerBalance: (playerId: string, depDelta: number, wonDelta: number) => void;
      onTogglePlayerBan: (playerId: string, isBanned: boolean) => void;
      onClearScope: (scope: string) => void;
    }
  ): Promise<{ data?: any; error?: string; status?: number }> {
    const providedPin = String(params?.p_pin ?? '');
    if (this.client) {
      try {
        const { data, error } = await this.client.rpc(fnName, params);
        if (error) {
          return { error: error.message || 'Supabase RPC error.', status: 400 };
        }
        if (fnName !== 'admin_get_dashboard') {
          this.invalidateBotCaches();
        }
        return { data: data ?? true };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Supabase RPC request failed.', status: 500 };
      }
    }

    if (providedPin !== ctx.expectedPin && providedPin !== this.memConfig.adminPin) {
      return { error: 'Invalid Admin PIN.', status: 401 };
    }

    const now = new Date().toISOString();
    const pushSync = () => {
      const nowMs = Date.now();
      ctx.onSyncFromMem({
        config: {
          ...this.memConfig,
          extraGroupIds: [...this.memConfig.extraGroupIds],
          extraAdminIds: [...this.memConfig.extraAdminIds],
          rankThresholds: { ...this.memConfig.rankThresholds },
        },
        specialEvents: this.memSpecialEvents
          .filter((e) => e.is_active && (!e.ends_at || new Date(e.ends_at).getTime() > nowMs))
          .map((r) => this.mapSpecialEventRow(r)),
        dailyMissions: this.memDailyMissions
          .filter((m) => m.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => this.mapMissionRow(r)),
      });
    };

    switch (fnName) {
      case 'admin_get_dashboard': {
        const livePlayers = ctx.getLivePlayers();
        const txs = Array.from(this.memTransactions.values()).sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        );
        const refs = Array.from(this.memReferralsByReferred.values()).sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        );
        const vouchers = Array.from(this.memVouchers.values());
        const snapshot = {
          settings: {
            id: 1,
            admin_group_id: this.memConfig.adminGroupId,
            extra_group_ids: this.memConfig.extraGroupIds.join(', '),
            extra_admin_ids: this.memConfig.extraAdminIds.join(', '),
            deposit_intro_text: this.memConfig.depositIntroText,
            withdraw_intro_text: this.memConfig.withdrawIntroText,
            withdraw_prompt_text: this.memConfig.withdrawPromptText,
            commission_percent: this.memConfig.commissionPercent,
            call_interval_ms: this.memConfig.callIntervalMs,
            max_cartelas: this.memConfig.maxCartelas,
            vouchers_enabled: this.memConfig.vouchersEnabled,
            season_theme: this.memConfig.seasonTheme,
            rank_thresholds: { ...this.memConfig.rankThresholds },
            mission_completion_bonus: this.memConfig.missionCompletionBonus,
            referral_signup_bonus: this.memConfig.referralSignupBonus,
            referral_deposit_50_bonus: this.memConfig.referralDeposit50Bonus,
            referral_deposit_bonus: this.memConfig.referralDepositBonus,
            updated_at: now,
          },
          payment_buttons: this.memButtons.map((b) => ({ ...b, created_at: now })),
          vouchers,
          bot_text_templates: this.memTemplates.map((t) => ({ ...t, updated_at: now })),
          special_events: [...this.memSpecialEvents],
          daily_missions: [...this.memDailyMissions].sort((a, b) => a.sort_order - b.sort_order),
          players: livePlayers.map((p) => ({
            ...p,
            contact_phone: this.memPlayerPhones.get(p.id) || null,
            contact_shared: this.memPlayerContacts.get(p.id) || false,
            last_active_at: p.updated_at,
            created_at: p.updated_at,
          })),
          rounds: [...this.memRounds],
          transactions: txs,
          referrals: refs,
          broadcasts: [...this.memBroadcasts],
          stats: {
            totalRounds: this.memRounds.length,
            totalCommissionBirr: this.memRounds.reduce((s, r) => s + Number(r.commission_birr || 0), 0),
            totalPotBirr: this.memRounds.reduce((s, r) => s + Number(r.total_pot_birr || 0), 0),
            totalPlayers: livePlayers.length,
            bannedPlayers: livePlayers.filter((p) => p.is_banned).length,
            totalDepositedBalance: livePlayers.reduce((s, p) => s + Number(p.deposited_birr || 0), 0),
            totalWonBalance: livePlayers.reduce((s, p) => s + Number(p.won_birr || 0), 0),
            acceptedDepositsBirr: txs
              .filter((t) => t.tx_type === 'deposit' && t.status === 'accepted')
              .reduce((s, t) => s + Number(t.amount_birr || 0), 0),
            completedWithdrawalsBirr: txs
              .filter((t) => t.tx_type === 'withdraw' && t.status === 'done')
              .reduce((s, t) => s + Number(t.amount_birr || 0), 0),
            pendingRequests: txs.filter((t) => t.status === 'pending').length,
            totalReferrals: refs.length,
            qualified50Deposits: refs.filter((r) => r.deposit_50_bonus_paid).length,
            qualifiedReferralDeposits: refs.filter((r) => r.deposit_bonus_paid).length,
            totalReferralBonusesBirr: refs.reduce(
              (s, r) =>
                s +
                Number(r.signup_bonus_birr || 0) +
                Number(r.deposit_50_bonus_birr || 0) +
                Number(r.deposit_bonus_birr || 0),
              0
            ),
            totalVouchers: vouchers.length,
            totalVoucherUses: vouchers.reduce((s, v) => s + Number(v.uses_count || 0), 0),
            totalVoucherDepositedBirr: vouchers.reduce(
              (s, v) => s + Number(v.total_deposited_birr || 0),
              0
            ),
          },
        };
        return { data: snapshot };
      }

      case 'admin_update_settings': {
        if (typeof params.p_admin_group_id === 'string') {
          this.memConfig.adminGroupId = params.p_admin_group_id.trim();
        }
        if (typeof params.p_extra_group_ids === 'string') {
          this.memConfig.extraGroupIds = parseGroupIdList(params.p_extra_group_ids);
        }
        if (typeof params.p_extra_admin_ids === 'string') {
          this.memConfig.extraAdminIds = parseGroupIdList(params.p_extra_admin_ids);
        }
        if (typeof params.p_deposit_intro === 'string') {
          this.memConfig.depositIntroText = params.p_deposit_intro;
        }
        if (typeof params.p_withdraw_intro === 'string') {
          this.memConfig.withdrawIntroText = params.p_withdraw_intro;
        }
        if (typeof params.p_withdraw_prompt === 'string') {
          this.memConfig.withdrawPromptText = params.p_withdraw_prompt;
        }
        if (typeof params.p_max_cartelas === 'number' && Number.isFinite(params.p_max_cartelas)) {
          this.memConfig.maxCartelas = Math.min(MAX_CARTELAS_LIMIT, Math.max(MIN_CARTELAS, Math.round(params.p_max_cartelas)));
        }
        if (typeof params.p_vouchers_enabled === 'boolean') {
          this.memConfig.vouchersEnabled = params.p_vouchers_enabled;
        }
        if (typeof params.p_season_theme === 'string') {
          this.memConfig.seasonTheme = normalizeSeasonTheme(params.p_season_theme);
        }
        if (typeof params.p_new_pin === 'string' && params.p_new_pin.trim()) {
          this.memConfig.adminPin = params.p_new_pin.trim();
        }
        pushSync();
        return { data: true };
      }

      case 'admin_update_bank_message': {
        const btn = this.memButtons.find((b) => b.id === String(params.p_id));
        if (!btn) return { error: 'Bank button not found.', status: 404 };
        if (typeof params.p_response_text === 'string') btn.response_text = params.p_response_text;
        if (typeof params.p_is_active === 'boolean') btn.is_active = params.p_is_active;
        if (typeof params.p_copyable_text === 'string') btn.copyable_text = params.p_copyable_text;
        return { data: true };
      }

      case 'admin_adjust_player_balance': {
        ctx.onAdjustPlayerBalance(
          String(params.p_player_id),
          Number(params.p_deposited_delta || 0),
          Number(params.p_won_delta || 0)
        );
        return { data: true };
      }

      case 'admin_toggle_player_ban': {
        const pid = String(params.p_player_id);
        const isBanned = Boolean(params.p_is_banned);
        if (isBanned) this.memBannedPlayers.add(pid);
        else this.memBannedPlayers.delete(pid);
        ctx.onTogglePlayerBan(pid, isBanned);
        return { data: true };
      }

      case 'admin_toggle_vouchers': {
        this.memConfig.vouchersEnabled = Boolean(params.p_enabled);
        return { data: true };
      }

      case 'admin_upsert_voucher': {
        const code = String(params.p_code || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '');
        if (!code) return { error: 'Voucher code is required.', status: 400 };
        const existing = this.memVouchers.get(code);
        this.memVouchers.set(code, {
          id: existing?.id || `vch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          code,
          bonus_birr: Math.max(0, Number(params.p_bonus_birr) || 0),
          creator_name: String(params.p_creator_name || '').trim() || 'Admin',
          is_active: params.p_is_active !== false,
          uses_count: existing?.uses_count || 0,
          total_deposited_birr: existing?.total_deposited_birr || 0,
          created_at: existing?.created_at || now,
        });
        return { data: true };
      }

      case 'admin_delete_voucher': {
        const targetId = String(params.p_id || '');
        for (const [k, v] of this.memVouchers.entries()) {
          if (v.id === targetId || k === targetId) this.memVouchers.delete(k);
        }
        return { data: true };
      }

      case 'admin_upsert_bot_template': {
        const key = String(params.p_template_key || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, '_');
        if (!key) return { error: 'Template key required.', status: 400 };
        const lang: AppLanguage =
          params.p_language === 'am' || params.p_language === 'om' ? params.p_language : 'en';
        const buttons = Array.isArray(params.p_buttons_config) ? params.p_buttons_config : [];
        const existing = this.memTemplates.find((t) => t.template_key === key && t.language === lang);
        if (existing) {
          existing.title = String(params.p_title || existing.title);
          existing.message_text = String(params.p_message_text ?? '');
          existing.buttons_config = buttons;
          existing.is_custom = Boolean(params.p_is_custom);
        } else {
          this.memTemplates.push({
            id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            template_key: key,
            language: lang,
            title: String(params.p_title || key),
            message_text: String(params.p_message_text ?? ''),
            buttons_config: buttons,
            is_custom: Boolean(params.p_is_custom),
          });
        }
        return { data: true };
      }

      case 'admin_delete_bot_template': {
        const key = String(params.p_template_key || '');
        this.memTemplates = this.memTemplates.filter((t) => t.template_key !== key);
        return { data: true };
      }

      case 'admin_upsert_special_event': {
        const id = params.p_id ? String(params.p_id) : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const existingIdx = this.memSpecialEvents.findIndex((e) => e.id === id);
        const rec = {
          id,
          name: String(params.p_name || 'Special Event'),
          description_text: String(params.p_description_text || ''),
          theme_key: normalizeEventTheme(params.p_theme_key),
          entry_birr: Math.max(1, Number(params.p_entry_birr) || 20),
          bonus_prize_birr: Math.max(0, Number(params.p_bonus_prize_birr) || 0),
          min_players: Math.max(0, Math.floor(Number(params.p_min_players) || 0)),
          ends_at: params.p_ends_at ? String(params.p_ends_at) : null,
          is_active: params.p_is_active !== false,
          created_at: existingIdx >= 0 ? this.memSpecialEvents[existingIdx].created_at : now,
        };
        if (existingIdx >= 0) this.memSpecialEvents[existingIdx] = rec;
        else this.memSpecialEvents.unshift(rec);
        pushSync();
        return { data: id };
      }

      case 'admin_delete_special_event': {
        const id = String(params.p_id || '');
        this.memSpecialEvents = this.memSpecialEvents.filter((e) => e.id !== id);
        pushSync();
        return { data: true };
      }

      case 'admin_upsert_mission': {
        const id = params.p_id ? String(params.p_id) : `msn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const existingIdx = this.memDailyMissions.findIndex((m) => m.id === id);
        const rec = {
          id,
          title: String(params.p_title || 'Daily Mission'),
          mission_type: normalizeMissionType(params.p_mission_type),
          target_count: Math.max(1, Math.floor(Number(params.p_target_count) || 1)),
          pattern_filter: String(params.p_pattern_filter || ''),
          reward_birr: Math.max(0, Number(params.p_reward_birr) || 0),
          is_active: params.p_is_active !== false,
          sort_order: Math.max(0, Math.floor(Number(params.p_sort_order) || 0)),
          created_at: existingIdx >= 0 ? this.memDailyMissions[existingIdx].created_at : now,
        };
        if (existingIdx >= 0) this.memDailyMissions[existingIdx] = rec;
        else this.memDailyMissions.push(rec);
        pushSync();
        return { data: id };
      }

      case 'admin_delete_mission': {
        const id = String(params.p_id || '');
        this.memDailyMissions = this.memDailyMissions.filter((m) => m.id !== id);
        pushSync();
        return { data: true };
      }

      case 'admin_update_rank_and_mission_settings': {
        this.memConfig.rankThresholds = parseRankThresholds(params.p_rank_thresholds);
        if (params.p_mission_completion_bonus !== undefined) {
          this.memConfig.missionCompletionBonus = Math.max(0, Number(params.p_mission_completion_bonus) || 0);
        }
        pushSync();
        return { data: true };
      }

      case 'admin_update_referral_settings': {
        this.memConfig.referralSignupBonus = Math.max(0, Number(params.p_signup_bonus) || 0);
        this.memConfig.referralDeposit50Bonus = Math.max(0, Number(params.p_deposit_50_bonus) || 0);
        this.memConfig.referralDepositBonus = Math.max(0, Number(params.p_deposit_bonus) || 0);
        return { data: true };
      }

      case 'admin_queue_broadcast': {
        this.memBroadcasts.unshift({
          id: `bc_${Date.now()}`,
          message_text: String(params.p_message || ''),
          segment: String(params.p_segment || 'all'),
          season_theme: normalizeSeasonTheme(params.p_season_theme),
          scheduled_for: params.p_scheduled_for ? String(params.p_scheduled_for) : null,
          status: 'pending',
          total_count: 0,
          sent_count: 0,
          failed_count: 0,
          error_message: process.env.TELEGRAM_BOT_TOKEN
            ? null
            : 'Queued in preview mode (connect TELEGRAM_BOT_TOKEN to deliver to Telegram users).',
          created_at: now,
          completed_at: null,
        });
        return { data: true };
      }

      case 'admin_clear_data': {
        const scope = String(params.p_scope || '');
        if (scope === 'rounds' || scope === 'all') this.memRounds = [];
        if (scope === 'transactions' || scope === 'all') this.memTransactions.clear();
        if (scope === 'referrals' || scope === 'all') this.memReferralsByReferred.clear();
        if (scope === 'broadcasts' || scope === 'all') this.memBroadcasts = [];
        if (scope === 'players' || scope === 'all') {
          this.memKnownPlayerIds.clear();
          this.memBannedPlayers.clear();
          this.memTotalDeposited.clear();
          this.memPlayerContacts.clear();
          this.memPlayerPhones.clear();
        }
        ctx.onClearScope(scope);
        return { data: true };
      }

      default:
        return { error: `Unknown RPC: ${fnName}`, status: 400 };
    }
  }
}

export const supabaseStore = new SupabaseStore();
