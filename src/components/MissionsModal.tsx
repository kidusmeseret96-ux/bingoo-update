import React from 'react';
import { CheckCircle2, Gift, Sparkles, Target, Trophy, X } from 'lucide-react';
import {
  DEFAULT_RANK_THRESHOLDS,
  PlayerMissionState,
  RankThresholds,
  RankTierId,
  computeRankTier,
} from '../../shared/bingo';
import { Translations } from '../utils/i18n';
import { RankBadge } from './RankBadge';

interface MissionsModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  missionsState: PlayerMissionState | null;
  totalDeposited: number;
  rankTier: RankTierId;
  rankThresholds: RankThresholds;
  onClaimMission: (missionId: string) => void;
  onClaimAllBonus: () => void;
}

const RANK_ORDER: RankTierId[] = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];

export const MissionsModal: React.FC<MissionsModalProps> = ({
  open,
  onClose,
  t,
  missionsState,
  totalDeposited,
  rankTier,
  rankThresholds,
  onClaimMission,
  onClaimAllBonus,
}) => {
  if (!open) return null;

  const thresholds = rankThresholds || DEFAULT_RANK_THRESHOLDS;
  const activeRank = rankTier || computeRankTier(totalDeposited, thresholds);
  const currentIdx = RANK_ORDER.indexOf(activeRank);
  const nextRank = currentIdx >= 0 && currentIdx < RANK_ORDER.length - 1 ? RANK_ORDER[currentIdx + 1] : null;
  const nextThreshold = nextRank ? thresholds[nextRank] : thresholds.platinum;
  const currentThreshold = thresholds[activeRank] ?? 0;
  const rankSpan = Math.max(1, nextThreshold - currentThreshold);
  const rankPct = nextRank
    ? Math.max(0, Math.min(100, ((totalDeposited - currentThreshold) / rankSpan) * 100))
    : 100;

  const missions = (missionsState?.missions || []).filter((m) => m.isActive);
  const progressMap = missionsState?.progressMap || {};
  const claimedSet = new Set(missionsState?.claimedIds || []);
  const allCompleted =
    missions.length > 0 &&
    missions.every((m) => (progressMap[m.id] || 0) >= m.targetCount);
  const allClaimed = Boolean(missionsState?.allBonusClaimed);
  const grandBonus = missionsState?.completionBonusBirr || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090216]/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="missions-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto hall-scroll rounded-t-3xl sm:rounded-2xl bg-[#FFF5FA] dark:bg-[#15072E] border border-pink-200 dark:border-purple-500/35 text-purple-950 dark:text-purple-50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-white/95 dark:bg-[#15072E]/95 backdrop-blur-md border-b border-pink-200 dark:border-purple-500/30">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-pink-600 dark:text-amber-400" />
            <h2 id="missions-modal-title" className="font-display text-lg font-bold">
              {t.dailyQuests}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close missions"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-purple-600 dark:text-purple-300 hover:bg-pink-100 dark:hover:bg-[#230B48] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* VIP Rank Card */}
          <div className="rounded-2xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                  {t.vipRank}
                </div>
                <div className="flex items-center gap-2">
                  <RankBadge rank={activeRank} size="md" />
                  <span className="text-xs font-mono font-bold text-purple-800 dark:text-amber-300 tabular-nums">
                    {totalDeposited.toLocaleString()} {t.birr}
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-purple-600 dark:text-purple-300">
                {nextRank ? (
                  <span>
                    {t.nextTierAt}:{' '}
                    <strong className="font-mono text-purple-950 dark:text-amber-300">
                      {nextThreshold.toLocaleString()} {t.birr}
                    </strong>
                  </span>
                ) : (
                  <span className="font-bold text-pink-600 dark:text-amber-300">
                    {t.maxRankReached}
                  </span>
                )}
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-pink-100 dark:bg-[#0D0320] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  activeRank === 'platinum'
                    ? 'platinum-holo'
                    : 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400'
                }`}
                style={{ width: `${rankPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between gap-1 pt-1 overflow-x-auto">
              {RANK_ORDER.map((r) => (
                <div
                  key={r}
                  className={`flex flex-col items-center gap-1 transition-opacity ${
                    RANK_ORDER.indexOf(r) <= currentIdx ? 'opacity-100' : 'opacity-45'
                  }`}
                >
                  <RankBadge rank={r} size="xs" />
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-300 tabular-nums">
                    {thresholds[r]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* All-Completed Grand Bonus Banner */}
          {grandBonus > 0 && missions.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-500 p-4 text-white shadow-lg shadow-pink-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-300 text-purple-950 flex items-center justify-center shrink-0 shadow-sm">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm truncate">
                    {t.allBonusTitle}
                  </div>
                  <div className="text-xs text-pink-100 truncate">
                    {t.allBonusDesc} · +{grandBonus} {t.birr}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!allCompleted || allClaimed}
                onClick={onClaimAllBonus}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                  allClaimed
                    ? 'bg-emerald-500 text-white cursor-default'
                    : allCompleted
                      ? 'bg-amber-300 text-purple-950 hover:bg-amber-200 shadow-md'
                      : 'bg-white/20 text-white/70 cursor-not-allowed'
                }`}
              >
                {allClaimed ? t.claimedStatus : `+${grandBonus} ${t.birr}`}
              </button>
            </div>
          )}

          {/* Daily Mission Cards */}
          {missions.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 p-6 text-center text-xs text-purple-600 dark:text-purple-300">
              {t.noMissionsToday}
            </div>
          ) : (
            <div className="space-y-2.5">
              {missions.map((m) => {
                const current = Math.min(m.targetCount, progressMap[m.id] || 0);
                const pct = Math.min(100, Math.round((current / Math.max(1, m.targetCount)) * 100));
                const done = current >= m.targetCount;
                const claimed = claimedSet.has(m.id);

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-purple-950 dark:text-white flex items-center gap-1.5">
                          <Gift className="w-4 h-4 text-pink-500 dark:text-amber-400 shrink-0" />
                          <span className="truncate">{m.title}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-mono text-purple-600 dark:text-purple-300 tabular-nums">
                          <span>
                            {current}/{m.targetCount}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-amber-600 dark:text-amber-300">
                            +{m.rewardBirr} {t.birr}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!done || claimed}
                        onClick={() => onClaimMission(m.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all flex items-center gap-1 ${
                          claimed
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default'
                            : done
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 hover:brightness-105 shadow-sm'
                              : 'bg-pink-100 dark:bg-[#0D0320] text-purple-400 dark:text-purple-400 border border-pink-200 dark:border-purple-500/30 cursor-not-allowed'
                        }`}
                      >
                        {claimed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t.claimedStatus}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            {t.claim}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-pink-100 dark:bg-[#0D0320] overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          claimed
                            ? 'bg-emerald-500'
                            : done
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
