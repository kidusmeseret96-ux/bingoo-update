import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  Crown,
  Dices,
  Download,
  Gift,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquareText,
  Moon,
  Phone,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  TicketPercent,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  BotTemplateButtonConfig,
  DashboardSnapshot,
  MissionType,
  PlayerRecord,
  RankThresholds,
  RoundRecord,
  TransactionRecord,
} from './types';
import { ButtonsConfigurator } from './components/ButtonsConfigurator';
import { BotFlowEditor } from './components/BotFlowEditor';
import { VouchersPanel } from './components/VouchersPanel';
import { EventsMissionsTiersPanel } from './components/EventsMissionsTiersPanel';

type NavTab =
  | 'overview'
  | 'rounds'
  | 'players'
  | 'transactions'
  | 'referrals'
  | 'vouchers'
  | 'events'
  | 'flows'
  | 'broadcast'
  | 'bot';

interface RpcClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>
  ) => Promise<{ data: any; error: { message: string } | null }>;
}

function createLocalServerClient(): RpcClient {
  return {
    async rpc(fn: string, params?: Record<string, unknown>) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch('/api/admin/rpc', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fn, params: params || {} }),
          signal: ctrl.signal,
        });
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          return {
            data: null,
            error: { message: `Unexpected response (${res.status}) from preview server.` },
          };
        }
        const body = (await res.json().catch(() => ({}))) as { data?: any; error?: string };
        if (!res.ok || body.error) {
          return { data: null, error: { message: body.error || `Server error (${res.status})` } };
        }
        return { data: body.data ?? true, error: null };
      } catch (err) {
        return {
          data: null,
          error: {
            message:
              err instanceof Error && err.name === 'AbortError'
                ? 'Connection timed out after 8 seconds.'
                : err instanceof Error
                ? err.message
                : 'Unable to reach preview server.',
          },
        };
      } finally {
        window.clearTimeout(timer);
      }
    },
  };
}

interface SavedConnection {
  mode?: 'supabase' | 'server';
  url: string;
  anonKey: string;
  pin: string;
}

const STORAGE_KEY = 'zemen_admin_supabase_v1';

const PRESET_BANK_ORDER: Array<{ key: string; label: string }> = [
  { key: 'telebirr', label: 'Telebirr' },
  { key: 'cbe', label: 'CBE' },
  { key: 'cbe_birr', label: 'CBE Birr' },
  { key: 'abyssinia', label: 'Abyssinia Bank' },
  { key: 'awash', label: 'Awash Bank' },
  { key: 'kaffi', label: 'Kaffi' },
  { key: 'ebirr', label: 'E-Birr' },
  { key: 'coop', label: 'Coop' },
];

const BANK_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PRESET_BANK_ORDER.map((b) => [b.key, b.label])
);

function resolveBankDisplay(tx: TransactionRecord): string {
  if (tx.bank_key && BANK_LABEL_MAP[tx.bank_key]) {
    return BANK_LABEL_MAP[tx.bank_key];
  }
  return tx.button_label || 'Unspecified';
}

function loadInitialConnection(): SavedConnection {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedConnection>;
      return {
        mode: parsed.mode === 'server' ? 'server' : 'supabase',
        url: envUrl || parsed.url || '',
        anonKey: envAnon || parsed.anonKey || '',
        pin: parsed.pin || '',
      };
    }
  } catch {
    // ignore
  }
  return { mode: 'supabase', url: envUrl, anonKey: envAnon, pin: '' };
}

function fmtBirr(n: number | null | undefined): string {
  const num = Number(n || 0);
  return `${num.toLocaleString('en-US', { maximumFractionDigits: 2 })} Birr`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ADMIN_THEME_KEY = 'zemen_admin_theme';

function loadInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(ADMIN_THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

function resolvePlayerRank(totalDepositedBirr: number, thresholds?: RankThresholds) {
  const th: RankThresholds = thresholds || {
    bronze: 0,
    silver: 200,
    gold: 1000,
    diamond: 3000,
    platinum: 10000,
  };
  if (totalDepositedBirr >= th.platinum)
    return {
      label: 'Platinum',
      cls: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-400/40',
    };
  if (totalDepositedBirr >= th.diamond)
    return {
      label: 'Diamond',
      cls: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40',
    };
  if (totalDepositedBirr >= th.gold)
    return {
      label: 'Gold',
      cls: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/40',
    };
  if (totalDepositedBirr >= th.silver)
    return {
      label: 'Silver',
      cls: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-400/40',
    };
  return {
    label: 'Bronze',
    cls: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-400/40',
  };
}

interface BankSummaryRow {
  bankKey: string;
  bankLabel: string;
  depositCount: number;
  depositBirr: number;
  withdrawCount: number;
  withdrawBirr: number;
  pendingCount: number;
  netBirr: number;
  lastActivity: string | null;
}

export default function App() {
  const init = useMemo(loadInitialConnection, []);
  const [urlInput, setUrlInput] = useState(init.url);
  const [anonInput, setAnonInput] = useState(init.anonKey);
  const [pinInput, setPinInput] = useState(init.pin);

  const [client, setClient] = useState<RpcClient | null>(null);
  const [connMode, setConnMode] = useState<'supabase' | 'server'>(init.mode || 'supabase');
  const [activePin, setActivePin] = useState('');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(loadInitialTheme);

  const [tab, setTab] = useState<NavTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const [txFilterStatus, setTxFilterStatus] = useState<string>('all');
  const [txFilterBank, setTxFilterBank] = useState<string>('all');

  const [adjustPlayer, setAdjustPlayer] = useState<PlayerRecord | null>(null);
  const [adjustDepDelta, setAdjustDepDelta] = useState('');
  const [adjustWonDelta, setAdjustWonDelta] = useState('');

  const [signupBonusInput, setSignupBonusInput] = useState('20');
  const [deposit50BonusInput, setDeposit50BonusInput] = useState('20');
  const [depositBonusInput, setDepositBonusInput] = useState('20');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSegment, setBroadcastSegment] = useState('all');
  const [broadcastSeason, setBroadcastSeason] = useState('none');
  const [broadcastScheduledFor, setBroadcastScheduledFor] = useState('');
  const [confirmClearScope, setConfirmClearScope] = useState<string | null>(null);

  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', adminTheme === 'dark');
    try {
      localStorage.setItem(ADMIN_THEME_KEY, adminTheme);
    } catch {
      // ignore
    }
  }, [adminTheme]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const flashNotice = (msg: string) => {
    setNoticeMsg(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNoticeMsg(null);
      noticeTimerRef.current = null;
    }, 3500);
  };

  const fetchSnapshot = async (
    sb: RpcClient,
    pin: string,
    modeOverride?: 'supabase' | 'server'
  ) => {
    setLoading(true);
    setErrorMsg(null);
    const mode = modeOverride || connMode;
    try {
      const rpcPromise = sb.rpc('admin_get_dashboard', { p_pin: pin });
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        window.setTimeout(
          () => resolve({ data: null, error: { message: 'Connection timed out. Click "Connect to Live Preview Server" below or check your URL.' } }),
          9000
        )
      );
      const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
      if (error) throw new Error(error.message || 'Failed to authenticate.');
      const snap = data as DashboardSnapshot;
      if (!snap || !snap.settings) {
        throw new Error('Dashboard returned an empty response.');
      }
      setSnapshot(snap);
      setSignupBonusInput(String(snap.settings.referral_signup_bonus ?? 20));
      setDeposit50BonusInput(String(snap.settings.referral_deposit_50_bonus ?? 20));
      setDepositBonusInput(String(snap.settings.referral_deposit_bonus ?? 20));
      setClient(sb);
      setConnMode(mode);
      setActivePin(pin);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode, url: urlInput.trim(), anonKey: anonInput.trim(), pin })
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to connect.');
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const autoServer =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autoconnect') === 'server';

    if (autoServer || (init.mode === 'server' && init.pin)) {
      const serverPin = init.pin || '1234';
      setPinInput(serverPin);
      void fetchSnapshot(createLocalServerClient(), serverPin, 'server');
      return;
    }
    if (init.url && init.anonKey && init.pin) {
      const sb = createClient(init.url, init.anonKey);
      void fetchSnapshot(sb, init.pin, 'supabase');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = urlInput.trim();
    const k = anonInput.trim();
    const p = pinInput.trim();
    if (!u || !k || !p) {
      setErrorMsg('Enter Supabase URL, Supabase Anon Key, and Admin PIN.');
      return;
    }
    const sb = createClient(u, k);
    await fetchSnapshot(sb, p, 'supabase');
  };

  const handleConnectLocalPreview = async () => {
    const p = pinInput.trim() || '1234';
    setPinInput(p);
    await fetchSnapshot(createLocalServerClient(), p, 'server');
  };

  const handleDisconnect = () => {
    setClient(null);
    setSnapshot(null);
    setActivePin('');
    setPinInput('');
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'supabase', url: urlInput.trim(), anonKey: anonInput.trim(), pin: '' })
      );
    } catch {
      // ignore
    }
  };

  const refreshData = async () => {
    if (!client || !activePin) return;
    await fetchSnapshot(client, activePin);
    flashNotice('Synced latest data from Supabase.');
  };

  const handleSaveSettings = async (patch: {
    admin_group_id: string;
    extra_group_ids: string;
    extra_admin_ids: string;
    deposit_intro_text: string;
    withdraw_intro_text: string;
    withdraw_prompt_text: string;
    max_cartelas: number;
    vouchers_enabled: boolean;
    season_theme: string;
    new_pin?: string;
  }) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_update_settings', {
        p_pin: activePin,
        p_admin_group_id: patch.admin_group_id,
        p_deposit_intro: patch.deposit_intro_text,
        p_withdraw_intro: patch.withdraw_intro_text,
        p_withdraw_prompt: patch.withdraw_prompt_text,
        p_new_pin: patch.new_pin || null,
        p_extra_group_ids: patch.extra_group_ids,
        p_extra_admin_ids: patch.extra_admin_ids,
        p_max_cartelas: patch.max_cartelas,
        p_vouchers_enabled: patch.vouchers_enabled,
        p_season_theme: patch.season_theme,
      });
      if (error) throw new Error(error.message);
      const nextPin = patch.new_pin || activePin;
      await fetchSnapshot(client, nextPin);
      flashNotice('Bot settings, cartela limits & admin list saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveReferralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const signupAmt = Math.max(0, Number(signupBonusInput) || 0);
    const deposit50Amt = Math.max(0, Number(deposit50BonusInput) || 0);
    const depositAmt = Math.max(0, Number(depositBonusInput) || 0);
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_update_referral_settings', {
        p_pin: activePin,
        p_signup_bonus: signupAmt,
        p_deposit_bonus: depositAmt,
        p_deposit_50_bonus: deposit50Amt,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(
        `Referral bonuses updated: ${signupAmt} Birr join · ${deposit50Amt} Birr (50+ deposit) · ${depositAmt} Birr (100+ deposit).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed updating referral bonuses.');
    } finally {
      setBusy(false);
    }
  };

  const handleQueueBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    const clean = broadcastMessage.trim();
    if (!clean) {
      setErrorMsg('Enter or paste a message to send to targeted players.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_queue_broadcast', {
        p_pin: activePin,
        p_message: clean,
        p_segment: broadcastSegment,
        p_season_theme: broadcastSeason,
        p_scheduled_for: broadcastScheduledFor ? new Date(broadcastScheduledFor).toISOString() : null,
      });
      if (error) throw new Error(error.message);
      setBroadcastMessage('');
      setBroadcastScheduledFor('');
      await fetchSnapshot(client, activePin);
      flashNotice(
        broadcastScheduledFor
          ? 'Targeted broadcast scheduled! The Telegram bot will deliver it automatically at the scheduled time.'
          : 'Targeted broadcast queued! The Telegram bot is sending it with rate-limiting.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed queueing broadcast message.');
    } finally {
      setBusy(false);
    }
  };

  const handleClearData = async (scope: string) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_clear_data', {
        p_pin: activePin,
        p_scope: scope,
      });
      if (error) throw new Error(error.message);
      setConfirmClearScope(null);
      await fetchSnapshot(client, activePin);
      flashNotice(`Cleared data scope: ${scope}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed clearing data.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBankMessage = async (
    id: string,
    responseText: string,
    isActive: boolean,
    label: string,
    copyableText: string
  ) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_update_bank_message', {
        p_pin: activePin,
        p_id: id,
        p_response_text: responseText,
        p_is_active: isActive,
        p_copyable_text: copyableText,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Updated message & copyable account text for ${label}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed updating bank message.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePlayerBan = async (p: PlayerRecord) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const nextBan = !p.is_banned;
      const { error } = await client.rpc('admin_toggle_player_ban', {
        p_pin: activePin,
        p_player_id: p.id,
        p_is_banned: nextBan,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`${p.name} has been ${nextBan ? 'banned' : 'unbanned'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed updating ban status.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVouchers = async (enabled: boolean) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_toggle_vouchers', {
        p_pin: activePin,
        p_enabled: enabled,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Deposit vouchers ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed toggling vouchers.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpsertVoucher = async (payload: {
    code: string;
    bonus_birr: number;
    creator_name: string;
    is_active: boolean;
  }) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_upsert_voucher', {
        p_pin: activePin,
        p_code: payload.code,
        p_bonus_birr: payload.bonus_birr,
        p_creator_name: payload.creator_name,
        p_is_active: payload.is_active,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Saved voucher ${payload.code}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving voucher.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteVoucher = async (id: string) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_delete_voucher', {
        p_pin: activePin,
        p_id: id,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice('Voucher deleted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed deleting voucher.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpsertBotTemplate = async (payload: {
    template_key: string;
    language: 'en' | 'am' | 'om';
    title: string;
    message_text: string;
    buttons_config: BotTemplateButtonConfig[];
    is_custom: boolean;
  }) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_upsert_bot_template', {
        p_pin: activePin,
        p_template_key: payload.template_key,
        p_language: payload.language,
        p_title: payload.title,
        p_message_text: payload.message_text,
        p_buttons_config: payload.buttons_config,
        p_is_custom: payload.is_custom,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Saved bot template "${payload.template_key}" (${payload.language.toUpperCase()}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving bot template.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBotTemplate = async (templateKey: string) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_delete_bot_template', {
        p_pin: activePin,
        p_template_key: templateKey,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Deleted custom node /${templateKey}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed deleting custom node.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpsertEvent = async (payload: {
    id: string | null;
    name: string;
    description_text: string;
    theme_key: string;
    entry_birr: number;
    bonus_prize_birr: number;
    min_players: number;
    ends_at: string | null;
    is_active: boolean;
  }) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_upsert_special_event', {
        p_pin: activePin,
        p_id: payload.id,
        p_name: payload.name,
        p_description_text: payload.description_text,
        p_theme_key: payload.theme_key,
        p_entry_birr: payload.entry_birr,
        p_bonus_prize_birr: payload.bonus_prize_birr,
        p_min_players: payload.min_players,
        p_ends_at: payload.ends_at,
        p_is_active: payload.is_active,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Saved special event "${payload.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving special event.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_delete_special_event', {
        p_pin: activePin,
        p_id: id,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice('Special event deleted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed deleting special event.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpsertMission = async (payload: {
    id: string | null;
    title: string;
    mission_type: MissionType;
    target_count: number;
    pattern_filter: string;
    reward_birr: number;
    is_active: boolean;
    sort_order: number;
  }) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_upsert_mission', {
        p_pin: activePin,
        p_id: payload.id,
        p_title: payload.title,
        p_mission_type: payload.mission_type,
        p_target_count: payload.target_count,
        p_pattern_filter: payload.pattern_filter,
        p_reward_birr: payload.reward_birr,
        p_is_active: payload.is_active,
        p_sort_order: payload.sort_order,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice(`Saved mission "${payload.title}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving mission.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_delete_mission', {
        p_pin: activePin,
        p_id: id,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice('Daily mission deleted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed deleting mission.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRankAndMissionSettings = async (
    thresholds: RankThresholds,
    completionBonus: number
  ) => {
    if (!client) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await client.rpc('admin_update_rank_and_mission_settings', {
        p_pin: activePin,
        p_rank_thresholds: thresholds,
        p_mission_completion_bonus: completionBonus,
      });
      if (error) throw new Error(error.message);
      await fetchSnapshot(client, activePin);
      flashNotice('Saved VIP rank thresholds & all-missions grand bonus.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed saving rank settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !adjustPlayer) return;
    const depDelta = Number(adjustDepDelta || 0);
    const wonDelta = Number(adjustWonDelta || 0);
    if (!Number.isFinite(depDelta) || !Number.isFinite(wonDelta) || (depDelta === 0 && wonDelta === 0)) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.rpc('admin_adjust_player_balance', {
        p_pin: activePin,
        p_player_id: adjustPlayer.id,
        p_deposited_delta: depDelta,
        p_won_delta: wonDelta,
      });
      if (error) throw new Error(error.message);
      setAdjustPlayer(null);
      setAdjustDepDelta('');
      setAdjustWonDelta('');
      await fetchSnapshot(client, activePin);
      flashNotice('Player balance updated in Supabase.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed updating balance.');
    } finally {
      setBusy(false);
    }
  };

  const bankBreakdown = useMemo<BankSummaryRow[]>(() => {
    const txs = snapshot?.transactions || [];
    const map = new Map<string, BankSummaryRow>();
    for (const b of PRESET_BANK_ORDER) {
      map.set(b.key, {
        bankKey: b.key,
        bankLabel: b.label,
        depositCount: 0,
        depositBirr: 0,
        withdrawCount: 0,
        withdrawBirr: 0,
        pendingCount: 0,
        netBirr: 0,
        lastActivity: null,
      });
    }

    for (const tx of txs) {
      const key = tx.bank_key && map.has(tx.bank_key) ? tx.bank_key : null;
      if (!key) continue;
      const row = map.get(key)!;
      if (!row.lastActivity || tx.created_at > row.lastActivity) {
        row.lastActivity = tx.created_at;
      }
      if (tx.status === 'pending') {
        row.pendingCount += 1;
      }
      if (tx.tx_type === 'deposit' && tx.status === 'accepted') {
        row.depositCount += 1;
        row.depositBirr += Number(tx.amount_birr || 0);
      } else if (tx.tx_type === 'withdraw' && tx.status === 'done') {
        row.withdrawCount += 1;
        row.withdrawBirr += Number(tx.amount_birr || 0);
      }
      row.netBirr = row.depositBirr - row.withdrawBirr;
    }

    return Array.from(map.values());
  }, [snapshot]);

  const filteredPlayers = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.players;
    return snapshot.players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.username || '').toLowerCase().includes(q)
    );
  }, [snapshot, searchQuery]);

  const filteredRounds = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snapshot.rounds;
    return snapshot.rounds.filter(
      (r) =>
        String(r.round_number).includes(q) ||
        String(r.stake_birr).includes(q) ||
        r.winners.some((w) => w.playerName.toLowerCase().includes(q))
    );
  }, [snapshot, searchQuery]);

  const filteredTransactions = useMemo(() => {
    if (!snapshot) return [];
    const q = searchQuery.trim().toLowerCase();
    return snapshot.transactions.filter((tx) => {
      if (txFilterType !== 'all' && tx.tx_type !== txFilterType) return false;
      if (txFilterStatus !== 'all' && tx.status !== txFilterStatus) return false;
      if (txFilterBank !== 'all' && tx.bank_key !== txFilterBank) return false;
      if (!q) return true;
      return (
        tx.player_name.toLowerCase().includes(q) ||
        tx.player_id.toLowerCase().includes(q) ||
        (tx.player_username || '').toLowerCase().includes(q) ||
        resolveBankDisplay(tx).toLowerCase().includes(q) ||
        (tx.resolved_by || '').toLowerCase().includes(q) ||
        (tx.user_message || '').toLowerCase().includes(q)
      );
    });
  }, [snapshot, searchQuery, txFilterType, txFilterStatus, txFilterBank]);

  const filteredReferrals = useMemo(() => {
    const list = snapshot?.referrals || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.referrer_name.toLowerCase().includes(q) ||
        r.referrer_id.toLowerCase().includes(q) ||
        (r.referrer_username || '').toLowerCase().includes(q) ||
        r.referred_name.toLowerCase().includes(q) ||
        r.referred_id.toLowerCase().includes(q) ||
        (r.referred_username || '').toLowerCase().includes(q)
    );
  }, [snapshot, searchQuery]);

  const topReferrers = useMemo(() => {
    const list = snapshot?.referrals || [];
    const map = new Map<
      string,
      {
        referrerId: string;
        referrerName: string;
        referrerUsername: string | null;
        totalReferred: number;
        qualified50Deposits: number;
        qualifiedDeposits: number;
        totalEarnedBirr: number;
      }
    >();
    for (const r of list) {
      const cur = map.get(r.referrer_id) || {
        referrerId: r.referrer_id,
        referrerName: r.referrer_name,
        referrerUsername: r.referrer_username,
        totalReferred: 0,
        qualified50Deposits: 0,
        qualifiedDeposits: 0,
        totalEarnedBirr: 0,
      };
      cur.totalReferred += 1;
      if (r.deposit_50_bonus_paid) cur.qualified50Deposits += 1;
      if (r.deposit_bonus_paid) cur.qualifiedDeposits += 1;
      cur.totalEarnedBirr +=
        Number(r.signup_bonus_birr || 0) +
        Number(r.deposit_50_bonus_birr || 0) +
        Number(r.deposit_bonus_birr || 0);
      map.set(r.referrer_id, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalReferred - a.totalReferred || b.totalEarnedBirr - a.totalEarnedBirr
    );
  }, [snapshot]);

  // Connect / Login Screen
  if (!snapshot || !client) {
    return (
      <div className="min-h-screen admin-canvas flex items-center justify-center p-4 text-slate-900 dark:text-slate-100">
        <div className="w-full max-w-md bg-white/95 dark:bg-[#0D162E]/95 backdrop-blur-md border border-blue-200 dark:border-blue-500/30 rounded-2xl p-7 shadow-2xl shadow-blue-950/20">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Zemen <span className="text-blue-600 dark:text-cyan-400">Bingo</span> Admin
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Supabase &amp; Live Server Console
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdminTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-[#091022] border border-blue-200 dark:border-blue-500/30 text-amber-500 dark:text-amber-300 hover:brightness-110 cursor-pointer shrink-0"
            >
              {adminTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
            Connect to your Supabase project to track deposits, withdrawals per bank, players, and house commissions.
          </p>

          {errorMsg && (
            <div className="mb-4 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/30 rounded-xl">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Supabase Project URL</label>
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3.5 py-2.5 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Supabase Anon Key</label>
              <input
                type="password"
                required
                value={anonInput}
                onChange={(e) => setAnonInput(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Admin PIN</label>
              <input
                type="password"
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Default: 1234"
                className="w-full px-3.5 py-2.5 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-600/25 cursor-pointer"
            >
              {loading ? 'Connecting...' : 'Open Supabase Dashboard'}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-blue-500/20 space-y-2">
            <button
              type="button"
              onClick={handleConnectLocalPreview}
              className="w-full py-2.5 px-4 text-xs font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-cyan-400/30 rounded-xl cursor-pointer"
            >
              Connect to Live Preview Server (Uses PIN above or 1234)
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
              Synced directly with the game server on this host without requiring external Supabase keys.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'transactions', label: 'Banks, Deposits & Withdrawals', icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'rounds', label: 'Rounds & Commission', icon: <Trophy className="w-4 h-4" /> },
    { id: 'players', label: 'Players, Ranks & Bans', icon: <Users className="w-4 h-4" /> },
    { id: 'vouchers', label: 'Vouchers & Coupons', icon: <TicketPercent className="w-4 h-4" /> },
    { id: 'events', label: 'Events, Missions & Ranks', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'referrals', label: 'Referrals', icon: <Gift className="w-4 h-4" /> },
    { id: 'flows', label: 'Bot Texts & Flows', icon: <MessageSquareText className="w-4 h-4" /> },
    { id: 'broadcast', label: 'Targeted Broadcast & Clear', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'bot', label: 'Banks, Limits & Bot Settings', icon: <Settings2 className="w-4 h-4" /> },
  ];

  const activeTitle = navItems.find((n) => n.id === tab)?.label || 'Overview';

  return (
    <div className="min-h-screen admin-canvas text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 shrink-0 bg-white/95 dark:bg-[#091022]/95 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-blue-200/80 dark:border-blue-500/20 flex flex-col justify-between shadow-sm">
        <div>
          <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <span className="font-display text-base font-extrabold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              Zemen <span className="text-blue-600 dark:text-cyan-400">Bingo</span>
            </span>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1.5 overflow-x-auto">
            {navItems.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-md shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/15 hover:text-blue-900 dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block p-4 border-t border-blue-100 dark:border-blue-500/20">
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-blue-200 dark:border-blue-500/25 hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-xl cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock / Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white/85 dark:bg-[#091022]/85 backdrop-blur-md border-b border-blue-200/80 dark:border-blue-500/20 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
            <span className="font-display font-bold text-slate-900 dark:text-white">Zemen</span>{' '}
            <span className="font-display font-bold text-blue-600 dark:text-cyan-400">Bingo</span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
            <span className="text-slate-900 dark:text-slate-100 font-semibold">{activeTitle}</span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={loading}
              onClick={refreshData}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/25 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
            <button
              type="button"
              onClick={() => setAdminTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={adminTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={adminTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/30 text-amber-500 dark:text-amber-300 hover:brightness-110 cursor-pointer shrink-0"
            >
              {adminTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {errorMsg && (
            <div className="px-4 py-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/30 rounded-xl">
              {errorMsg}
            </div>
          )}
          {noticeMsg && (
            <div className="px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
              {noticeMsg}
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Total House Commission"
                  value={fmtBirr(snapshot.stats.totalCommissionBirr)}
                  accent="blue"
                  icon={<Wallet className="w-5 h-5" />}
                />
                <StatCard
                  label="Accepted Deposits"
                  value={fmtBirr(snapshot.stats.acceptedDepositsBirr)}
                  accent="emerald"
                  icon={<CheckCircle2 className="w-5 h-5" />}
                />
                <StatCard
                  label="Completed Withdrawals"
                  value={fmtBirr(snapshot.stats.completedWithdrawalsBirr)}
                  accent="violet"
                  icon={<ArrowUpCircle className="w-5 h-5" />}
                />
                <StatCard
                  label="Total Bet Pot"
                  value={fmtBirr(snapshot.stats.totalPotBirr)}
                  accent="amber"
                  icon={<Trophy className="w-5 h-5" />}
                />
                <StatCard
                  label="Completed Rounds"
                  value={String(snapshot.stats.totalRounds)}
                  accent="cyan"
                  icon={<Dices className="w-5 h-5" />}
                />
                <StatCard
                  label="Players / Pending Requests"
                  value={`${snapshot.stats.totalPlayers} · ${snapshot.stats.pendingRequests} pending`}
                  accent="pink"
                  icon={<Users className="w-5 h-5" />}
                />
              </div>

              {/* Per-Bank Breakdown */}
              <BankBreakdownCard rows={bankBreakdown} />

              {/* Recent Rounds */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Completed Rounds</h2>
                  <button
                    type="button"
                    onClick={() => setTab('rounds')}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                <RoundsTable rounds={snapshot.rounds.slice(0, 8)} />
              </div>

              {/* Recent Transactions */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Deposit & Withdraw Activity</h2>
                  <button
                    type="button"
                    onClick={() => setTab('transactions')}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>
                <TransactionsTable transactions={snapshot.transactions.slice(0, 10)} />
              </div>
            </div>
          )}

          {/* ROUNDS & COMMISSIONS */}
          {tab === 'rounds' && (
            <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
              <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by round, stake, or winner..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      'zemen-bingo-rounds.csv',
                      ['Round', 'Stake Birr', 'Players', 'Cartelas', 'Total Pot', 'Commission %', 'Commission Birr', 'Prize Pool', 'Winners', 'Ended At'],
                      filteredRounds.map((r) => [
                        r.round_number,
                        r.stake_birr,
                        r.players_count,
                        r.entries_count,
                        r.total_pot_birr,
                        r.commission_percent,
                        r.commission_birr,
                        r.prize_pool_birr,
                        r.winners.map((w) => `${w.playerName} (#${w.cartelaNumber})`).join('; '),
                        r.ended_at,
                      ])
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              </div>
              <RoundsTable rounds={filteredRounds} />
            </div>
          )}

          {/* PLAYERS & WALLETS */}
          {tab === 'players' && (
            <div className="space-y-4">
              {adjustPlayer && (
                <form
                  onSubmit={handleAdjustBalance}
                  className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-5 flex flex-wrap items-end gap-4 shadow-sm"
                >
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Adjust Balance for</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{adjustPlayer.name}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">Deposited +/- Birr</label>
                    <input
                      type="number"
                      step="any"
                      value={adjustDepDelta}
                      onChange={(e) => setAdjustDepDelta(e.target.value)}
                      placeholder="e.g. 100 or -50"
                      className="w-40 px-3 py-1.5 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">Won +/- Birr</label>
                    <input
                      type="number"
                      step="any"
                      value={adjustWonDelta}
                      onChange={(e) => setAdjustWonDelta(e.target.value)}
                      placeholder="e.g. 0 or -100"
                      className="w-40 px-3 py-1.5 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 rounded-xl cursor-pointer"
                    >
                      Apply Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustPlayer(null)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-blue-200 dark:border-blue-500/25 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search player name, username, or ID..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                        <th className="py-2.5 px-4">Player &amp; Rank</th>
                        <th className="py-2.5 px-4">Telegram ID &amp; Contact</th>
                        <th className="py-2.5 px-4">Lang</th>
                        <th className="py-2.5 px-4 text-right">Deposited</th>
                        <th className="py-2.5 px-4 text-right">Won</th>
                        <th className="py-2.5 px-4 text-right">Lifetime Dep</th>
                        <th className="py-2.5 px-4">Updated</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
                      {filteredPlayers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            No players found yet.
                          </td>
                        </tr>
                      ) : (
                        filteredPlayers.map((p) => {
                          const rank = resolvePlayerRank(
                            Number(p.total_deposited_birr ?? 0),
                            snapshot.settings.rank_thresholds
                          );
                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-blue-50/50 dark:hover:bg-blue-500/10 ${p.is_banned ? 'bg-red-50/50 dark:bg-red-950/25' : ''}`}
                            >
                              <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span>{p.name}</span>
                                  <span
                                    className={`px-1.5 py-0.5 text-[10px] font-bold uppercase border rounded ${rank.cls}`}
                                  >
                                    {rank.label}
                                  </span>
                                  {p.is_banned && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-red-600 text-white rounded">
                                      Banned
                                    </span>
                                  )}
                                </div>
                                {p.username && (
                                  <span className="text-xs text-slate-400">@{p.username}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-xs font-mono-num text-slate-500 dark:text-slate-400">
                                <div>{p.id}</div>
                                {p.contact_phone ? (
                                  <div className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 mt-0.5">
                                    <Phone className="w-3 h-3" />
                                    {p.contact_phone}
                                  </div>
                                ) : p.contact_shared ? (
                                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Contact shared</div>
                                ) : null}
                              </td>
                              <td className="py-2.5 px-4 text-xs uppercase text-slate-600 dark:text-slate-300">{p.language}</td>
                              <td className="py-2.5 px-4 text-right font-mono-num text-slate-900 dark:text-slate-100">
                                {p.deposited_birr}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                                {p.won_birr}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-blue-700 dark:text-cyan-300">
                                {Number(p.total_deposited_birr ?? 0)} Birr
                              </td>
                              <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {fmtDate(p.updated_at)}
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => setAdjustPlayer(p)}
                                  className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg cursor-pointer"
                                >
                                  Adjust
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleTogglePlayerBan(p)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                                    p.is_banned
                                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100'
                                      : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 hover:bg-red-100'
                                  }`}
                                >
                                  {p.is_banned ? (
                                    <>
                                      <ShieldCheck className="w-3 h-3" />
                                      Unban
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3 h-3" />
                                      Ban
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BANKS, DEPOSITS & WITHDRAWALS */}
          {tab === 'transactions' && (
            <div className="space-y-6">
              <BankBreakdownCard rows={bankBreakdown} />

              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center gap-3 justify-between">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search player, bank, approver, or message..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={txFilterBank}
                      onChange={(e) => setTxFilterBank(e.target.value)}
                      className="px-3 py-2 text-xs font-medium bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">All Banks</option>
                      {PRESET_BANK_ORDER.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={txFilterType}
                      onChange={(e) => setTxFilterType(e.target.value as 'all' | 'deposit' | 'withdraw')}
                      className="px-3 py-2 text-xs font-medium bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">All Types</option>
                      <option value="deposit">Deposits</option>
                      <option value="withdraw">Withdrawals</option>
                    </select>
                    <select
                      value={txFilterStatus}
                      onChange={(e) => setTxFilterStatus(e.target.value)}
                      className="px-3 py-2 text-xs font-medium bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-800 dark:text-slate-100"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="done">Done</option>
                      <option value="incorrect">Incorrect</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          'zemen-bingo-transactions.csv',
                          ['Type', 'Player Name', 'Username', 'Telegram ID', 'Bank', 'Amount Birr', 'Status', 'Submitted Details', 'Processed By', 'Requested At', 'Resolved At'],
                          filteredTransactions.map((tx) => [
                            tx.tx_type,
                            tx.player_name,
                            tx.player_username ? `@${tx.player_username}` : '',
                            tx.player_id,
                            resolveBankDisplay(tx),
                            tx.amount_birr ?? '',
                            tx.status,
                            `${tx.user_photo_file_id ? '[Photo] ' : ''}${tx.user_message || ''}`,
                            tx.resolved_by || '',
                            tx.created_at,
                            tx.resolved_at || '',
                          ])
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  </div>
                </div>
                <TransactionsTable transactions={filteredTransactions} />
              </div>
            </div>
          )}

          {/* REFERRALS */}
          {tab === 'referrals' && (
            <div className="space-y-6">
              {/* Bonus Amount Settings */}
              <form
                onSubmit={handleSaveReferralSettings}
                className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-500/20">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Referral Bonus Amounts</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Changing either amount updates both payout logic and bot referral messages in English, Amharic, and Afaan Oromo automatically.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Save Referral Amounts
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      Join Bonus (Birr — when referred person joins)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={signupBonusInput}
                      onChange={(e) => setSignupBonusInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      First 50+ Birr Deposit Bonus (Birr — when they deposit ≥ 50 Birr)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={deposit50BonusInput}
                      onChange={(e) => setDeposit50BonusInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                      First 100+ Birr Deposit Bonus (Birr — when they deposit ≥ 100 Birr)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={depositBonusInput}
                      onChange={(e) => setDepositBonusInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </form>

              {/* Referral Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total Referrals"
                  value={String(snapshot.stats.totalReferrals ?? (snapshot.referrals?.length || 0))}
                  accent="blue"
                  icon={<Users className="w-5 h-5" />}
                />
                <StatCard
                  label="First 50+ Birr Deposits"
                  value={String(snapshot.stats.qualified50Deposits ?? 0)}
                  accent="emerald"
                  icon={<CheckCircle2 className="w-5 h-5" />}
                />
                <StatCard
                  label="First 100+ Birr Deposits"
                  value={String(snapshot.stats.qualifiedReferralDeposits ?? 0)}
                  accent="cyan"
                  icon={<Gift className="w-5 h-5" />}
                />
                <StatCard
                  label="Total Referral Bonuses Paid"
                  value={fmtBirr(snapshot.stats.totalReferralBonusesBirr ?? 0)}
                  accent="amber"
                  icon={<Trophy className="w-5 h-5" />}
                />
              </div>

              {/* Top Referrers */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Top Referrers (Who Referred the Most)</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{topReferrers.length} referrer(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                        <th className="py-2.5 px-4">Rank</th>
                        <th className="py-2.5 px-4">Referrer</th>
                        <th className="py-2.5 px-4">Telegram ID</th>
                        <th className="py-2.5 px-4 text-right">People Referred</th>
                        <th className="py-2.5 px-4 text-right">50+ Deposits</th>
                        <th className="py-2.5 px-4 text-right">100+ Deposits</th>
                        <th className="py-2.5 px-4 text-right">Total Bonus Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
                      {topReferrers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            No referrals recorded yet.
                          </td>
                        </tr>
                      ) : (
                        topReferrers.map((row, idx) => (
                          <tr key={row.referrerId} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                            <td className="py-2.5 px-4 font-mono-num font-bold text-slate-700 dark:text-cyan-300">#{idx + 1}</td>
                            <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                              {row.referrerName}
                              {row.referrerUsername && (
                                <span className="text-xs text-slate-400 ml-1.5">@{row.referrerUsername}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-mono-num text-slate-500 dark:text-slate-400">{row.referrerId}</td>
                            <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                              {row.totalReferred}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                              {row.qualified50Deposits}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400">
                              {row.qualifiedDeposits}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-amber-700 dark:text-amber-300">
                              {row.totalEarnedBirr} Birr
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Who Referred Who */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Who Referred Who</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search referrer or referred..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          'zemen-bingo-referrals.csv',
                          [
                            'Referrer Name',
                            'Referrer ID',
                            'Referred Name',
                            'Referred ID',
                            'Join Bonus Birr',
                            '50+ Deposit Bonus Birr',
                            'First 50+ Deposit Paid',
                            '100+ Deposit Bonus Birr',
                            'First 100+ Deposit Paid',
                            'First Deposit Birr',
                            'Joined At',
                          ],
                          filteredReferrals.map((r) => [
                            r.referrer_name,
                            r.referrer_id,
                            r.referred_name,
                            r.referred_id,
                            r.signup_bonus_birr,
                            r.deposit_50_bonus_birr ?? 0,
                            r.deposit_50_bonus_paid ? 'Yes' : 'No',
                            r.deposit_bonus_birr,
                            r.deposit_bonus_paid ? 'Yes' : 'No',
                            r.first_qualifying_deposit_birr ?? r.first_50_deposit_birr ?? '',
                            r.created_at,
                          ])
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                        <th className="py-2.5 px-4">Referrer</th>
                        <th className="py-2.5 px-4">Referred User</th>
                        <th className="py-2.5 px-4 text-right">Join Bonus</th>
                        <th className="py-2.5 px-4 text-right">50+ Bonus</th>
                        <th className="py-2.5 px-4 text-right">100+ Bonus</th>
                        <th className="py-2.5 px-4">Deposit Status</th>
                        <th className="py-2.5 px-4">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
                      {filteredReferrals.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            No referral records match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredReferrals.map((r) => (
                          <tr key={r.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                            <td className="py-2.5 px-4">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {r.referrer_name}
                                {r.referrer_username && (
                                  <span className="text-xs text-slate-400 ml-1">@{r.referrer_username}</span>
                                )}
                              </div>
                              <div className="text-xs font-mono-num text-slate-400">{r.referrer_id}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-medium text-slate-900 dark:text-white">
                                {r.referred_name}
                                {r.referred_username && (
                                  <span className="text-xs text-slate-400 ml-1">@{r.referred_username}</span>
                                )}
                              </div>
                              <div className="text-xs font-mono-num text-slate-400">{r.referred_id}</div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-white">
                              +{r.signup_bonus_birr} Birr
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                              {r.deposit_50_bonus_paid ? `+${r.deposit_50_bonus_birr ?? 0} Birr` : '0 Birr'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                              {r.deposit_bonus_paid ? `+${r.deposit_bonus_birr} Birr` : '0 Birr'}
                            </td>
                            <td className="py-2.5 px-4 text-xs">
                              {r.deposit_bonus_paid ? (
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                  100+ Paid ({r.first_qualifying_deposit_birr ?? 100}+ Birr)
                                </span>
                              ) : r.deposit_50_bonus_paid ? (
                                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                  50+ Paid ({r.first_50_deposit_birr ?? 50}+ Birr)
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">Waiting 50+/100+ deposit</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {fmtDate(r.created_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VOUCHERS & COUPONS */}
          {tab === 'vouchers' && (
            <VouchersPanel
              vouchersEnabled={Boolean(snapshot.settings.vouchers_enabled)}
              vouchers={snapshot.vouchers || []}
              busy={busy}
              onToggleEnabled={handleToggleVouchers}
              onUpsertVoucher={handleUpsertVoucher}
              onDeleteVoucher={handleDeleteVoucher}
            />
          )}

          {/* SPECIAL EVENTS, MISSIONS & VIP RANKS */}
          {tab === 'events' && (
            <EventsMissionsTiersPanel
              events={snapshot.special_events || []}
              missions={snapshot.daily_missions || []}
              missionCompletionBonus={Number(snapshot.settings.mission_completion_bonus ?? 50)}
              rankThresholds={
                snapshot.settings.rank_thresholds || {
                  bronze: 0,
                  silver: 200,
                  gold: 1000,
                  diamond: 3000,
                  platinum: 10000,
                }
              }
              busy={busy}
              onUpsertEvent={handleUpsertEvent}
              onDeleteEvent={handleDeleteEvent}
              onUpsertMission={handleUpsertMission}
              onDeleteMission={handleDeleteMission}
              onSaveRankAndMissionSettings={handleSaveRankAndMissionSettings}
            />
          )}

          {/* BOT TEXTS & INTERACTIVE BUTTON FLOWS */}
          {tab === 'flows' && (
            <BotFlowEditor
              templates={snapshot.bot_text_templates || []}
              busy={busy}
              onUpsertTemplate={handleUpsertBotTemplate}
              onDeleteTemplate={handleDeleteBotTemplate}
            />
          )}

          {/* BROADCAST & CLEAR DATA */}
          {tab === 'broadcast' && (
            <div className="space-y-6">
              {/* Targeted & Scheduled Broadcast Message */}
              <form
                onSubmit={handleQueueBroadcast}
                className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-500/20">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      Targeted &amp; Scheduled Bot Broadcasts
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Send segmented announcements with rate-limiting, optional scheduling, and festive decorations (Christmas snow / Enkutatash Adey Abeba flowers).
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !broadcastMessage.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/25 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Megaphone className="w-4 h-4" />
                    {broadcastScheduledFor ? 'Schedule Broadcast' : 'Send Targeted Broadcast'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Target Segment
                    </label>
                    <select
                      value={broadcastSegment}
                      onChange={(e) => setBroadcastSegment(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white"
                    >
                      <option value="all">All Non-Banned Players ({snapshot.stats.totalPlayers})</option>
                      <option value="active">Active Players (Last 7 Days)</option>
                      <option value="inactive">Inactive Players (7+ Days)</option>
                      <option value="en">English Locale Only (EN)</option>
                      <option value="am">Amharic Locale Only (AM)</option>
                      <option value="om">Afaan Oromo Locale Only (OM)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Seasonal Effect Decoration
                    </label>
                    <select
                      value={broadcastSeason}
                      onChange={(e) => setBroadcastSeason(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white"
                    >
                      <option value="none">Plain Message</option>
                      <option value="christmas">Christmas Snow Theme (❄️🎄)</option>
                      <option value="enkutatash">Enkutatash Yellow Flowers (🌼🌻🇪🇹)</option>
                      <option value="golden">Golden Jackpot Banner (🏆✨)</option>
                      <option value="cyber">Neon Mega Night (⚡🔮)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Scheduled Delivery (leave blank = Send Immediately)
                    </label>
                    <input
                      type="datetime-local"
                      value={broadcastScheduledFor}
                      onChange={(e) => setBroadcastScheduledFor(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono-num bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Write your announcement, promo, or holiday message here..."
                  className="w-full px-3.5 py-2.5 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </form>

              {/* Recent Broadcasts History */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Broadcast Delivery History</h2>
                  <button
                    type="button"
                    onClick={refreshData}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Check status
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                        <th className="py-2.5 px-4">Message</th>
                        <th className="py-2.5 px-4">Segment &amp; Theme</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Sent / Total</th>
                        <th className="py-2.5 px-4 text-right">Failed</th>
                        <th className="py-2.5 px-4">Queued / Scheduled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
                      {(snapshot.broadcasts || []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            No broadcast messages sent yet.
                          </td>
                        </tr>
                      ) : (
                        (snapshot.broadcasts || []).map((bc) => (
                          <tr key={bc.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                            <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200 max-w-md truncate">{bc.message_text}</td>
                            <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <span className="uppercase font-semibold">{bc.segment || 'all'}</span>
                              {bc.season_theme && bc.season_theme !== 'none' && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30">
                                  {bc.season_theme}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-xs uppercase font-semibold text-slate-700 dark:text-slate-200">
                              {bc.status}
                              {bc.error_message && (
                                <span className="block text-[11px] font-normal text-red-600 dark:text-red-400 normal-case">
                                  {bc.error_message}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num text-emerald-700 dark:text-emerald-400 font-semibold">
                              {bc.sent_count} / {bc.total_count}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-num text-red-600 dark:text-red-400">
                              {bc.failed_count}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              <div>{fmtDate(bc.created_at)}</div>
                              {bc.scheduled_for && (
                                <div className="text-[11px] text-blue-700 dark:text-cyan-400">
                                  Sched: {fmtDate(bc.scheduled_for)}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clear Data Section */}
              <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-red-200 dark:border-red-500/30 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-start gap-3 pb-4 border-b border-red-100 dark:border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Clear Database Records</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Permanently delete historical records from Supabase. Your bot settings, Admin PIN, and bank messages are preserved.
                    </p>
                  </div>
                </div>

                {confirmClearScope && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">
                      Are you sure you want to permanently clear <strong>{confirmClearScope}</strong>? This action cannot be undone.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleClearData(confirmClearScope)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl cursor-pointer"
                      >
                        Yes, Permanently Clear
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmClearScope(null)}
                        className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#091022] border border-slate-200 dark:border-blue-500/25 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { scope: 'rounds', title: 'Clear Rounds History', desc: 'Delete completed game rounds & commission logs.' },
                    { scope: 'transactions', title: 'Clear Transactions', desc: 'Delete deposit & withdrawal request logs.' },
                    { scope: 'referrals', title: 'Clear Referrals', desc: 'Delete who-referred-who history.' },
                    { scope: 'broadcasts', title: 'Clear Broadcast Logs', desc: 'Delete past broadcast delivery history.' },
                    { scope: 'players', title: 'Clear Players & Wallets', desc: 'Delete all player accounts and wallet balances.' },
                    { scope: 'all', title: 'Clear All Activity Data', desc: 'Reset rounds, transactions, referrals, broadcasts & players.' },
                  ].map((item) => (
                    <div
                      key={item.scope}
                      className="p-4 border border-blue-200/70 dark:border-blue-500/20 rounded-xl flex flex-col justify-between gap-3 bg-blue-50/40 dark:bg-[#081022]"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmClearScope(item.scope)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                          item.scope === 'all'
                            ? 'text-white bg-red-600 hover:bg-red-700'
                            : 'text-red-700 dark:text-red-300 bg-white dark:bg-[#0D162E] border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/15'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {item.title}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BANK MESSAGES & BOT SETTINGS */}
          {tab === 'bot' && (
            <ButtonsConfigurator
              settings={snapshot.settings}
              buttons={snapshot.payment_buttons}
              busy={busy}
              onSaveSettings={handleSaveSettings}
              onSaveBankMessage={handleSaveBankMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}

type StatAccent = 'blue' | 'emerald' | 'violet' | 'amber' | 'cyan' | 'pink';

function StatCard({
  label,
  value,
  accent = 'blue',
  icon,
}: {
  label: string;
  value: string;
  accent?: StatAccent;
  icon?: React.ReactNode;
}) {
  const styles: Record<StatAccent, { card: string; badge: string; label: string; value: string }> = {
    blue: {
      card: 'bg-gradient-to-br from-sky-50 to-blue-100/80 border-blue-200/90 dark:from-[#0C214A]/90 dark:to-[#0A142D]/95 dark:border-blue-500/40 dark:shadow-lg dark:shadow-blue-950/30',
      badge: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/30',
      label: 'text-slate-600 dark:text-sky-200/80',
      value: 'text-slate-950 dark:text-white',
    },
    emerald: {
      card: 'bg-gradient-to-br from-emerald-50 to-teal-100/75 border-emerald-200/90 dark:from-[#082B26]/85 dark:to-[#0A1628]/95 dark:border-emerald-500/40 dark:shadow-lg dark:shadow-emerald-950/25',
      badge: 'bg-gradient-to-br from-emerald-500 to-green-400 text-white shadow-md shadow-emerald-500/30',
      label: 'text-slate-600 dark:text-emerald-200/80',
      value: 'text-slate-950 dark:text-white',
    },
    violet: {
      card: 'bg-gradient-to-br from-violet-50 to-indigo-100/80 border-violet-200/90 dark:from-[#21134A]/85 dark:to-[#0D132E]/95 dark:border-violet-500/40 dark:shadow-lg dark:shadow-violet-950/25',
      badge: 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-md shadow-violet-500/30',
      label: 'text-slate-600 dark:text-violet-200/80',
      value: 'text-slate-950 dark:text-white',
    },
    amber: {
      card: 'bg-gradient-to-br from-amber-50 to-orange-100/75 border-amber-200/90 dark:from-[#33210B]/85 dark:to-[#12162A]/95 dark:border-amber-500/40 dark:shadow-lg dark:shadow-amber-950/25',
      badge: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30',
      label: 'text-slate-600 dark:text-amber-200/80',
      value: 'text-slate-950 dark:text-white',
    },
    cyan: {
      card: 'bg-gradient-to-br from-cyan-50 to-sky-100/75 border-cyan-200/90 dark:from-[#082A3B]/85 dark:to-[#0B142C]/95 dark:border-cyan-400/40 dark:shadow-lg dark:shadow-cyan-950/25',
      badge: 'bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-md shadow-cyan-500/30',
      label: 'text-slate-600 dark:text-cyan-200/80',
      value: 'text-slate-950 dark:text-white',
    },
    pink: {
      card: 'bg-gradient-to-br from-rose-50 to-pink-100/80 border-pink-200/90 dark:from-[#381031]/85 dark:to-[#11152D]/95 dark:border-pink-500/40 dark:shadow-lg dark:shadow-pink-950/25',
      badge: 'bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30',
      label: 'text-slate-600 dark:text-pink-200/80',
      value: 'text-slate-950 dark:text-white',
    },
  };
  const s = styles[accent];

  return (
    <div className={`border rounded-2xl px-5 py-4 flex items-center gap-4 backdrop-blur-md transition-all ${s.card}`}>
      {icon && (
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${s.badge}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium truncate ${s.label}`}>{label}</p>
        <p className={`mt-1 text-xl font-bold font-mono-num truncate ${s.value}`}>{value}</p>
      </div>
    </div>
  );
}

function BankBreakdownCard({ rows }: { rows: BankSummaryRow[] }) {
  return (
    <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:shadow-blue-950/30">
      <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Bank Totals (Detected from Bot & Admin Group Approvals)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
              <th className="py-2.5 px-4">Bank / Wallet</th>
              <th className="py-2.5 px-4 text-right">Deposits (#)</th>
              <th className="py-2.5 px-4 text-right">Deposited Birr</th>
              <th className="py-2.5 px-4 text-right">Withdrawals (#)</th>
              <th className="py-2.5 px-4 text-right">Withdrawn Birr</th>
              <th className="py-2.5 px-4 text-right">Net Flow</th>
              <th className="py-2.5 px-4 text-right">Pending</th>
              <th className="py-2.5 px-4">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
            {rows.map((r) => (
              <tr key={r.bankKey} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{r.bankLabel}</td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">{r.depositCount}</td>
                <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                  +{r.depositBirr.toLocaleString('en-US', { maximumFractionDigits: 2 })} Birr
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">{r.withdrawCount}</td>
                <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-amber-700 dark:text-amber-300">
                  -{r.withdrawBirr.toLocaleString('en-US', { maximumFractionDigits: 2 })} Birr
                </td>
                <td
                  className={`py-2.5 px-4 text-right font-mono-num font-semibold ${
                    r.netBirr >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {r.netBirr.toLocaleString('en-US', { maximumFractionDigits: 2 })} Birr
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 dark:text-slate-300">{r.pendingCount}</td>
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(r.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoundsTable({ rounds }: { rounds: RoundRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
            <th className="py-2.5 px-4">Round</th>
            <th className="py-2.5 px-4">Room</th>
            <th className="py-2.5 px-4 text-right">Players</th>
            <th className="py-2.5 px-4 text-right">Total Pot</th>
            <th className="py-2.5 px-4 text-right">Commission</th>
            <th className="py-2.5 px-4 text-right">Prize Pool</th>
            <th className="py-2.5 px-4">Winner(s)</th>
            <th className="py-2.5 px-4">Ended</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
          {rounds.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                No completed rounds recorded yet.
              </td>
            </tr>
          ) : (
            rounds.map((r) => (
              <tr key={r.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                <td className="py-2.5 px-4 font-mono-num font-medium text-slate-900 dark:text-white">#{r.round_number}</td>
                <td className="py-2.5 px-4 font-mono-num text-slate-700 dark:text-slate-300">{r.stake_birr} Birr</td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">
                  {r.players_count} ({r.entries_count})
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-900 dark:text-white">{r.total_pot_birr} Birr</td>
                <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                  +{r.commission_birr} Birr ({r.commission_percent}%)
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-900 dark:text-white">{r.prize_pool_birr} Birr</td>
                <td className="py-2.5 px-4 text-slate-700 dark:text-slate-200">
                  {r.winners.length > 0
                    ? r.winners.map((w) => `${w.playerName} (#${w.cartelaNumber})`).join(', ')
                    : 'No winner'}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(r.ended_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: TransactionRecord[] }) {
  const statusStyle = (status: TransactionRecord['status']) => {
    if (status === 'accepted' || status === 'done') return 'text-emerald-700 dark:text-emerald-400 font-semibold';
    if (status === 'rejected' || status === 'incorrect') return 'text-red-700 dark:text-red-400 font-semibold';
    return 'text-amber-700 dark:text-amber-300 font-semibold';
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
            <th className="py-2.5 px-4">Type</th>
            <th className="py-2.5 px-4">Player</th>
            <th className="py-2.5 px-4">Bank</th>
            <th className="py-2.5 px-4">Submitted Details</th>
            <th className="py-2.5 px-4 text-right">Amount</th>
            <th className="py-2.5 px-4">Status</th>
            <th className="py-2.5 px-4">Processed By</th>
            <th className="py-2.5 px-4">Requested</th>
            <th className="py-2.5 px-4">Resolved</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-slate-500 dark:text-slate-400">
                No deposit or withdrawal requests yet.
              </td>
            </tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10">
                <td className="py-2.5 px-4 capitalize font-medium text-slate-900 dark:text-white">{tx.tx_type}</td>
                <td className="py-2.5 px-4 text-slate-900 dark:text-white">
                  <div className="font-medium">
                    {tx.player_name}
                    {tx.player_username && (
                      <span className="text-xs text-slate-400 ml-1">@{tx.player_username}</span>
                    )}
                  </div>
                  <div className="text-xs font-mono-num text-slate-400">{tx.player_id}</div>
                </td>
                <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {resolveBankDisplay(tx)}
                </td>
                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                  {tx.voucher_code && (
                    <span className="inline-block mr-1.5 px-1.5 py-0.5 text-[10px] font-mono-num font-bold bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-cyan-400/30 rounded">
                      {tx.voucher_code}
                    </span>
                  )}
                  {tx.user_photo_file_id ? '[Photo] ' : ''}
                  {tx.user_message || '—'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                  {tx.amount_birr ? `${tx.amount_birr} Birr` : '—'}
                </td>
                <td className={`py-2.5 px-4 text-xs uppercase ${statusStyle(tx.status)}`}>{tx.status}</td>
                <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  {tx.resolved_by || '—'}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(tx.resolved_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
