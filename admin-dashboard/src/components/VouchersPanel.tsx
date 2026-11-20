import React, { useMemo, useState } from 'react';
import { Award, Plus, TicketPercent, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type { VoucherRecord } from '../types';

interface Props {
  vouchersEnabled: boolean;
  vouchers: VoucherRecord[];
  busy: boolean;
  onToggleEnabled: (enabled: boolean) => Promise<void>;
  onUpsertVoucher: (payload: {
    code: string;
    bonus_birr: number;
    creator_name: string;
    is_active: boolean;
  }) => Promise<void>;
  onDeleteVoucher: (id: string) => Promise<void>;
}

export const VouchersPanel: React.FC<Props> = ({
  vouchersEnabled,
  vouchers,
  busy,
  onToggleEnabled,
  onUpsertVoucher,
  onDeleteVoucher,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [bonusInput, setBonusInput] = useState('25');
  const [creatorInput, setCreatorInput] = useState('');
  const [activeInput, setActiveInput] = useState(true);

  const sortedVouchers = useMemo(() => {
    return [...vouchers].sort(
      (a, b) =>
        Number(b.uses_count || 0) - Number(a.uses_count || 0) ||
        Number(b.total_deposited_birr || 0) - Number(a.total_deposited_birr || 0)
    );
  }, [vouchers]);

  const mostUsed = sortedVouchers[0] || null;
  const topDeposited = useMemo(() => {
    if (vouchers.length === 0) return null;
    return [...vouchers].sort(
      (a, b) => Number(b.total_deposited_birr || 0) - Number(a.total_deposited_birr || 0)
    )[0];
  }, [vouchers]);

  const totalUses = vouchers.reduce((sum, v) => sum + Number(v.uses_count || 0), 0);
  const totalDepositedBirr = vouchers.reduce((sum, v) => sum + Number(v.total_deposited_birr || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = codeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleaned) return;
    await onUpsertVoucher({
      code: cleaned,
      bonus_birr: Math.max(0, Number(bonusInput) || 0),
      creator_name: creatorInput.trim(),
      is_active: activeInput,
    });
    setCodeInput('');
    setCreatorInput('');
  };

  return (
    <div className="space-y-6">
      {/* Global Voucher Enable Switch */}
      <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
            <TicketPercent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Deposit Vouchers &amp; Promo Coupons</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              When enabled, players choosing a Deposit bank are asked for an optional voucher code before sending payment proof. Approved deposits automatically grant the voucher bonus!
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleEnabled(!vouchersEnabled)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer transition-all whitespace-nowrap shrink-0 ${
            vouchersEnabled
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110 shadow-md shadow-emerald-500/20'
              : 'bg-blue-50 dark:bg-[#081022] text-slate-700 dark:text-slate-300 border border-blue-200 dark:border-blue-500/25 hover:bg-blue-100 dark:hover:bg-blue-500/15'
          }`}
        >
          {vouchersEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          {vouchersEnabled ? 'Vouchers ENABLED' : 'Vouchers DISABLED'}
        </button>
      </div>

      {/* Voucher Performance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-50/80 dark:bg-[#19150E]/90 border border-amber-200/80 dark:border-amber-500/30 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            Most Used Voucher
          </p>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {mostUsed ? `${mostUsed.code} (${mostUsed.uses_count} uses)` : '—'}
          </p>
          {mostUsed?.creator_name && (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">By {mostUsed.creator_name}</p>
          )}
        </div>

        <div className="bg-emerald-50/80 dark:bg-[#0B1C1E]/90 border border-emerald-200/80 dark:border-emerald-500/30 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Top Deposited Volume</p>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {topDeposited
              ? `${topDeposited.code} · ${Number(topDeposited.total_deposited_birr || 0).toLocaleString()} Birr`
              : '—'}
          </p>
        </div>

        <div className="bg-blue-50/80 dark:bg-[#0D1833]/90 border border-blue-200/80 dark:border-blue-500/30 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-blue-800 dark:text-sky-300">Total Voucher Redemptions</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{totalUses}</p>
        </div>

        <div className="bg-cyan-50/80 dark:bg-[#091A2B]/90 border border-cyan-200/80 dark:border-cyan-500/30 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-cyan-800 dark:text-cyan-300">Total Deposited With Vouchers</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {totalDepositedBirr.toLocaleString('en-US', { maximumFractionDigits: 2 })} Birr
          </p>
        </div>
      </div>

      {/* Add / Update Voucher Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Create or Update Voucher Code</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Voucher Code</label>
            <input
              type="text"
              required
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. ZEMEN50"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums uppercase bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Owner / Creator Name</label>
            <input
              type="text"
              value={creatorInput}
              onChange={(e) => setCreatorInput(e.target.value)}
              placeholder="e.g. Dawit / TikTok Promo"
              className="w-full px-3 py-2 text-sm bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Bonus Given (Birr)</label>
            <input
              type="number"
              min={0}
              step="any"
              required
              value={bonusInput}
              onChange={(e) => setBonusInput(e.target.value)}
              className="w-full px-3 py-2 text-sm tabular-nums bg-blue-50/60 dark:bg-[#070E20] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 pb-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={activeInput}
              onChange={(e) => setActiveInput(e.target.checked)}
              className="accent-blue-600"
            />
            Active immediately
          </label>

          <button
            type="submit"
            disabled={busy || !codeInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Save Voucher
          </button>
        </div>
      </form>

      {/* Vouchers Leaderboard Table */}
      <div className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">All Vouchers (Ranked by Most Used)</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{sortedVouchers.length} code(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                <th className="py-2.5 px-4">Rank</th>
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Person / Promoter</th>
                <th className="py-2.5 px-4 text-right">Bonus Reward</th>
                <th className="py-2.5 px-4 text-right">Uses Count</th>
                <th className="py-2.5 px-4 text-right">Deposited Volume</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
              {sortedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No voucher codes created yet.
                  </td>
                </tr>
              ) : (
                sortedVouchers.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors">
                    <td className="py-2.5 px-4 tabular-nums font-bold text-slate-700 dark:text-slate-300">#{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-blue-700 dark:text-cyan-300">{v.code}</td>
                    <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">{v.creator_name || '—'}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                      +{v.bonus_birr} Birr
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                      {v.uses_count}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {Number(v.total_deposited_birr || 0).toLocaleString()} Birr
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      {v.is_active ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Paused</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onUpsertVoucher({
                            code: v.code,
                            bonus_birr: v.bonus_birr,
                            creator_name: v.creator_name,
                            is_active: !v.is_active,
                          })
                        }
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-lg cursor-pointer"
                      >
                        {v.is_active ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeleteVoucher(v.id)}
                        className="p-1.5 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg cursor-pointer inline-flex align-middle"
                        title="Delete voucher"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
