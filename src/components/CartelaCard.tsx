import React from 'react';
import { Star, Trash2, Check, Trophy } from 'lucide-react';
import {
  BINGO_LETTERS,
  CartelaEntry,
  GamePhase,
  checkWinningPattern,
} from '../../shared/bingo';
import { Translations } from '../utils/i18n';

interface CartelaCardProps {
  entry: CartelaEntry;
  phase: GamePhase;
  calledSet: Set<number>;
  currentBall: number | null;
  manualMarks: Set<number>;
  autoDaub: boolean;
  t: Translations;
  onToggleMark: (num: number) => void;
  onRelease: (entryId: string) => void;
  onClaimBingo: (entryId: string) => void;
  compact?: boolean;
}

export const CartelaCard: React.FC<CartelaCardProps> = ({
  entry,
  phase,
  calledSet,
  currentBall,
  manualMarks,
  autoDaub,
  t,
  onToggleMark,
  onRelease,
  onClaimBingo,
  compact = false,
}) => {
  const winCheck = React.useMemo(
    () => checkWinningPattern(entry.grid, calledSet),
    [entry.grid, calledSet]
  );

  const winningCoordSet = React.useMemo(() => {
    const s = new Set<string>();
    for (const [r, c] of winCheck.winningCells) {
      s.add(`${r},${c}`);
    }
    return s;
  }, [winCheck.winningCells]);

  const markedCount = React.useMemo(() => {
    let count = 1;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) continue;
        const val = entry.grid[r][c];
        const isDaubed = autoDaub ? calledSet.has(val) : manualMarks.has(val);
        if (isDaubed) count++;
      }
    }
    return count;
  }, [entry.grid, autoDaub, calledSet, manualMarks]);

  const columnColors = [
    'bg-pink-600 text-white',
    'bg-amber-400 text-purple-950',
    'bg-fuchsia-600 text-white',
    'bg-purple-600 text-white',
    'bg-yellow-400 text-purple-950',
  ];

  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#15072E]/95 text-purple-950 dark:text-purple-50 shadow-lg shadow-pink-500/10 dark:shadow-purple-900/30 border border-pink-200 dark:border-purple-500/35 overflow-hidden">
      {/* Card Header */}
      <div
        className={`flex items-center justify-between gap-2 bg-[#FFF5FA] dark:bg-[#1F0B3F] border-b border-pink-200 dark:border-purple-500/30 ${
          compact ? 'px-2.5 py-2 sm:px-3.5 sm:py-2.5' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-display font-bold tracking-tight truncate ${
              compact ? 'text-xs sm:text-sm' : 'text-sm'
            }`}
          >
            {entry.isCustom ? t.customCartela : `${t.cartelaNum} #${entry.cartelaNumber}`}
          </span>
          <span aria-hidden="true" className="text-pink-400 dark:text-purple-400">·</span>
          <span className="font-mono text-[11px] font-semibold text-pink-600 dark:text-amber-300 tabular-nums whitespace-nowrap">
            {markedCount}/25
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {phase === 'OPENING' && (
            <button
              type="button"
              onClick={() => onRelease(entry.entryId)}
              className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-lg text-[11px] font-semibold text-rose-700 dark:text-rose-200 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3" />
              {t.swap}
            </button>
          )}
          {phase === 'CALLING' && winCheck.won && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-amber-300 whitespace-nowrap">
              {t.ready}
            </span>
          )}
        </div>
      </div>

      {/* B-I-N-G-O Column Letters */}
      <div className={`grid grid-cols-5 ${compact ? 'gap-1 px-2 pt-2 sm:gap-1.5 sm:px-3 sm:pt-3' : 'gap-1.5 px-4 pt-3.5'}`}>
        {BINGO_LETTERS.map((letter, idx) => (
          <div
            key={letter}
            className={`rounded-md flex items-center justify-center font-display font-extrabold tracking-wider ${columnColors[idx]} ${
              compact ? 'h-5 sm:h-7 text-[11px] sm:text-sm' : 'h-8 text-base'
            }`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* 5x5 Number Grid */}
      <div className={`grid grid-cols-5 ${compact ? 'gap-1 p-2 sm:gap-1.5 sm:p-3' : 'gap-1.5 p-4'}`}>
        {entry.grid.map((row, r) =>
          row.map((num, c) => {
            const isFree = r === 2 && c === 2;
            const isCalled = isFree || calledSet.has(num);
            const isDaubed = isFree || (autoDaub ? isCalled : manualMarks.has(num));
            const isCurrentBall = !isFree && currentBall === num;
            const isWinningCell = winningCoordSet.has(`${r},${c}`);

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                disabled={isFree || autoDaub || phase !== 'CALLING'}
                onClick={() => {
                  if (!isFree && !autoDaub && phase === 'CALLING') {
                    onToggleMark(num);
                  }
                }}
                aria-label={isFree ? t.free : `Number ${num}`}
                className={`relative aspect-square rounded-lg flex items-center justify-center font-mono font-bold transition-transform duration-150 select-none tabular-nums ${
                  compact
                    ? 'min-h-[30px] text-xs sm:text-base'
                    : 'min-h-[44px] text-lg sm:text-xl'
                } ${
                  isWinningCell
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-300 text-purple-950 ring-2 ring-amber-500 shadow-sm'
                    : isFree
                      ? 'bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-700 text-white'
                      : isDaubed
                        ? 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-950 dark:text-white border border-pink-200 dark:border-purple-500/35'
                        : isCurrentBall
                          ? 'bg-amber-100 dark:bg-amber-500/25 text-purple-950 dark:text-amber-200 ring-2 ring-amber-400'
                          : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-950 dark:text-purple-100 border border-pink-200 dark:border-purple-500/35 hover:border-pink-400'
                } ${!isFree && !autoDaub && phase === 'CALLING' ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
              >
                {isFree ? (
                  <div className="flex flex-col items-center justify-center leading-none">
                    <Star className={`${compact ? 'w-3 h-3 sm:w-4 sm:h-4' : 'w-5 h-5'} fill-amber-300 text-amber-300`} />
                    <span className={`${compact ? 'text-[7px] sm:text-[9px]' : 'text-[9px]'} font-sans font-bold tracking-wider mt-0.5`}>
                      {t.free}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className={`relative z-10 ${isDaubed && !isWinningCell ? 'text-white' : ''}`}>
                      {num}
                    </span>

                    {isDaubed && !isWinningCell && (
                      <span
                        aria-hidden="true"
                        className={`absolute rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 shadow-inner transition-transform duration-150 ${
                          compact ? 'inset-0.5 sm:inset-1.5' : 'inset-1.5'
                        }`}
                      />
                    )}

                    {isWinningCell && (
                      <span
                        aria-hidden="true"
                        className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                      >
                        <Check className="w-2 h-2 stroke-[3]" />
                      </span>
                    )}

                    {!autoDaub && !isDaubed && isCalled && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400"
                      />
                    )}
                  </>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Claim Action Footer during CALLING */}
      {phase === 'CALLING' && (
        <div className={compact ? 'px-2 pb-2 sm:px-3 sm:pb-3' : 'px-4 pb-4'}>
          <button
            type="button"
            onClick={() => onClaimBingo(entry.entryId)}
            className={`w-full rounded-xl font-display font-bold tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
              compact ? 'min-h-[38px] sm:min-h-[44px] text-xs sm:text-sm' : 'min-h-[48px] text-base'
            } ${
              winCheck.won
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 hover:brightness-105 text-purple-950 shadow-lg shadow-amber-500/25'
                : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] hover:bg-pink-100 dark:hover:bg-[#2B1156] text-purple-950 dark:text-purple-100 border border-pink-200 dark:border-purple-500/35'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {winCheck.won ? `${t.claimBingo} (${winCheck.patternName})` : t.checkAndClaim}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
