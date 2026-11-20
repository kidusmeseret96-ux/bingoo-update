-- Zemen Bingo — Complete Idempotent Supabase Schema & Admin RPC Functions
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run on both fresh databases and existing deployments (preserves all existing data).

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. Global App & Bot Settings (single row id = 1)
-- ============================================================================
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  admin_pin text not null default '1234',
  admin_group_id text not null default '',
  extra_group_ids text not null default '',
  extra_admin_ids text not null default '',
  deposit_intro_text text not null default 'Choose a bank or wallet below to deposit:',
  withdraw_intro_text text not null default 'Choose your withdrawal bank or wallet below:',
  withdraw_prompt_text text not null default 'Send your full name, account number, and the Birr amount you want to withdraw:',
  commission_percent int not null default 20,
  call_interval_ms int not null default 3500,
  max_cartelas int not null default 400,
  vouchers_enabled boolean not null default false,
  season_theme text not null default 'none',
  rank_thresholds jsonb not null default '{"bronze":0,"silver":500,"gold":2000,"diamond":5000,"platinum":15000}'::jsonb,
  mission_completion_bonus numeric not null default 50,
  referral_signup_bonus numeric not null default 20,
  referral_deposit_50_bonus numeric not null default 20,
  referral_deposit_bonus numeric not null default 20,
  custom_recent_winners jsonb,
  custom_leaderboard jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings add column if not exists extra_group_ids text not null default '';
alter table public.app_settings add column if not exists extra_admin_ids text not null default '';
alter table public.app_settings add column if not exists max_cartelas int not null default 400;
alter table public.app_settings add column if not exists vouchers_enabled boolean not null default false;
alter table public.app_settings add column if not exists season_theme text not null default 'none';
alter table public.app_settings add column if not exists rank_thresholds jsonb not null default '{"bronze":0,"silver":500,"gold":2000,"diamond":5000,"platinum":15000}'::jsonb;
alter table public.app_settings add column if not exists mission_completion_bonus numeric not null default 50;
alter table public.app_settings add column if not exists referral_signup_bonus numeric not null default 20;
alter table public.app_settings add column if not exists referral_deposit_50_bonus numeric not null default 20;
alter table public.app_settings add column if not exists referral_deposit_bonus numeric not null default 20;
alter table public.app_settings add column if not exists custom_recent_winners jsonb;
alter table public.app_settings add column if not exists custom_leaderboard jsonb;

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

-- ============================================================================
-- 2. Deposit Vouchers & Coupons
-- ============================================================================
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  bonus_birr numeric not null default 0,
  creator_name text not null default 'Admin',
  is_active boolean not null default true,
  uses_count int not null default 0,
  total_deposited_birr numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;

-- ============================================================================
-- 3. Bot Text Templates & Button Flows (EN / AM / OM + Custom Nodes)
-- ============================================================================
create table if not exists public.bot_text_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  language text not null default 'en' check (language in ('en', 'am', 'om')),
  title text not null default '',
  message_text text not null default '',
  buttons_config jsonb not null default '[]'::jsonb,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(template_key, language)
);

alter table public.bot_text_templates add column if not exists title text not null default '';
alter table public.bot_text_templates add column if not exists is_custom boolean not null default false;
alter table public.bot_text_templates enable row level security;

-- ============================================================================
-- 4. Preset Bank Buttons (8 Deposit + 8 Withdraw) with Copyable Account Text
-- ============================================================================
create table if not exists public.payment_buttons (
  id uuid primary key default gen_random_uuid(),
  flow_type text not null check (flow_type in ('deposit', 'withdraw')),
  bank_key text,
  label text not null,
  response_text text not null default '',
  copyable_text text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.payment_buttons add column if not exists bank_key text;
alter table public.payment_buttons add column if not exists copyable_text text not null default '';

update public.payment_buttons set bank_key = 'telebirr' where bank_key is null and lower(label) like '%telebirr%';
update public.payment_buttons set bank_key = 'cbe_birr' where bank_key is null and lower(label) like '%cbe birr%';
update public.payment_buttons set bank_key = 'cbe' where bank_key is null and lower(label) = 'cbe';
delete from public.payment_buttons where bank_key is null;

create unique index if not exists idx_payment_buttons_flow_bank on public.payment_buttons (flow_type, bank_key);

insert into public.payment_buttons (flow_type, bank_key, label, response_text, copyable_text, sort_order, is_active)
values
  ('deposit', 'telebirr', 'Telebirr', 'Send your deposit via Telebirr to 0911000000, then send a screenshot or confirmation message here.', '0911000000', 1, true),
  ('deposit', 'cbe', 'CBE', 'Transfer your deposit to CBE account 1000987654321, then reply here with your receipt photo or transaction ID.', '1000987654321', 2, true),
  ('deposit', 'cbe_birr', 'CBE Birr', 'Send your deposit via CBE Birr to 0911000001, then send your receipt photo or confirmation message here.', '0911000001', 3, true),
  ('deposit', 'abyssinia', 'Abyssinia Bank', 'Transfer your deposit to Abyssinia Bank 1000111222333, then reply here with your receipt photo or transaction ID.', '1000111222333', 4, true),
  ('deposit', 'awash', 'Awash Bank', 'Transfer your deposit to Awash Bank 1000444333222, then reply here with your receipt photo or transaction ID.', '1000444333222', 5, true),
  ('deposit', 'kaffi', 'Kaffi', 'Send your deposit via Kaffi to 1000666778899, then reply here with your receipt photo or confirmation message.', '1000666778899', 6, true),
  ('deposit', 'ebirr', 'E-Birr', 'Send your deposit via E-Birr to 0911000002, then reply here with your receipt photo or confirmation message.', '0911000002', 7, true),
  ('deposit', 'coop', 'Coop', 'Transfer your deposit to Coop Bank 1000888999000, then reply here with your receipt photo or transaction ID.', '1000888999000', 8, true),
  ('withdraw', 'telebirr', 'Telebirr', '', '', 1, true),
  ('withdraw', 'cbe', 'CBE', '', '', 2, true),
  ('withdraw', 'cbe_birr', 'CBE Birr', '', '', 3, true),
  ('withdraw', 'abyssinia', 'Abyssinia Bank', '', '', 4, true),
  ('withdraw', 'awash', 'Awash Bank', '', '', 5, true),
  ('withdraw', 'kaffi', 'Kaffi', '', '', 6, true),
  ('withdraw', 'ebirr', 'E-Birr', '', '', 7, true),
  ('withdraw', 'coop', 'Coop', '', '', 8, true)
on conflict (flow_type, bank_key) do nothing;

-- ============================================================================
-- 5. Players & Wallets (with Rank tracking, Contact Phone, Ban, Last Active)
-- ============================================================================
create table if not exists public.players (
  id text primary key,
  name text not null,
  username text,
  language text not null default 'en' check (language in ('en', 'am', 'om')),
  deposited_birr numeric not null default 100,
  won_birr numeric not null default 0,
  total_deposited_birr numeric not null default 0,
  contact_phone text,
  contact_shared boolean not null default false,
  is_banned boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players add column if not exists total_deposited_birr numeric not null default 0;
alter table public.players add column if not exists contact_phone text;
alter table public.players add column if not exists contact_shared boolean not null default false;
alter table public.players add column if not exists is_banned boolean not null default false;
alter table public.players add column if not exists last_active_at timestamptz not null default now();

-- ============================================================================
-- 6. Special Event Rooms (10 Themes, Countdown, Min Players, Winnable Bonus)
-- ============================================================================
create table if not exists public.special_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description_text text not null default '',
  theme_key text not null default 'golden',
  entry_birr numeric not null default 20,
  bonus_prize_birr numeric not null default 100,
  min_players int not null default 0,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.special_events enable row level security;

-- ============================================================================
-- 7. Daily Quests / Missions & Per-Player Daily Progress
-- ============================================================================
create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mission_type text not null default 'play_rounds' check (mission_type in ('play_rounds', 'win_rounds', 'win_pattern', 'invite_friends', 'deposit_birr')),
  target_count int not null default 1,
  pattern_filter text not null default '',
  reward_birr numeric not null default 10,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.player_mission_progress (
  player_id text not null,
  mission_date date not null default (now() at time zone 'utc')::date,
  progress_map jsonb not null default '{}'::jsonb,
  claimed_ids jsonb not null default '[]'::jsonb,
  all_bonus_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_id, mission_date)
);

alter table public.daily_missions enable row level security;
alter table public.player_mission_progress enable row level security;

-- ============================================================================
-- 8. Completed Game Rounds
-- ============================================================================
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  stake_birr numeric not null,
  round_number int not null,
  players_count int not null default 0,
  entries_count int not null default 0,
  total_pot_birr numeric not null default 0,
  commission_percent numeric not null default 20,
  commission_birr numeric not null default 0,
  prize_pool_birr numeric not null default 0,
  winners jsonb not null default '[]'::jsonb,
  called_numbers jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  ended_at timestamptz not null default now()
);

create index if not exists idx_rounds_ended_at on public.rounds (ended_at desc);

-- ============================================================================
-- 9. Deposit & Withdrawal Requests
-- ============================================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  player_name text not null,
  player_username text,
  tx_type text not null check (tx_type in ('deposit', 'withdraw')),
  bank_key text,
  button_id uuid,
  button_label text,
  user_message text,
  user_photo_file_id text,
  amount_birr numeric,
  voucher_code text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'done', 'incorrect')),
  resolved_by text,
  admin_group_id text,
  admin_group_message_id bigint,
  admin_group_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.transactions add column if not exists bank_key text;
alter table public.transactions add column if not exists voucher_code text;
alter table public.transactions add column if not exists resolved_by text;
alter table public.transactions add column if not exists admin_group_messages jsonb not null default '[]'::jsonb;

create index if not exists idx_transactions_created_at on public.transactions (created_at desc);

-- ============================================================================
-- 10. Bot User Session State
-- ============================================================================
create table if not exists public.bot_sessions (
  telegram_user_id text primary key,
  language text not null default 'en' check (language in ('en', 'am', 'om')),
  pending_action text,
  selected_button_id uuid,
  selected_button_label text,
  selected_bank_key text,
  temp_voucher_code text,
  updated_at timestamptz not null default now()
);

alter table public.bot_sessions add column if not exists selected_bank_key text;
alter table public.bot_sessions add column if not exists temp_voucher_code text;

-- ============================================================================
-- 11. Referral Ledger (supports Signup + 50+ Deposit + 100+ Deposit tiers)
-- ============================================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id text not null,
  referrer_name text not null,
  referrer_username text,
  referred_id text not null unique,
  referred_name text not null,
  referred_username text,
  signup_bonus_birr numeric not null default 0,
  deposit_50_bonus_birr numeric not null default 0,
  deposit_50_bonus_paid boolean not null default false,
  first_50_deposit_birr numeric,
  deposit_50_bonus_paid_at timestamptz,
  deposit_bonus_birr numeric not null default 0,
  deposit_bonus_paid boolean not null default false,
  first_qualifying_deposit_birr numeric,
  created_at timestamptz not null default now(),
  deposit_bonus_paid_at timestamptz
);

alter table public.referrals add column if not exists deposit_50_bonus_birr numeric not null default 0;
alter table public.referrals add column if not exists deposit_50_bonus_paid boolean not null default false;
alter table public.referrals add column if not exists first_50_deposit_birr numeric;
alter table public.referrals add column if not exists deposit_50_bonus_paid_at timestamptz;

-- ============================================================================
-- 12. Bot Broadcast Queue (Segmented + Scheduled + Seasonal Themes)
-- ============================================================================
create table if not exists public.bot_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message_text text not null,
  segment text not null default 'all',
  season_theme text not null default 'none',
  status text not null default 'pending' check (status in ('pending', 'sending', 'completed', 'failed')),
  total_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  error_message text,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.bot_broadcasts add column if not exists segment text not null default 'all';
alter table public.bot_broadcasts add column if not exists season_theme text not null default 'none';
alter table public.bot_broadcasts add column if not exists scheduled_for timestamptz;

-- ============================================================================
-- Clean up old conflicting function overloads safely before recreating RPCs
-- ============================================================================
drop function if exists public.admin_update_settings(text, text, text, text, text, text, text);
drop function if exists public.admin_update_referral_settings(text, numeric, numeric, numeric);
drop function if exists public.admin_update_bank_message(text, uuid, text, boolean);
drop function if exists public.admin_queue_broadcast(text, text);

-- ============================================================================
-- Helper: Assert Admin PIN
-- ============================================================================
create or replace function public._assert_admin_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  select admin_pin into v_pin from public.app_settings where id = 1;
  if v_pin is null then
    v_pin := '1234';
  end if;
  if coalesce(trim(p_pin), '') <> v_pin then
    raise exception 'Invalid Admin PIN';
  end if;
end;
$$;

-- ============================================================================
-- RPC 1: Load Full Admin Dashboard Snapshot
-- ============================================================================
create or replace function public.admin_get_dashboard(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_buttons jsonb;
  v_vouchers jsonb;
  v_templates jsonb;
  v_events jsonb;
  v_missions jsonb;
  v_players jsonb;
  v_rounds jsonb;
  v_transactions jsonb;
  v_referrals jsonb;
  v_broadcasts jsonb;
  v_stats jsonb;
begin
  perform public._assert_admin_pin(p_pin);

  select to_jsonb(s) - 'admin_pin' into v_settings
  from public.app_settings s where s.id = 1;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.flow_type asc, b.sort_order asc, b.created_at asc), '[]'::jsonb)
  into v_buttons
  from public.payment_buttons b;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.uses_count desc, v.total_deposited_birr desc, v.created_at desc), '[]'::jsonb)
  into v_vouchers
  from public.vouchers v;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.is_custom asc, t.template_key asc, t.language asc), '[]'::jsonb)
  into v_templates
  from public.bot_text_templates t;

  select coalesce(jsonb_agg(to_jsonb(se) order by se.is_active desc, se.created_at desc), '[]'::jsonb)
  into v_events
  from public.special_events se;

  select coalesce(jsonb_agg(to_jsonb(dm) order by dm.sort_order asc, dm.created_at asc), '[]'::jsonb)
  into v_missions
  from public.daily_missions dm;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc), '[]'::jsonb)
  into v_players
  from (select * from public.players order by updated_at desc limit 500) p;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.ended_at desc), '[]'::jsonb)
  into v_rounds
  from (select * from public.rounds order by ended_at desc limit 300) r;

  select coalesce(jsonb_agg(to_jsonb(tx) order by tx.created_at desc), '[]'::jsonb)
  into v_transactions
  from (select * from public.transactions order by created_at desc limit 500) tx;

  select coalesce(jsonb_agg(to_jsonb(rf) order by rf.created_at desc), '[]'::jsonb)
  into v_referrals
  from (select * from public.referrals order by created_at desc limit 1000) rf;

  select coalesce(jsonb_agg(to_jsonb(bc) order by bc.created_at desc), '[]'::jsonb)
  into v_broadcasts
  from (select * from public.bot_broadcasts order by created_at desc limit 50) bc;

  select jsonb_build_object(
    'totalRounds', (select count(*) from public.rounds),
    'totalCommissionBirr', (select coalesce(sum(commission_birr), 0) from public.rounds),
    'totalPotBirr', (select coalesce(sum(total_pot_birr), 0) from public.rounds),
    'totalPlayers', (select count(*) from public.players),
    'bannedPlayers', (select count(*) from public.players where is_banned = true),
    'totalDepositedBalance', (select coalesce(sum(deposited_birr), 0) from public.players),
    'totalWonBalance', (select coalesce(sum(won_birr), 0) from public.players),
    'acceptedDepositsBirr', (select coalesce(sum(amount_birr), 0) from public.transactions where tx_type = 'deposit' and status = 'accepted'),
    'completedWithdrawalsBirr', (select coalesce(sum(amount_birr), 0) from public.transactions where tx_type = 'withdraw' and status = 'done'),
    'pendingRequests', (select count(*) from public.transactions where status = 'pending'),
    'totalReferrals', (select count(*) from public.referrals),
    'qualified50Deposits', (select count(*) from public.referrals where deposit_50_bonus_paid = true),
    'qualifiedReferralDeposits', (select count(*) from public.referrals where deposit_bonus_paid = true),
    'totalReferralBonusesBirr', (select coalesce(sum(signup_bonus_birr + deposit_50_bonus_birr + deposit_bonus_birr), 0) from public.referrals),
    'totalVouchers', (select count(*) from public.vouchers),
    'totalVoucherUses', (select coalesce(sum(uses_count), 0) from public.vouchers),
    'totalVoucherDepositedBirr', (select coalesce(sum(total_deposited_birr), 0) from public.vouchers)
  ) into v_stats;

  return jsonb_build_object(
    'settings', v_settings,
    'payment_buttons', v_buttons,
    'vouchers', v_vouchers,
    'bot_text_templates', v_templates,
    'special_events', v_events,
    'daily_missions', v_missions,
    'players', v_players,
    'rounds', v_rounds,
    'transactions', v_transactions,
    'referrals', v_referrals,
    'broadcasts', v_broadcasts,
    'stats', v_stats
  );
end;
$$;

-- ============================================================================
-- RPC 2: Update Bot Messages, Admin Groups, Max Cartelas, Vouchers, Season, Admins
-- ============================================================================
create or replace function public.admin_update_settings(
  p_pin text,
  p_admin_group_id text,
  p_deposit_intro text,
  p_withdraw_intro text,
  p_withdraw_prompt text,
  p_new_pin text default null,
  p_extra_group_ids text default '',
  p_extra_admin_ids text default null,
  p_max_cartelas int default null,
  p_vouchers_enabled boolean default null,
  p_season_theme text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings;
begin
  perform public._assert_admin_pin(p_pin);

  update public.app_settings
  set
    admin_group_id = coalesce(trim(p_admin_group_id), admin_group_id),
    extra_group_ids = coalesce(trim(p_extra_group_ids), extra_group_ids),
    extra_admin_ids = case when p_extra_admin_ids is not null then trim(p_extra_admin_ids) else extra_admin_ids end,
    deposit_intro_text = coalesce(trim(p_deposit_intro), deposit_intro_text),
    withdraw_intro_text = coalesce(trim(p_withdraw_intro), withdraw_intro_text),
    withdraw_prompt_text = coalesce(trim(p_withdraw_prompt), withdraw_prompt_text),
    max_cartelas = case when p_max_cartelas is not null then greatest(100, least(600, p_max_cartelas)) else max_cartelas end,
    vouchers_enabled = case when p_vouchers_enabled is not null then p_vouchers_enabled else vouchers_enabled end,
    season_theme = case when p_season_theme is not null then trim(p_season_theme) else season_theme end,
    admin_pin = case when p_new_pin is not null and trim(p_new_pin) <> '' then trim(p_new_pin) else admin_pin end,
    updated_at = now()
  where id = 1
  returning * into v_row;

  return to_jsonb(v_row) - 'admin_pin';
end;
$$;

-- ============================================================================
-- RPC 3: Update Referral Bonus Settings
-- ============================================================================
create or replace function public.admin_update_referral_settings(
  p_pin text,
  p_signup_bonus numeric,
  p_deposit_bonus numeric,
  p_deposit_50_bonus numeric default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings;
begin
  perform public._assert_admin_pin(p_pin);

  update public.app_settings
  set
    referral_signup_bonus = greatest(0, coalesce(p_signup_bonus, 0)),
    referral_deposit_50_bonus = greatest(0, coalesce(p_deposit_50_bonus, 0)),
    referral_deposit_bonus = greatest(0, coalesce(p_deposit_bonus, 0)),
    updated_at = now()
  where id = 1
  returning * into v_row;

  return to_jsonb(v_row) - 'admin_pin';
end;
$$;

-- ============================================================================
-- RPC 4: Update Bank Message & Copyable Text
-- ============================================================================
create or replace function public.admin_update_bank_message(
  p_pin text,
  p_id uuid,
  p_response_text text,
  p_is_active boolean,
  p_copyable_text text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_buttons;
begin
  perform public._assert_admin_pin(p_pin);

  update public.payment_buttons
  set
    response_text = coalesce(p_response_text, ''),
    copyable_text = coalesce(trim(p_copyable_text), ''),
    is_active = coalesce(p_is_active, true)
  where id = p_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ============================================================================
-- RPC 5: Adjust Player Balance (+/- Deposit & Won)
-- ============================================================================
create or replace function public.admin_adjust_player_balance(
  p_pin text,
  p_player_id text,
  p_deposited_delta numeric,
  p_won_delta numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.players;
begin
  perform public._assert_admin_pin(p_pin);

  update public.players
  set
    deposited_birr = greatest(0, deposited_birr + coalesce(p_deposited_delta, 0)),
    won_birr = greatest(0, won_birr + coalesce(p_won_delta, 0)),
    total_deposited_birr = case
      when coalesce(p_deposited_delta, 0) > 0 then total_deposited_birr + p_deposited_delta
      else total_deposited_birr
    end,
    updated_at = now()
  where id = p_player_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ============================================================================
-- RPC 6: Toggle Player Ban / Unban
-- ============================================================================
create or replace function public.admin_toggle_player_ban(
  p_pin text,
  p_player_id text,
  p_is_banned boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.players;
begin
  perform public._assert_admin_pin(p_pin);

  update public.players
  set is_banned = coalesce(p_is_banned, false), updated_at = now()
  where id = p_player_id
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ============================================================================
-- RPC 7: Upsert & Delete Deposit Vouchers + Toggle Vouchers Enabled
-- ============================================================================
create or replace function public.admin_toggle_vouchers(
  p_pin text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings;
begin
  perform public._assert_admin_pin(p_pin);
  update public.app_settings
  set vouchers_enabled = coalesce(p_enabled, false), updated_at = now()
  where id = 1
  returning * into v_row;
  return to_jsonb(v_row) - 'admin_pin';
end;
$$;

create or replace function public.admin_upsert_voucher(
  p_pin text,
  p_code text,
  p_bonus_birr numeric,
  p_creator_name text,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vouchers;
  v_clean text;
begin
  perform public._assert_admin_pin(p_pin);
  v_clean := regexp_replace(upper(trim(coalesce(p_code, ''))), '[^A-Z0-9_-]+', '', 'g');
  if v_clean = '' then
    raise exception 'Voucher code cannot be empty';
  end if;

  insert into public.vouchers (code, bonus_birr, creator_name, is_active)
  values (v_clean, greatest(0, coalesce(p_bonus_birr, 0)), coalesce(nullif(trim(p_creator_name), ''), 'Admin'), coalesce(p_is_active, true))
  on conflict (code) do update
  set
    bonus_birr = excluded.bonus_birr,
    creator_name = excluded.creator_name,
    is_active = excluded.is_active
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_delete_voucher(
  p_pin text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin_pin(p_pin);
  delete from public.vouchers where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================
-- RPC 8: Bot Text & Button Flow Templates (Built-in + Custom Nodes)
-- ============================================================================
create or replace function public.admin_upsert_bot_template(
  p_pin text,
  p_template_key text,
  p_language text,
  p_title text,
  p_message_text text,
  p_buttons_config jsonb default '[]'::jsonb,
  p_is_custom boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bot_text_templates;
  v_key text;
begin
  perform public._assert_admin_pin(p_pin);
  v_key := lower(regexp_replace(trim(coalesce(p_template_key, '')), '[^a-z0-9_]+', '_', 'g'));
  if v_key = '' then
    raise exception 'Template key cannot be empty';
  end if;

  insert into public.bot_text_templates (template_key, language, title, message_text, buttons_config, is_custom, updated_at)
  values (
    v_key,
    coalesce(p_language, 'en'),
    coalesce(trim(p_title), v_key),
    coalesce(p_message_text, ''),
    coalesce(p_buttons_config, '[]'::jsonb),
    coalesce(p_is_custom, false),
    now()
  )
  on conflict (template_key, language) do update
  set
    title = excluded.title,
    message_text = excluded.message_text,
    buttons_config = excluded.buttons_config,
    is_custom = excluded.is_custom,
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_delete_bot_template(
  p_pin text,
  p_template_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin_pin(p_pin);
  delete from public.bot_text_templates where template_key = p_template_key;
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================
-- RPC 9: Special Event Rooms (10 Themes, Countdown, Min Players)
-- ============================================================================
create or replace function public.admin_upsert_special_event(
  p_pin text,
  p_id uuid default null,
  p_name text default '',
  p_description_text text default '',
  p_theme_key text default 'golden',
  p_entry_birr numeric default 20,
  p_bonus_prize_birr numeric default 100,
  p_min_players int default 0,
  p_ends_at timestamptz default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.special_events;
begin
  perform public._assert_admin_pin(p_pin);
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Event name cannot be empty';
  end if;

  if p_id is not null then
    update public.special_events
    set
      name = trim(p_name),
      description_text = coalesce(trim(p_description_text), ''),
      theme_key = coalesce(trim(p_theme_key), 'golden'),
      entry_birr = greatest(1, coalesce(p_entry_birr, 20)),
      bonus_prize_birr = greatest(0, coalesce(p_bonus_prize_birr, 0)),
      min_players = greatest(0, coalesce(p_min_players, 0)),
      ends_at = p_ends_at,
      is_active = coalesce(p_is_active, true)
    where id = p_id
    returning * into v_row;
  else
    insert into public.special_events (name, description_text, theme_key, entry_birr, bonus_prize_birr, min_players, ends_at, is_active)
    values (
      trim(p_name),
      coalesce(trim(p_description_text), ''),
      coalesce(trim(p_theme_key), 'golden'),
      greatest(1, coalesce(p_entry_birr, 20)),
      greatest(0, coalesce(p_bonus_prize_birr, 0)),
      greatest(0, coalesce(p_min_players, 0)),
      p_ends_at,
      coalesce(p_is_active, true)
    )
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_delete_special_event(
  p_pin text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin_pin(p_pin);
  delete from public.special_events where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================================
-- RPC 10: Daily Missions & VIP Rank Thresholds
-- ============================================================================
create or replace function public.admin_upsert_mission(
  p_pin text,
  p_id uuid default null,
  p_title text default '',
  p_mission_type text default 'play_rounds',
  p_target_count int default 1,
  p_pattern_filter text default '',
  p_reward_birr numeric default 10,
  p_is_active boolean default true,
  p_sort_order int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_missions;
begin
  perform public._assert_admin_pin(p_pin);
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Mission title cannot be empty';
  end if;

  if p_id is not null then
    update public.daily_missions
    set
      title = trim(p_title),
      mission_type = coalesce(p_mission_type, 'play_rounds'),
      target_count = greatest(1, coalesce(p_target_count, 1)),
      pattern_filter = coalesce(trim(p_pattern_filter), ''),
      reward_birr = greatest(0, coalesce(p_reward_birr, 0)),
      is_active = coalesce(p_is_active, true),
      sort_order = coalesce(p_sort_order, 0)
    where id = p_id
    returning * into v_row;
  else
    insert into public.daily_missions (title, mission_type, target_count, pattern_filter, reward_birr, is_active, sort_order)
    values (
      trim(p_title),
      coalesce(p_mission_type, 'play_rounds'),
      greatest(1, coalesce(p_target_count, 1)),
      coalesce(trim(p_pattern_filter), ''),
      greatest(0, coalesce(p_reward_birr, 0)),
      coalesce(p_is_active, true),
      coalesce(p_sort_order, 0)
    )
    returning * into v_row;
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_delete_mission(
  p_pin text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin_pin(p_pin);
  delete from public.daily_missions where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_update_rank_and_mission_settings(
  p_pin text,
  p_rank_thresholds jsonb,
  p_mission_completion_bonus numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_settings;
begin
  perform public._assert_admin_pin(p_pin);
  update public.app_settings
  set
    rank_thresholds = coalesce(p_rank_thresholds, rank_thresholds),
    mission_completion_bonus = greatest(0, coalesce(p_mission_completion_bonus, 0)),
    updated_at = now()
  where id = 1
  returning * into v_row;
  return to_jsonb(v_row) - 'admin_pin';
end;
$$;

-- ============================================================================
-- RPC 11: Targeted & Scheduled Broadcasts with Seasonal Themes
-- ============================================================================
create or replace function public.admin_queue_broadcast(
  p_pin text,
  p_message text,
  p_segment text default 'all',
  p_season_theme text default 'none',
  p_scheduled_for timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bot_broadcasts;
  v_clean text;
begin
  perform public._assert_admin_pin(p_pin);
  v_clean := trim(coalesce(p_message, ''));
  if v_clean = '' then
    raise exception 'Broadcast message cannot be empty';
  end if;

  insert into public.bot_broadcasts (message_text, segment, season_theme, scheduled_for, status)
  values (v_clean, coalesce(p_segment, 'all'), coalesce(p_season_theme, 'none'), p_scheduled_for, 'pending')
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

-- ============================================================================
-- RPC 12: Clear Historical Data
-- ============================================================================
create or replace function public.admin_clear_data(
  p_pin text,
  p_scope text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin_pin(p_pin);

  if p_scope = 'rounds' then
    delete from public.rounds;
  elsif p_scope = 'transactions' then
    delete from public.transactions;
  elsif p_scope = 'referrals' then
    delete from public.referrals;
  elsif p_scope = 'broadcasts' then
    delete from public.bot_broadcasts;
  elsif p_scope = 'players' then
    delete from public.players;
    delete from public.player_mission_progress;
  elsif p_scope = 'all' then
    delete from public.rounds;
    delete from public.transactions;
    delete from public.referrals;
    delete from public.bot_broadcasts;
    delete from public.players;
    delete from public.player_mission_progress;
  else
    raise exception 'Unknown clear scope: %', p_scope;
  end if;

  return jsonb_build_object('ok', true, 'scope', p_scope);
end;
$$;

-- Seed helpful starter missions only if table is empty
insert into public.daily_missions (title, mission_type, target_count, pattern_filter, reward_birr, is_active, sort_order)
select * from (values
  ('Play 5 rounds today', 'play_rounds', 5, '', 15, true, 1),
  ('Win with a 4-Corners pattern', 'win_pattern', 1, 'Four Corners', 30, true, 2),
  ('Invite 2 friends via Bot', 'invite_friends', 2, '', 25, true, 3)
) as v(title, mission_type, target_count, pattern_filter, reward_birr, is_active, sort_order)
where not exists (select 1 from public.daily_missions);

-- Permissions for Supabase Anon/Authenticated RPC callers
grant execute on function public.admin_get_dashboard(text) to anon, authenticated;
grant execute on function public.admin_update_settings(text, text, text, text, text, text, text, text, int, boolean, text) to anon, authenticated;
grant execute on function public.admin_update_referral_settings(text, numeric, numeric, numeric) to anon, authenticated;
grant execute on function public.admin_update_bank_message(text, uuid, text, boolean, text) to anon, authenticated;
grant execute on function public.admin_adjust_player_balance(text, text, numeric, numeric) to anon, authenticated;
grant execute on function public.admin_toggle_player_ban(text, text, boolean) to anon, authenticated;
grant execute on function public.admin_toggle_vouchers(text, boolean) to anon, authenticated;
grant execute on function public.admin_upsert_voucher(text, text, numeric, text, boolean) to anon, authenticated;
grant execute on function public.admin_delete_voucher(text, uuid) to anon, authenticated;
grant execute on function public.admin_upsert_bot_template(text, text, text, text, text, jsonb, boolean) to anon, authenticated;
grant execute on function public.admin_delete_bot_template(text, text) to anon, authenticated;
grant execute on function public.admin_upsert_special_event(text, uuid, text, text, text, numeric, numeric, int, timestamptz, boolean) to anon, authenticated;
grant execute on function public.admin_delete_special_event(text, uuid) to anon, authenticated;
grant execute on function public.admin_upsert_mission(text, uuid, text, text, int, text, numeric, boolean, int) to anon, authenticated;
grant execute on function public.admin_delete_mission(text, uuid) to anon, authenticated;
grant execute on function public.admin_update_rank_and_mission_settings(text, jsonb, numeric) to anon, authenticated;
grant execute on function public.admin_queue_broadcast(text, text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.admin_clear_data(text, text) to anon, authenticated;

-- Helpful lookup indexes for high-traffic sync and admin queries
create index if not exists idx_players_updated_at on public.players (updated_at desc);
create index if not exists idx_referrals_referrer_id on public.referrals (referrer_id);
create index if not exists idx_transactions_status on public.transactions (status);
