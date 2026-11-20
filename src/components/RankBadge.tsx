import React from 'react';
import { Award, Crown, Gem, Shield, Sparkles } from 'lucide-react';
import { RankTierId } from '../../shared/bingo';

export const RANK_META: Record<
  RankTierId,
  {
    label: string;
    containerClass: string;
    iconClass: string;
  }
> = {
  bronze: {
    label: 'Bronze',
    containerClass:
      'bg-gradient-to-r from-amber-800/90 to-orange-700/90 text-amber-100 border border-amber-500/50 shadow-xs',
    iconClass: 'text-amber-200',
  },
  silver: {
    label: 'Silver',
    containerClass:
      'bg-gradient-to-r from-slate-200 via-white to-slate-300 dark:from-slate-600 dark:via-slate-400 dark:to-slate-600 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-300/60 shadow-xs',
    iconClass: 'text-slate-700 dark:text-slate-100',
  },
  gold: {
    label: 'Gold',
    containerClass:
      'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-purple-950 border border-yellow-200 shadow-sm shadow-amber-500/30',
    iconClass: 'text-amber-900',
  },
  diamond: {
    label: 'Diamond',
    containerClass:
      'bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-500 text-slate-950 border border-cyan-200 shadow-md shadow-cyan-400/35 ring-1 ring-white/40',
    iconClass: 'text-indigo-950',
  },
  platinum: {
    label: 'PLATINUM',
    containerClass:
      'platinum-holo text-purple-950 border border-white/80 shadow-lg shadow-fuchsia-500/45 ring-1 ring-yellow-200/80 font-extrabold tracking-wide',
    iconClass: 'text-purple-950 drop-shadow-xs',
  },
};

interface RankBadgeProps {
  rank?: RankTierId;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  rank = 'bronze',
  size = 'xs',
  showLabel = true,
}) => {
  const meta = RANK_META[rank] || RANK_META.bronze;

  const iconSize =
    size === 'md' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  const padClass =
    size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5 rounded-lg'
      : size === 'sm'
        ? 'px-2 py-0.5 text-[11px] gap-1 rounded-md'
        : 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md';

  const Icon =
    rank === 'platinum'
      ? Sparkles
      : rank === 'diamond'
        ? Gem
        : rank === 'gold'
          ? Crown
          : rank === 'silver'
            ? Award
            : Shield;

  return (
    <span
      title={`${meta.label} VIP Rank`}
      className={`inline-flex items-center shrink-0 leading-none font-display font-bold select-none ${padClass} ${meta.containerClass}`}
    >
      <Icon className={`${iconSize} ${meta.iconClass} shrink-0`} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
};
