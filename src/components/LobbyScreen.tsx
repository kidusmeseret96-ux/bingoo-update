import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Pause,
  Play,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { RoomSummary, SpecialEvent, SpecialEventThemeId, getBallLetter } from '../../shared/bingo';
import { Translations } from '../utils/i18n';

interface LobbyScreenProps {
  rooms: RoomSummary[];
  specialEvents: SpecialEvent[];
  t: Translations;
  onJoinRoom: (stakeBirr: number) => void;
  onJoinSpecialEvent: (eventId: string) => void;
}

const EVENT_THEME_STYLES: Record<
  SpecialEventThemeId,
  { card: string; badge: string; accent: string; emoji: string }
> = {
  christmas: {
    card: 'bg-gradient-to-br from-rose-900 via-red-800 to-emerald-900 border-emerald-300/60 text-white shadow-lg shadow-rose-900/25',
    badge: 'bg-white/20 text-emerald-100 border-white/30',
    accent: 'text-amber-300',
    emoji: '🎄',
  },
  enkutatash: {
    card: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-lime-600 border-yellow-200 text-purple-950 shadow-lg shadow-amber-500/25',
    badge: 'bg-purple-950/15 text-purple-950 border-purple-950/25',
    accent: 'text-purple-950',
    emoji: '🌼',
  },
  football: {
    card: 'bg-gradient-to-br from-emerald-800 via-green-700 to-lime-800 border-lime-300/60 text-white shadow-lg shadow-emerald-900/25',
    badge: 'bg-white/15 text-lime-100 border-white/25',
    accent: 'text-yellow-300',
    emoji: '⚽',
  },
  golden: {
    card: 'bg-gradient-to-br from-amber-500 via-yellow-400 to-orange-500 border-yellow-200 text-purple-950 shadow-lg shadow-amber-500/30',
    badge: 'bg-purple-950/15 text-purple-950 border-purple-950/25',
    accent: 'text-purple-950',
    emoji: '👑',
  },
  cyber: {
    card: 'bg-gradient-to-br from-fuchsia-900 via-purple-900 to-cyan-900 border-cyan-300/60 text-white shadow-lg shadow-fuchsia-700/30',
    badge: 'bg-cyan-400/20 text-cyan-200 border-cyan-300/40',
    accent: 'text-cyan-300',
    emoji: '⚡',
  },
  emerald: {
    card: 'bg-gradient-to-br from-teal-800 via-emerald-700 to-green-900 border-emerald-300/50 text-white shadow-lg shadow-teal-900/25',
    badge: 'bg-white/15 text-emerald-100 border-white/25',
    accent: 'text-amber-300',
    emoji: '💎',
  },
  sunset: {
    card: 'bg-gradient-to-br from-rose-600 via-pink-600 to-amber-500 border-amber-200/70 text-white shadow-lg shadow-rose-600/25',
    badge: 'bg-white/20 text-white border-white/30',
    accent: 'text-yellow-200',
    emoji: '🌅',
  },
  amethyst: {
    card: 'bg-gradient-to-br from-purple-800 via-fuchsia-700 to-pink-700 border-fuchsia-300/60 text-white shadow-lg shadow-purple-800/30',
    badge: 'bg-amber-300 text-purple-950 border-amber-200',
    accent: 'text-amber-300',
    emoji: '🔮',
  },
  diamond_ice: {
    card: 'bg-gradient-to-br from-sky-700 via-indigo-700 to-cyan-700 border-cyan-200/60 text-white shadow-lg shadow-sky-800/25',
    badge: 'bg-white/20 text-cyan-100 border-white/30',
    accent: 'text-cyan-200',
    emoji: '❄️',
  },
  rose_gold: {
    card: 'bg-gradient-to-br from-pink-500 via-rose-400 to-amber-400 border-rose-200 text-purple-950 shadow-lg shadow-pink-500/25',
    badge: 'bg-purple-950/15 text-purple-950 border-purple-950/20',
    accent: 'text-purple-950',
    emoji: '🌹',
  },
};

function formatEventRemaining(endsAt: string | null, nowMs: number): string | null {
  if (!endsAt) return null;
  const diff = Math.floor((new Date(endsAt).getTime() - nowMs) / 1000);
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

const PatternMiniGrid: React.FC<{ label: string; isCellLit: (r: number, c: number) => boolean }> = ({
  label,
  isCellLit,
}) => (
  <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-fuchsia-50 dark:bg-[#120520] border border-fuchsia-200/80 dark:border-[#3B1764]">
    <div className="grid grid-cols-5 gap-0.5">
      {[0, 1, 2, 3, 4].map((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const lit = isCellLit(r, c);
          return (
            <span
              key={`${r}-${c}`}
              className={`w-2.5 h-2.5 rounded-[2px] ${
                lit
                  ? 'bg-gradient-to-br from-amber-400 to-fuchsia-500'
                  : 'bg-fuchsia-200/70 dark:bg-[#2A104B]'
              }`}
            />
          );
        })
      )}
    </div>
    <span className="text-[10px] font-bold text-purple-900 dark:text-purple-100 text-center leading-tight">
      {label}
    </span>
  </div>
);

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  rooms,
  specialEvents,
  t,
  onJoinRoom,
  onJoinSpecialEvent,
}) => {
  const [showRules, setShowRules] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hasTimedEvents = specialEvents.some((ev) => Boolean(ev.endsAt));
  useEffect(() => {
    if (!hasTimedEvents) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasTimedEvents]);

  const activeEvents = specialEvents.filter((ev) => {
    if (!ev.isActive) return false;
    if (!ev.endsAt) return true;
    return new Date(ev.endsAt).getTime() > nowMs;
  });

  return (
    <div className="max-w-3xl mx-auto py-1.5 sm:py-4 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl sm:text-3xl font-extrabold text-purple-950 dark:text-white tracking-tight">
          {t.lobbyTitle}
        </h1>
      </div>

      {/* Special Events (visible together with stakes if active) */}
      {activeEvents.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-700 dark:text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t.specialEvents}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {activeEvents.map((ev) => {
              const style = EVENT_THEME_STYLES[ev.themeKey] || EVENT_THEME_STYLES.golden;
              const rem = formatEventRemaining(ev.endsAt, nowMs);
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onJoinSpecialEvent(ev.id)}
                  className={`group text-left rounded-2xl border p-3.5 sm:p-4 transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-2.5 ${style.card}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-base sm:text-lg font-extrabold flex items-center gap-1.5 truncate">
                        <span>{style.emoji}</span>
                        <span className="truncate">{ev.name}</span>
                      </div>
                      {ev.descriptionText && (
                        <p className="text-xs opacity-90 line-clamp-2 mt-0.5">{ev.descriptionText}</p>
                      )}
                    </div>
                    <div className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-extrabold border shrink-0 tabular-nums ${style.badge}`}>
                      {ev.entryBirr} {t.birr}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-current/15 text-[11px] font-bold tabular-nums">
                    <div className="flex flex-wrap items-center gap-2">
                      {ev.bonusPrizeBirr > 0 && (
                        <span className={`inline-flex items-center gap-1 ${style.accent}`}>
                          <Trophy className="w-3 h-3" />+{ev.bonusPrizeBirr} {t.bonusPrize}
                        </span>
                      )}
                      {ev.minPlayers > 0 && (
                        <span className="opacity-85">
                          · {t.minPlayersNeeded}: {ev.minPlayers}
                        </span>
                      )}
                      {rem && (
                        <span className="inline-flex items-center gap-1 font-mono opacity-90">
                          · <Clock className="w-3 h-3" /> {rem}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                      {t.enterRoom}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Standard Stake Rooms */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
        {rooms.map((room) => {
          const isOpen = room.phase === 'OPENING';
          return (
            <button
              key={room.stakeBirr}
              type="button"
              onClick={() => onJoinRoom(room.stakeBirr)}
              className="group text-left rounded-2xl bg-white/95 dark:bg-[#15072E]/95 border border-pink-200 dark:border-purple-500/40 hover:border-pink-400 dark:hover:border-fuchsia-400 p-3.5 sm:p-5 transition-all duration-150 active:scale-[0.98] cursor-pointer flex flex-col justify-between gap-3 shadow-md shadow-pink-500/10 dark:shadow-[0_8px_28px_rgba(139,92,246,0.16)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold text-pink-700 dark:text-purple-300">
                    {t.round} #{room.roundNumber}
                  </div>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-purple-950 dark:text-white mt-0.5 tabular-nums">
                    {room.stakeBirr} {t.birr}
                  </div>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold tabular-nums border ${
                    room.isPaused
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                      : isOpen
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 border-amber-300 shadow-xs'
                        : 'bg-pink-50 dark:bg-purple-600/30 text-pink-700 dark:text-purple-100 border-pink-200 dark:border-purple-400/50'
                  }`}
                >
                  {room.isPaused ? (
                    <span className="inline-flex items-center gap-1">
                      <Pause className="w-3 h-3" /> {t.paused}
                    </span>
                  ) : isOpen ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {room.secondsRemaining}s
                    </span>
                  ) : room.phase === 'CALLING' ? (
                    <span className="inline-flex items-center gap-1">
                      <Play className="w-3 h-3" />{' '}
                      {room.currentBall
                        ? `${getBallLetter(room.currentBall)}-${room.currentBall}`
                        : `${room.calledCount}/75`}
                    </span>
                  ) : (
                    <span>
                      {t.nextIn} {room.secondsRemaining}s
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2.5 border-t border-pink-100 dark:border-purple-500/25 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-purple-800 dark:text-purple-200 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-pink-600 dark:text-purple-400" />
                    {room.displayedPlayersCount} {t.players}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-300 font-bold">
                    {t.pool}: {room.prizePool} {t.birr}
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-pink-600 dark:text-fuchsia-300 group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                  {t.enterRoom}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* How to Play Toggle Button (Visible without scrolling right below Choose Stakes, collapsed by default) */}
      <div className="rounded-2xl bg-white/95 dark:bg-[#15072E]/95 border border-pink-200 dark:border-purple-500/35 overflow-hidden shadow-sm shadow-pink-500/10">
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-pink-50/70 dark:hover:bg-[#1F0B3F] transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 font-display text-sm font-bold text-purple-950 dark:text-amber-300">
            <BookOpen className="w-4 h-4 text-pink-600 dark:text-amber-400" />
            {showRules ? t.hideRules : t.howToPlay}
          </span>
          {showRules ? (
            <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-300" />
          ) : (
            <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-300" />
          )}
        </button>

        {showRules && (
          <div className="px-4 pb-4 pt-2 border-t border-pink-100 dark:border-purple-500/25 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {t.howToPlaySteps.map((step) => (
                <div
                  key={step.title}
                  className="p-3 rounded-xl bg-[#FFF5FA] dark:bg-[#1F0B3F] border border-pink-200/80 dark:border-purple-500/30"
                >
                  <div className="font-display text-xs font-bold text-pink-600 dark:text-amber-300">
                    {step.title}
                  </div>
                  <p className="text-xs text-purple-900 dark:text-purple-200 mt-1 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                {t.howToPlayPatternsTitle}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <PatternMiniGrid label={t.patternRow} isCellLit={(r) => r === 1} />
                <PatternMiniGrid label={t.patternCol} isCellLit={(_, c) => c === 3} />
                <PatternMiniGrid label={t.patternDiag} isCellLit={(r, c) => r === c} />
                <PatternMiniGrid
                  label={t.patternCorners}
                  isCellLit={(r, c) => (r === 0 || r === 4) && (c === 0 || c === 4)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
