import React, { useMemo, useState } from 'react';
import { Shuffle, SlidersHorizontal, Lock, Check, X, Eye, Search } from 'lucide-react';
import {
  BINGO_LETTERS,
  CartelaEntry,
  GamePhase,
  MAX_CARTELAS_LIMIT,
  MIN_CARTELAS,
  TOTAL_CARTELAS,
  generateCartelaGrid,
  getColumnRange,
} from '../../shared/bingo';
import { Translations } from '../utils/i18n';

interface CartelaPickerProps {
  phase: GamePhase;
  secondsRemaining: number;
  entries: CartelaEntry[];
  playerId: string;
  stakeBirr: number;
  totalBalance: number;
  isAdmin: boolean;
  maxCartelas?: number;
  t: Translations;
  onSelectCartela: (cartelaNumber: number) => void;
  onSelectCustomCartela: (grid: number[][]) => void;
  onReleaseCartela: (entryId: string) => void;
}

export const CartelaPicker: React.FC<CartelaPickerProps> = ({
  phase,
  secondsRemaining,
  entries,
  playerId,
  stakeBirr,
  totalBalance,
  isAdmin,
  maxCartelas = TOTAL_CARTELAS,
  t,
  onSelectCartela,
  onSelectCustomCartela,
  onReleaseCartela,
}) => {
  const effectiveMax = Math.max(
    MIN_CARTELAS,
    Math.min(MAX_CARTELAS_LIMIT, Math.round(maxCartelas || TOTAL_CARTELAS))
  );

  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewNumber, setPreviewNumber] = useState<number | null>(null);
  const [pageIdx, setPageIdx] = useState<number>(0);
  const [jumpQuery, setJumpQuery] = useState('');
  const [customCols, setCustomCols] = useState<number[][]>(() => {
    const g = generateCartelaGrid(Math.floor(Math.random() * effectiveMax) + 1);
    return [0, 1, 2, 3, 4].map((c) => {
      const colVals = [0, 1, 2, 3, 4].map((r) => g[r][c]);
      return c === 2 ? colVals.filter((v) => v !== 0) : colVals;
    });
  });

  const entryByCartela = useMemo(() => {
    const map = new Map<number, CartelaEntry>();
    for (const e of entries) {
      if (!e.isCustom) map.set(e.cartelaNumber, e);
    }
    return map;
  }, [entries]);

  const myEntries = useMemo(
    () => entries.filter((e) => e.playerId === playerId),
    [entries, playerId]
  );

  const ranges = useMemo(() => {
    const list: Array<{ start: number; end: number; label: string }> = [];
    for (let s = 1; s <= effectiveMax; s += 100) {
      const e = Math.min(effectiveMax, s + 99);
      list.push({ start: s, end: e, label: `${s}–${e}` });
    }
    return list;
  }, [effectiveMax]);

  const safePageIdx = pageIdx < ranges.length ? pageIdx : 0;
  const activeRange = ranges[safePageIdx] || { start: 1, end: effectiveMax, label: `1–${effectiveMax}` };

  const visibleNumbers = useMemo(() => {
    const q = jumpQuery.trim();
    if (q) {
      const list: number[] = [];
      for (let i = 1; i <= effectiveMax; i++) {
        if (String(i).includes(q)) list.push(i);
      }
      return list;
    }
    const list: number[] = [];
    for (let i = activeRange.start; i <= activeRange.end; i++) {
      list.push(i);
    }
    return list;
  }, [jumpQuery, effectiveMax, activeRange]);

  const isLocked = phase !== 'OPENING';
  const canAffordMore = isAdmin || totalBalance >= stakeBirr;

  const previewGrid = useMemo(
    () => (previewNumber ? generateCartelaGrid(previewNumber) : null),
    [previewNumber]
  );

  const handleQuickPick = () => {
    if (isLocked || !canAffordMore) return;
    const available: number[] = [];
    for (let i = 1; i <= effectiveMax; i++) {
      if (!entryByCartela.has(i)) available.push(i);
    }
    if (available.length === 0) return;
    const choice = available[Math.floor(Math.random() * available.length)];
    onSelectCartela(choice);
  };

  const toggleCustomNumber = (colIdx: number, num: number) => {
    const maxForCol = colIdx === 2 ? 4 : 5;
    setCustomCols((prev) => {
      const copy = prev.map((arr) => [...arr]);
      const current = copy[colIdx];
      if (current.includes(num)) {
        copy[colIdx] = current.filter((v) => v !== num);
      } else if (current.length < maxForCol) {
        copy[colIdx] = [...current, num];
      } else {
        copy[colIdx] = [...current.slice(1), num];
      }
      return copy;
    });
  };

  const randomizeCustom = () => {
    const seed = Math.floor(Math.random() * 90000) + effectiveMax + 1;
    const g = generateCartelaGrid(seed);
    setCustomCols(
      [0, 1, 2, 3, 4].map((c) => {
        const colVals = [0, 1, 2, 3, 4].map((r) => g[r][c]);
        return c === 2 ? colVals.filter((v) => v !== 0) : colVals;
      })
    );
  };

  const isCustomReady = customCols.every((col, idx) => col.length === (idx === 2 ? 4 : 5));

  const submitCustom = () => {
    if (!isCustomReady || isLocked || !canAffordMore) return;
    const grid: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
    for (let c = 0; c < 5; c++) {
      if (c === 2) {
        grid[0][2] = customCols[2][0];
        grid[1][2] = customCols[2][1];
        grid[2][2] = 0;
        grid[3][2] = customCols[2][2];
        grid[4][2] = customCols[2][3];
      } else {
        for (let r = 0; r < 5; r++) {
          grid[r][c] = customCols[c][r];
        }
      }
    }
    onSelectCustomCartela(grid);
    setShowCustomBuilder(false);
  };

  return (
    <div className="rounded-2xl bg-white/95 dark:bg-[#15072E]/95 border border-pink-200 dark:border-purple-500/35 p-3.5 sm:p-5 shadow-md shadow-pink-500/10 dark:shadow-purple-900/30">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-purple-950 dark:text-white">
            {isLocked ? t.selectionLockedTitle : `${t.selectCartelaPrefix} (1–${effectiveMax})`}
          </h2>
          <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
            {isLocked
              ? t.selectionLockedHint
              : canAffordMore
                ? `${secondsRemaining}s · ${t.pickAsManyAsBalance}`
                : t.insufficientBalance}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={isLocked || !canAffordMore}
            onClick={handleQuickPick}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shadow-sm"
          >
            <Shuffle className="w-3.5 h-3.5" />
            {t.quickPick}
          </button>

          <button
            type="button"
            onClick={() => {
              setPreviewMode((v) => !v);
              setPreviewNumber(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
              previewMode
                ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white border-pink-400'
                : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-900 dark:text-purple-100 border-pink-200 dark:border-purple-500/35 hover:border-pink-400 dark:hover:border-fuchsia-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {t.previewMode}
          </button>

          <button
            type="button"
            disabled={isLocked || (!canAffordMore && !showCustomBuilder)}
            onClick={() => setShowCustomBuilder((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-900 dark:text-purple-100 border border-pink-200 dark:border-purple-500/35 hover:border-pink-400 dark:hover:border-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showCustomBuilder ? t.closeBuilder : t.customNumbers}
          </button>
        </div>
      </div>

      {/* Fixed Deterministic Cartela Preview Box */}
      {previewMode && previewNumber && previewGrid && (
        <div className="mb-3.5 p-3 rounded-xl bg-[#FFF5FA] dark:bg-[#0B031C] border border-pink-300 dark:border-purple-500/45 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-display text-sm font-bold text-purple-950 dark:text-white">
              {t.previewCard} #{previewNumber}
            </div>
            <div className="flex items-center gap-2">
              {!isLocked && !entryByCartela.has(previewNumber) && canAffordMore && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectCartela(previewNumber);
                    setPreviewNumber(null);
                    setPreviewMode(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 hover:brightness-105 cursor-pointer"
                >
                  {t.lockThisCard} #{previewNumber}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewNumber(null)}
                aria-label="Close preview"
                className="p-1.5 rounded-lg text-purple-500 hover:text-purple-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-w-[240px] mx-auto">
            <div className="grid grid-cols-5 gap-1 mb-1">
              {BINGO_LETTERS.map((l) => (
                <div
                  key={l}
                  className="h-6 rounded bg-gradient-to-b from-pink-500 via-fuchsia-600 to-purple-700 text-white font-display text-xs font-extrabold flex items-center justify-center"
                >
                  {l}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {previewGrid.map((row, r) =>
                row.map((val, c) => (
                  <div
                    key={`${r}-${c}`}
                    className={`h-8 rounded flex items-center justify-center font-mono text-xs font-bold tabular-nums ${
                      val === 0
                        ? 'bg-gradient-to-br from-amber-400 to-yellow-300 text-purple-950 text-[9px] font-extrabold'
                        : 'bg-white dark:bg-[#1F0B3F] text-purple-950 dark:text-white border border-pink-200 dark:border-purple-500/35'
                    }`}
                  >
                    {val === 0 ? t.free : val}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Number Builder Drawer */}
      {showCustomBuilder && !isLocked && (
        <div className="mb-3.5 p-3 sm:p-4 rounded-xl bg-[#FFF5FA] dark:bg-[#0B031C] border border-pink-200 dark:border-purple-500/35">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-purple-950 dark:text-white">
                {t.pickOwnNumbers}
              </h3>
              <p className="text-xs text-purple-700 dark:text-purple-300">{t.pickOwnHint}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={randomizeCustom}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-100 dark:bg-[#1F0B3F] text-purple-900 dark:text-purple-100 hover:opacity-90 cursor-pointer whitespace-nowrap"
              >
                {t.shuffle}
              </button>
              <button
                type="button"
                disabled={!isCustomReady || !canAffordMore}
                onClick={submitCustom}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 hover:brightness-105 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                {t.lockCustomCard}
              </button>
              <button
                type="button"
                onClick={() => setShowCustomBuilder(false)}
                aria-label="Close custom builder"
                className="p-1.5 rounded-lg text-purple-500 hover:text-purple-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {BINGO_LETTERS.map((letter, colIdx) => {
              const [min] = getColumnRange(colIdx);
              const req = colIdx === 2 ? 4 : 5;
              const selected = customCols[colIdx];
              const nums = Array.from({ length: 15 }, (_, i) => min + i);
              return (
                <div key={letter} className="flex flex-col gap-1">
                  <div className="text-center py-1 text-[11px] font-bold text-pink-600 dark:text-amber-300 border-b border-pink-200 dark:border-purple-500/30 tabular-nums">
                    {letter} ({selected.length}/{req})
                  </div>
                  <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
                    {nums.map((n) => {
                      const active = selected.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => toggleCustomNumber(colIdx, n)}
                          className={`h-7 sm:h-8 rounded font-mono text-[11px] sm:text-xs font-bold tabular-nums cursor-pointer transition-colors ${
                            active
                              ? 'bg-gradient-to-br from-amber-400 to-yellow-300 text-purple-950'
                              : 'bg-white dark:bg-[#1F0B3F] text-purple-900 dark:text-purple-200 border border-pink-200 dark:border-purple-500/35 hover:border-pink-400'
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Range Selector Tabs + Jump Search (fast navigation for 1–600 cartelas) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {ranges.map((r, idx) => {
            const active = !jumpQuery.trim() && safePageIdx === idx;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setJumpQuery('');
                  setPageIdx(idx);
                }}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold cursor-pointer border transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white border-pink-400 shadow-xs'
                    : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-800 dark:text-purple-200 border-pink-200 dark:border-purple-500/35 hover:border-pink-400'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-28 sm:w-32">
          <Search className="w-3.5 h-3.5 text-pink-400 dark:text-purple-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="number"
            min={1}
            max={effectiveMax}
            value={jumpQuery}
            onChange={(e) => setJumpQuery(e.target.value)}
            placeholder={t.findCartelaPlaceholder}
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-[#FFF5FA] dark:bg-[#0B031C] border border-pink-200 dark:border-purple-500/35 font-mono text-xs text-purple-950 dark:text-white focus:outline-none focus:border-pink-500 dark:focus:border-fuchsia-400"
          />
        </div>
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-purple-700 dark:text-purple-300 mb-2.5 tabular-nums">
        <span>
          {t.available}: {effectiveMax - entryByCartela.size}
        </span>
        <span aria-hidden="true">·</span>
        <span className="text-pink-600 dark:text-amber-300 font-bold">
          {t.yours}: {myEntries.length}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t.claimed}: {entries.length}
        </span>
      </div>

      {/* Dynamic Cartela Grid (1–maxCartelas, paginated by 100 or filtered by jump #) */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 max-h-[340px] overflow-y-auto hall-scroll pr-0.5">
        {visibleNumbers.map((num) => {
          const taken = entryByCartela.get(num);
          const isMine = taken?.playerId === playerId;
          const isTakenByOther = Boolean(taken) && !isMine;
          const disabled = previewMode ? false : isLocked || isTakenByOther || (!isMine && !canAffordMore);

          return (
            <button
              key={num}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (previewMode) {
                  setPreviewNumber(num);
                  return;
                }
                if (isMine && taken) {
                  onReleaseCartela(taken.entryId);
                } else if (!taken && !isLocked && canAffordMore) {
                  onSelectCartela(num);
                }
              }}
              className={`min-h-[42px] sm:min-h-[44px] rounded-xl font-mono text-sm font-bold tabular-nums flex flex-col items-center justify-center transition-all duration-150 ${
                previewMode && previewNumber === num
                  ? 'bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 text-white ring-2 ring-pink-300 cursor-pointer'
                  : isMine
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-300 text-purple-950 ring-2 ring-amber-300 cursor-pointer shadow-sm'
                    : isTakenByOther
                      ? 'bg-pink-50/60 dark:bg-[#0B031C] text-pink-300 dark:text-purple-700 border border-pink-200/60 dark:border-purple-500/20 cursor-not-allowed'
                      : isLocked || !canAffordMore
                        ? 'bg-pink-50/60 dark:bg-[#0E0521] text-purple-400 dark:text-purple-600 border border-pink-200 dark:border-purple-500/20 cursor-not-allowed'
                        : 'bg-[#FFF5FA] dark:bg-[#1F0B3F] text-purple-950 dark:text-purple-50 border border-pink-200 dark:border-purple-500/35 hover:border-pink-400 dark:hover:border-amber-400 active:scale-95 cursor-pointer'
              }`}
            >
              <span>{num}</span>
              {isMine && (
                <span className="text-[9px] font-sans font-extrabold uppercase tracking-tight leading-none">
                  {t.you}
                </span>
              )}
              {isTakenByOther && !isLocked && <Lock className="w-2.5 h-2.5 opacity-50 mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
