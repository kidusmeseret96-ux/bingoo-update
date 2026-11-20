import React from 'react';
import { BINGO_LETTERS, getColumnRange } from '../../shared/bingo';
import { Translations } from '../utils/i18n';

interface MasterBoardProps {
  calledNumbers: number[];
  currentBall: number | null;
  t: Translations;
  compact?: boolean;
}

export const MasterBoard: React.FC<MasterBoardProps> = ({
  calledNumbers,
  currentBall,
  t,
  compact = false,
}) => {
  const calledSet = React.useMemo(() => new Set(calledNumbers), [calledNumbers]);

  const colHeaderColors = [
    'bg-pink-600 text-white',
    'bg-amber-400 text-purple-950',
    'bg-fuchsia-600 text-white',
    'bg-purple-600 text-white',
    'bg-yellow-400 text-purple-950',
  ];

  return (
    <div
      className={`rounded-2xl bg-white/95 dark:bg-[#15072E]/95 border border-pink-200 dark:border-purple-500/35 shadow-md shadow-pink-500/10 dark:shadow-purple-900/25 ${
        compact ? 'p-2 sm:p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <h2
          className={`font-display font-bold text-purple-950 dark:text-white truncate ${
            compact ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {t.board75Title}
        </h2>
        <span className="font-mono text-[11px] font-bold text-pink-600 dark:text-amber-300 tabular-nums shrink-0">
          {calledNumbers.length}/75
        </span>
      </div>

      {/* All 75 numbers rendered simultaneously in 5 columns x 15 rows — zero swiping required */}
      <div className={`grid grid-cols-5 ${compact ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
        {BINGO_LETTERS.map((letter, colIdx) => {
          const [min] = getColumnRange(colIdx);
          const nums = Array.from({ length: 15 }, (_, i) => min + i);
          return (
            <div key={letter} className={`flex flex-col ${compact ? 'gap-0.5 sm:gap-1' : 'gap-1.5'}`}>
              <div
                className={`rounded-md flex items-center justify-center font-display font-extrabold ${colHeaderColors[colIdx]} ${
                  compact ? 'h-5 sm:h-7 text-[11px] sm:text-sm' : 'h-8 text-base'
                }`}
              >
                {letter}
              </div>
              {nums.map((n) => {
                const isCalled = calledSet.has(n);
                const isCurrent = currentBall === n;
                return (
                  <div
                    key={n}
                    className={`rounded-md flex items-center justify-center font-mono font-bold tabular-nums transition-colors duration-150 ${
                      compact
                        ? 'h-[21px] sm:h-7 text-[11px] sm:text-xs'
                        : 'h-8 sm:h-9 text-xs sm:text-sm'
                    } ${
                      isCurrent
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-300 text-purple-950 ring-2 ring-amber-300 shadow-sm'
                        : isCalled
                          ? 'bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 text-white shadow-xs'
                          : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-400 dark:text-purple-500 border border-pink-200/80 dark:border-purple-500/30'
                    }`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
