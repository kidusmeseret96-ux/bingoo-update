import React, { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Copy, Pencil, Save, Sparkles, X } from 'lucide-react';
import type { DashboardSettings, PaymentButton } from '../types';

interface Props {
  settings: DashboardSettings;
  buttons: PaymentButton[];
  busy: boolean;
  onSaveSettings: (patch: {
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
  }) => Promise<void>;
  onSaveBankMessage: (
    id: string,
    responseText: string,
    isActive: boolean,
    label: string,
    copyableText: string
  ) => Promise<void>;
}

const BANK_DISPLAY_NAMES: Record<string, string> = {
  telebirr: 'Telebirr (ቴሌብር)',
  cbe: 'CBE (ሲቢኢ)',
  cbe_birr: 'CBE Birr (ሲቢኢ ብር)',
  abyssinia: 'Abyssinia Bank (አቢሲኒያ ባንክ)',
  awash: 'Awash Bank (አዋሽ ባንክ)',
  kaffi: 'Kaffi (ካፊ)',
  ebirr: 'E-Birr (ኢ-ብር)',
  coop: 'Coop (ኩፕ / Baankii Coop)',
};

const SEASON_THEMES = [
  { value: 'none', label: 'None (Standard Theme)' },
  { value: 'christmas', label: 'Christmas (Falling Snowflakes)' },
  { value: 'enkutatash', label: 'Enkutatash (Yellow Adey Abeba Flowers)' },
  { value: 'golden', label: 'Golden Sparkle Festival' },
  { value: 'cyber', label: 'Neon Cyber Night' },
];

export const ButtonsConfigurator: React.FC<Props> = ({
  settings,
  buttons,
  busy,
  onSaveSettings,
  onSaveBankMessage,
}) => {
  const [adminGroupId, setAdminGroupId] = useState(settings.admin_group_id || '');
  const [extraGroupIds, setExtraGroupIds] = useState(settings.extra_group_ids || '');
  const [extraAdminIds, setExtraAdminIds] = useState(settings.extra_admin_ids || '');
  const [depositIntro, setDepositIntro] = useState(settings.deposit_intro_text || '');
  const [withdrawIntro, setWithdrawIntro] = useState(settings.withdraw_intro_text || '');
  const [withdrawPrompt, setWithdrawPrompt] = useState(settings.withdraw_prompt_text || '');
  const [maxCartelas, setMaxCartelas] = useState(String(settings.max_cartelas ?? 400));
  const [vouchersEnabled, setVouchersEnabled] = useState(Boolean(settings.vouchers_enabled));
  const [seasonTheme, setSeasonTheme] = useState(settings.season_theme || 'none');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    setAdminGroupId(settings.admin_group_id || '');
    setExtraGroupIds(settings.extra_group_ids || '');
    setExtraAdminIds(settings.extra_admin_ids || '');
    setDepositIntro(settings.deposit_intro_text || '');
    setWithdrawIntro(settings.withdraw_intro_text || '');
    setWithdrawPrompt(settings.withdraw_prompt_text || '');
    setMaxCartelas(String(settings.max_cartelas ?? 400));
    setVouchersEnabled(Boolean(settings.vouchers_enabled));
    setSeasonTheme(settings.season_theme || 'none');
  }, [
    settings.admin_group_id,
    settings.extra_group_ids,
    settings.extra_admin_ids,
    settings.deposit_intro_text,
    settings.withdraw_intro_text,
    settings.withdraw_prompt_text,
    settings.max_cartelas,
    settings.vouchers_enabled,
    settings.season_theme,
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReply, setEditReply] = useState('');
  const [editCopyable, setEditCopyable] = useState('');
  const [editActive, setEditActive] = useState(true);

  const depositButtons = buttons
    .filter((b) => b.flow_type === 'deposit')
    .sort((a, b) => a.sort_order - b.sort_order);

  const withdrawButtons = buttons
    .filter((b) => b.flow_type === 'withdraw')
    .sort((a, b) => a.sort_order - b.sort_order);

  const startEdit = (b: PaymentButton) => {
    setEditingId(b.id);
    setEditReply(b.response_text || '');
    setEditCopyable(b.copyable_text || '');
    setEditActive(b.is_active);
  };

  const handleSave = async (b: PaymentButton) => {
    await onSaveBankMessage(b.id, editReply.trim(), editActive, b.label, editCopyable.trim());
    setEditingId(null);
  };

  const checkCopyableMatch = (msg: string, copy: string) => {
    const tokens = copy
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.length === 0) return { hasTokens: false, matched: [] as string[], missing: [] as string[] };
    const matched = tokens.filter((t) => msg.includes(t));
    const missing = tokens.filter((t) => !msg.includes(t));
    return { hasTokens: true, matched, missing };
  };

  const renderBankList = (
    list: PaymentButton[],
    flowType: 'deposit' | 'withdraw',
    emptyFallbackLabel: string
  ) => (
    <div className="divide-y divide-blue-100/80 dark:divide-blue-500/15 mt-2">
      {list.length === 0 ? (
        <p className="py-6 text-sm text-slate-500 dark:text-slate-400">
          Preset bank buttons will appear automatically once the schema is initialized in Supabase.
        </p>
      ) : (
        list.map((b) => {
          const isEditing = editingId === b.id;
          const displayName = (b.bank_key && BANK_DISPLAY_NAMES[b.bank_key]) || b.label;
          const matchStatus = isEditing ? checkCopyableMatch(editReply, editCopyable) : null;

          return (
            <div key={b.id} className="py-4">
              {isEditing ? (
                <div className="space-y-3 bg-blue-50/50 dark:bg-[#081022] p-4 rounded-xl border border-blue-200/70 dark:border-blue-500/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="accent-blue-600"
                      />
                      Visible in Bot
                    </label>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Account Details Message Sent by Bot
                      </label>
                      <textarea
                        rows={3}
                        value={editReply}
                        onChange={(e) => setEditReply(e.target.value)}
                        placeholder={
                          flowType === 'deposit'
                            ? 'e.g. Send your deposit via Telebirr to 0911223344 (Abebe Kebede), then send a screenshot here.'
                            : 'Optional custom withdraw message for this bank (leave blank to use Default Withdrawal Instruction)...'
                        }
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Add Copyable Text (Account / Phone)
                      </label>
                      <textarea
                        rows={3}
                        value={editCopyable}
                        onChange={(e) => setEditCopyable(e.target.value)}
                        placeholder="e.g. 0911223344 or 1000987654321"
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Matching text inside the message becomes one-tap copyable in Telegram (comma or newline for multiple).
                      </p>
                    </div>
                  </div>

                  {matchStatus?.hasTokens && (
                    <div className="text-xs px-3 py-2 rounded-xl border bg-white dark:bg-[#0D162E] border-blue-200 dark:border-blue-500/25 flex flex-wrap items-center gap-2">
                      {matchStatus.matched.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tap-to-copy active for: {matchStatus.matched.map((t) => `"${t}"`).join(', ')}
                        </span>
                      )}
                      {matchStatus.missing.length > 0 && (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          Not found in message yet: {matchStatus.missing.map((t) => `"${t}"`).join(', ')}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSave(b)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-sm shadow-blue-500/20 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0D162E] hover:bg-blue-50 dark:hover:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{displayName}</span>
                      {!b.is_active && (
                        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Hidden in Bot</span>
                      )}
                      {b.copyable_text && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono tabular-nums font-semibold text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                          <Copy className="w-3 h-3" />
                          Copyable: {b.copyable_text}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                      {b.response_text || emptyFallbackLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(b)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Message
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const parsedCartelas = Math.min(600, Math.max(100, Math.floor(Number(maxCartelas) || 400)));

  return (
    <div className="space-y-8">
      {/* Bot Messages, Game Limits & Admin Controls */}
      <section className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Bot Messages, Game Limits &amp; Admins</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Configure admin groups, extra Telegram admins, cartela board limit (100–600), seasonal effects, and bot messages.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onSaveSettings({
                admin_group_id: adminGroupId.trim(),
                extra_group_ids: extraGroupIds.trim(),
                extra_admin_ids: extraAdminIds.trim(),
                deposit_intro_text: depositIntro.trim(),
                withdraw_intro_text: withdrawIntro.trim(),
                withdraw_prompt_text: withdrawPrompt.trim(),
                max_cartelas: parsedCartelas,
                vouchers_enabled: vouchersEnabled,
                season_theme: seasonTheme,
                new_pin: newPin.trim() || undefined,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save All Settings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Primary Admin Telegram Group ID (or run /setgroup inside your group)
            </label>
            <input
              type="text"
              value={adminGroupId}
              onChange={(e) => setAdminGroupId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Change Dashboard &amp; Mini App Admin PIN (optional)
            </label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Leave empty to keep current PIN"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Additional Payment Channel / Group IDs (comma or newline separated)
            </label>
            <textarea
              rows={2}
              value={extraGroupIds}
              onChange={(e) => setExtraGroupIds(e.target.value)}
              placeholder="-1001122334455, -1005566778899"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Deposit &amp; withdrawal payment messages are copied to every listed group/channel.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Extra Admin Telegram User IDs (comma separated)
            </label>
            <textarea
              rows={2}
              value={extraAdminIds}
              onChange={(e) => setExtraAdminIds(e.target.value)}
              placeholder="123456789, 987654321"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Added users unlock the in-game Admin Panel and admin bot moderation commands.
            </p>
          </div>

          {/* Cartela Count, Season Theme & Vouchers Quick Toggle */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-blue-50/50 dark:bg-[#081022] border border-blue-200/70 dark:border-blue-500/20">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Active Cartelas Limit (100 – 600)
              </label>
              <input
                type="number"
                min={100}
                max={600}
                value={maxCartelas}
                onChange={(e) => setMaxCartelas(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Default is 400 preset boards. Can be adjusted up to 600 max.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Mini App Seasonal Overlay
                </span>
              </label>
              <select
                value={seasonTheme}
                onChange={(e) => setSeasonTheme(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {SEASON_THEMES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Adds live snow, Enkutatash Adey Abeba flowers, or festival particles inside the game.
              </p>
            </div>

            <div className="flex flex-col justify-center">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={vouchersEnabled}
                  onChange={(e) => setVouchersEnabled(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-600"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">
                    Ask for Voucher / Coupon on Deposit
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    When enabled, the bot prompts players for an optional coupon code before payment proof.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Deposit Menu Intro Message (optional override)
            </label>
            <textarea
              rows={2}
              value={depositIntro}
              onChange={(e) => setDepositIntro(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Withdraw Menu Intro Message (optional override)
            </label>
            <textarea
              rows={2}
              value={withdrawIntro}
              onChange={(e) => setWithdrawIntro(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              Default Withdrawal Instruction Message (used when a bank does not have its own custom withdraw message below)
            </label>
            <textarea
              rows={2}
              value={withdrawPrompt}
              onChange={(e) => setWithdrawPrompt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Preset Deposit Banks (8 Fixed Banks) */}
      <section className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Deposit Bank Messages (8 Preset Banks)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Edit the account instructions and set the exact Copyable Text (account number / phone) so Telegram lets players copy it with a single tap.
            </p>
          </div>
        </div>
        {renderBankList(depositButtons, 'deposit', 'No custom message set yet.')}
      </section>

      {/* Preset Withdraw Banks (8 Fixed Banks) */}
      <section className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/25">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Withdraw Bank Messages (8 Preset Banks)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Edit a bank-specific withdrawal message below, or leave blank to automatically send the Default Withdrawal Instruction above.
            </p>
          </div>
        </div>
        {renderBankList(
          withdrawButtons,
          'withdraw',
          'Using Default Withdrawal Instruction Message.'
        )}
      </section>
    </div>
  );
};

