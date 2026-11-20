import React, { useEffect, useState } from 'react';
import { CalendarClock, Crown, Flame, Pencil, Plus, Save, Sparkles, Target, Trash2 } from 'lucide-react';
import type {
  DailyMissionRecord,
  MissionType,
  RankThresholds,
  SpecialEventRecord,
} from '../types';

interface Props {
  events: SpecialEventRecord[];
  missions: DailyMissionRecord[];
  missionCompletionBonus: number;
  rankThresholds: RankThresholds;
  busy: boolean;
  onUpsertEvent: (payload: {
    id: string | null;
    name: string;
    description_text: string;
    theme_key: string;
    entry_birr: number;
    bonus_prize_birr: number;
    min_players: number;
    ends_at: string | null;
    is_active: boolean;
  }) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onUpsertMission: (payload: {
    id: string | null;
    title: string;
    mission_type: MissionType;
    target_count: number;
    pattern_filter: string;
    reward_birr: number;
    is_active: boolean;
    sort_order: number;
  }) => Promise<void>;
  onDeleteMission: (id: string) => Promise<void>;
  onSaveRankAndMissionSettings: (thresholds: RankThresholds, completionBonus: number) => Promise<void>;
}

const EVENT_THEMES: Array<{ key: string; label: string; swatch: string }> = [
  { key: 'christmas', label: 'Christmas Snow', swatch: 'bg-red-600' },
  { key: 'enkutatash', label: 'Enkutatash Flowers', swatch: 'bg-yellow-500' },
  { key: 'football', label: 'Football Stadium', swatch: 'bg-emerald-600' },
  { key: 'golden', label: 'Golden Jackpot', swatch: 'bg-amber-500' },
  { key: 'cyber', label: 'Neon Cyber', swatch: 'bg-cyan-500' },
  { key: 'emerald', label: 'Royal Emerald', swatch: 'bg-teal-600' },
  { key: 'sunset', label: 'Sunset Inferno', swatch: 'bg-orange-500' },
  { key: 'amethyst', label: 'Amethyst Magic', swatch: 'bg-purple-600' },
  { key: 'diamond_ice', label: 'Diamond Ice', swatch: 'bg-sky-500' },
  { key: 'rose_gold', label: 'Rose Gold Luxe', swatch: 'bg-pink-500' },
];

const MISSION_TYPES: Array<{ value: MissionType; label: string }> = [
  { value: 'play_rounds', label: 'Play N Rounds Today' },
  { value: 'win_rounds', label: 'Win N Rounds Today' },
  { value: 'win_pattern', label: 'Win with Specific Pattern' },
  { value: 'invite_friends', label: 'Invite N Friends' },
  { value: 'deposit_birr', label: 'Deposit N+ Birr' },
];

const PATTERN_PRESETS = [
  'Four Corners',
  'Any Line',
  'Horizontal Line',
  'Vertical Line',
  'Main Diagonal',
  'Cross',
  'X-Pattern',
  'Full House',
];

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const EventsMissionsTiersPanel: React.FC<Props> = ({
  events,
  missions,
  missionCompletionBonus,
  rankThresholds,
  busy,
  onUpsertEvent,
  onDeleteEvent,
  onUpsertMission,
  onDeleteMission,
  onSaveRankAndMissionSettings,
}) => {
  // Special Event Form State
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [evName, setEvName] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evTheme, setEvTheme] = useState('golden');
  const [evEntry, setEvEntry] = useState('25');
  const [evBonus, setEvBonus] = useState('200');
  const [evMinPlayers, setEvMinPlayers] = useState('0');
  const [evEndsAt, setEvEndsAt] = useState('');
  const [evActive, setEvActive] = useState(true);

  // Mission Form State
  const [editMissionId, setEditMissionId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mType, setMType] = useState<MissionType>('play_rounds');
  const [mTarget, setMTarget] = useState('5');
  const [mPattern, setMPattern] = useState('Four Corners');
  const [mReward, setMReward] = useState('15');
  const [mSortOrder, setMSortOrder] = useState('1');
  const [mActive, setMActive] = useState(true);

  // Rank Thresholds + All-Completed Bonus State
  const [completionBonus, setCompletionBonus] = useState(String(missionCompletionBonus));
  const [bronzeMin, setBronzeMin] = useState(String(rankThresholds.bronze ?? 0));
  const [silverMin, setSilverMin] = useState(String(rankThresholds.silver ?? 200));
  const [goldMin, setGoldMin] = useState(String(rankThresholds.gold ?? 1000));
  const [diamondMin, setDiamondMin] = useState(String(rankThresholds.diamond ?? 3000));
  const [platinumMin, setPlatinumMin] = useState(String(rankThresholds.platinum ?? 10000));

  useEffect(() => {
    setCompletionBonus(String(missionCompletionBonus ?? 50));
    setBronzeMin(String(rankThresholds?.bronze ?? 0));
    setSilverMin(String(rankThresholds?.silver ?? 200));
    setGoldMin(String(rankThresholds?.gold ?? 1000));
    setDiamondMin(String(rankThresholds?.diamond ?? 3000));
    setPlatinumMin(String(rankThresholds?.platinum ?? 10000));
  }, [missionCompletionBonus, rankThresholds]);

  const resetEventForm = () => {
    setEditEventId(null);
    setEvName('');
    setEvDesc('');
    setEvTheme('golden');
    setEvEntry('25');
    setEvBonus('200');
    setEvMinPlayers('0');
    setEvEndsAt('');
    setEvActive(true);
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evName.trim()) return;
    await onUpsertEvent({
      id: editEventId,
      name: evName.trim(),
      description_text: evDesc.trim(),
      theme_key: evTheme,
      entry_birr: Math.max(1, Number(evEntry) || 20),
      bonus_prize_birr: Math.max(0, Number(evBonus) || 0),
      min_players: Math.max(0, Math.floor(Number(evMinPlayers) || 0)),
      ends_at: evEndsAt ? new Date(evEndsAt).toISOString() : null,
      is_active: evActive,
    });
    resetEventForm();
  };

  const resetMissionForm = () => {
    setEditMissionId(null);
    setMTitle('');
    setMType('play_rounds');
    setMTarget('5');
    setMPattern('Four Corners');
    setMReward('15');
    setMSortOrder(String(missions.length + 1));
    setMActive(true);
  };

  const handleMissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle.trim()) return;
    await onUpsertMission({
      id: editMissionId,
      title: mTitle.trim(),
      mission_type: mType,
      target_count: Math.max(1, Math.floor(Number(mTarget) || 1)),
      pattern_filter: mType === 'win_pattern' ? mPattern.trim() : '',
      reward_birr: Math.max(0, Number(mReward) || 0),
      is_active: mActive,
      sort_order: Math.max(0, Math.floor(Number(mSortOrder) || 0)),
    });
    resetMissionForm();
  };

  const handleSaveTiersAndBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveRankAndMissionSettings(
      {
        bronze: Math.max(0, Number(bronzeMin) || 0),
        silver: Math.max(0, Number(silverMin) || 200),
        gold: Math.max(0, Number(goldMin) || 1000),
        diamond: Math.max(0, Number(diamondMin) || 3000),
        platinum: Math.max(0, Number(platinumMin) || 10000),
      },
      Math.max(0, Number(completionBonus) || 0)
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. SPECIAL EVENT ROOMS (10 THEMES) */}
      <section className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/25">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Special Event Rooms (10 Themes)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Special events appear alongside the Choose Stake cards in the game lobby with custom themes, countdown timers, minimum player requirements, and bonus prize pools.
            </p>
          </div>
        </div>

        <form onSubmit={handleEventSubmit} className="bg-blue-50/50 dark:bg-[#081022] border border-blue-200/70 dark:border-blue-500/20 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Event Name</label>
              <input
                type="text"
                required
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                placeholder="e.g. Friday Golden Megapot"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Entry Fee (Birr)</label>
              <input
                type="number"
                min={1}
                step="any"
                required
                value={evEntry}
                onChange={(e) => setEvEntry(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Added Bonus Prize (Birr)</label>
              <input
                type="number"
                min={0}
                step="any"
                required
                value={evBonus}
                onChange={(e) => setEvBonus(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Special Event Text / Subtitle</label>
              <input
                type="text"
                value={evDesc}
                onChange={(e) => setEvDesc(e.target.value)}
                placeholder="e.g. Winner takes full pot + 500 Birr Bonus!"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Min Players (0 = none)</label>
              <input
                type="number"
                min={0}
                value={evMinPlayers}
                onChange={(e) => setEvMinPlayers(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Countdown Ends At (optional)</label>
              <input
                type="datetime-local"
                value={evEndsAt}
                onChange={(e) => setEvEndsAt(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Choose Event Card Theme (10 Themes)</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {EVENT_THEMES.map((t) => {
                const selected = evTheme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setEvTheme(t.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                      selected
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-sm shadow-blue-500/25'
                        : 'bg-white dark:bg-[#0D162E] text-slate-700 dark:text-slate-200 border-blue-200 dark:border-blue-500/25 hover:border-blue-400 dark:hover:border-cyan-400/50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 ${t.swatch}`} />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={evActive}
                onChange={(e) => setEvActive(e.target.checked)}
                className="accent-blue-600"
              />
              Visible &amp; Joinable in Lobby
            </label>
            <div className="flex items-center gap-2">
              {editEventId && (
                <button
                  type="button"
                  onClick={resetEventForm}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-[#0D162E] hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-xl cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !evName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {editEventId ? 'Update Special Event' : 'Create Special Event'}
              </button>
            </div>
          </div>
        </form>

        {/* Events List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Theme</th>
                <th className="py-2.5 px-4 text-right">Entry</th>
                <th className="py-2.5 px-4 text-right">Bonus Prize</th>
                <th className="py-2.5 px-4 text-right">Min Players</th>
                <th className="py-2.5 px-4">Ends At</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No special events created yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const themeObj = EVENT_THEMES.find((t) => t.key === ev.theme_key);
                  return (
                    <tr key={ev.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{ev.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{ev.description_text || '—'}</div>
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                          <span className={`w-2.5 h-2.5 rounded-full ${themeObj?.swatch || 'bg-amber-500'}`} />
                          {themeObj?.label || ev.theme_key}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-900 dark:text-white">{ev.entry_birr} Birr</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        +{ev.bonus_prize_birr} Birr
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {ev.min_players > 0 ? ev.min_players : 'Any'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {ev.ends_at ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {new Date(ev.ends_at).toLocaleString()}
                          </span>
                        ) : (
                          'Manual removal'
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-semibold">
                        {ev.is_active ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Live</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">Hidden</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditEventId(ev.id);
                            setEvName(ev.name);
                            setEvDesc(ev.description_text);
                            setEvTheme(ev.theme_key);
                            setEvEntry(String(ev.entry_birr));
                            setEvBonus(String(ev.bonus_prize_birr));
                            setEvMinPlayers(String(ev.min_players));
                            setEvEndsAt(toDatetimeLocalValue(ev.ends_at));
                            setEvActive(ev.is_active);
                          }}
                          className="p-1.5 text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-lg cursor-pointer inline-flex"
                          title="Edit event"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onUpsertEvent({
                              id: ev.id,
                              name: ev.name,
                              description_text: ev.description_text,
                              theme_key: ev.theme_key,
                              entry_birr: ev.entry_birr,
                              bonus_prize_birr: ev.bonus_prize_birr,
                              min_players: ev.min_players,
                              ends_at: ev.ends_at,
                              is_active: !ev.is_active,
                            })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-lg cursor-pointer"
                        >
                          {ev.is_active ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDeleteEvent(ev.id)}
                          className="p-1.5 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg cursor-pointer inline-flex"
                          title="Delete event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. DAILY QUEST & MISSION BUILDER */}
      <section className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-fuchsia-500/25">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Daily Quest &amp; Mission Builder (No-Code)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              Create and toggle daily missions players can track &amp; claim inside the Mini App Quests tab. Players also win a Grand Bonus if they finish all active missions in one day.
            </p>
          </div>
        </div>

        <form onSubmit={handleMissionSubmit} className="bg-blue-50/50 dark:bg-[#081022] border border-blue-200/70 dark:border-blue-500/20 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Mission Title</label>
              <input
                type="text"
                required
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                placeholder="e.g. Play 5 rounds today"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Condition Rule</label>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as MissionType)}
                className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {MISSION_TYPES.map((mt) => (
                  <option key={mt.value} value={mt.value}>
                    {mt.label}
                  </option>
                ))}
              </select>
            </div>

            {mType === 'win_pattern' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Pattern Name</label>
                <select
                  value={mPattern}
                  onChange={(e) => setMPattern(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {PATTERN_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Target ({mType === 'deposit_birr' ? 'Birr' : 'Count'})
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={mTarget}
                  onChange={(e) => setMTarget(e.target.value)}
                  className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Reward (Birr)</label>
              <input
                type="number"
                min={0}
                step="any"
                required
                value={mReward}
                onChange={(e) => setMReward(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Sort Order</label>
              <input
                type="number"
                min={0}
                value={mSortOrder}
                onChange={(e) => setMSortOrder(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums bg-white dark:bg-[#0D162E] border border-blue-200 dark:border-blue-500/25 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={mActive}
                onChange={(e) => setMActive(e.target.checked)}
                className="accent-blue-600"
              />
              Mission Enabled
            </label>
            <div className="flex items-center gap-2">
              {editMissionId && (
                <button
                  type="button"
                  onClick={resetMissionForm}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-[#0D162E] hover:bg-blue-50 dark:hover:bg-blue-500/15 rounded-xl cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !mTitle.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {editMissionId ? 'Update Mission' : 'Add Daily Mission'}
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-[#081022] text-xs font-semibold text-slate-600 dark:text-sky-200/80">
                <th className="py-2.5 px-4">Order</th>
                <th className="py-2.5 px-4">Mission Title</th>
                <th className="py-2.5 px-4">Rule &amp; Target</th>
                <th className="py-2.5 px-4 text-right">Reward</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/70 dark:divide-blue-500/15 text-sm">
              {missions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No daily missions configured yet.
                  </td>
                </tr>
              ) : (
                missions.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors">
                    <td className="py-2.5 px-4 tabular-nums text-slate-500 dark:text-slate-400">#{m.sort_order}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">{m.title}</td>
                    <td className="py-2.5 px-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {m.mission_type} ({m.target_count}
                      {m.pattern_filter ? ` · ${m.pattern_filter}` : ''})
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      +{m.reward_birr} Birr
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      {m.is_active ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Paused</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditMissionId(m.id);
                          setMTitle(m.title);
                          setMType(m.mission_type);
                          setMTarget(String(m.target_count));
                          setMPattern(m.pattern_filter || 'Four Corners');
                          setMReward(String(m.reward_birr));
                          setMSortOrder(String(m.sort_order));
                          setMActive(m.is_active);
                        }}
                        className="p-1.5 text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-lg cursor-pointer inline-flex"
                        title="Edit mission"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onUpsertMission({
                            id: m.id,
                            title: m.title,
                            mission_type: m.mission_type,
                            target_count: m.target_count,
                            pattern_filter: m.pattern_filter,
                            reward_birr: m.reward_birr,
                            is_active: !m.is_active,
                            sort_order: m.sort_order,
                          })
                        }
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200 dark:border-blue-500/30 rounded-lg cursor-pointer"
                      >
                        {m.is_active ? 'Pause' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDeleteMission(m.id)}
                        className="p-1.5 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg cursor-pointer inline-flex"
                        title="Delete mission"
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
      </section>

      {/* 3. GRAND MISSION COMPLETION BONUS & VIP RANK DEPOSIT THRESHOLDS */}
      <form
        onSubmit={handleSaveTiersAndBonus}
        className="bg-white/95 dark:bg-[#0D162E]/90 backdrop-blur-md border border-blue-200/80 dark:border-blue-500/25 rounded-2xl p-6 shadow-sm space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-blue-100 dark:border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/25">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                All-Missions Grand Bonus &amp; VIP Rank Deposit Thresholds
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Configure the bonus payout when all daily missions are finished, plus total deposited Birr required for each progressive player rank badge.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            Save Ranks &amp; Grand Bonus
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="p-3.5 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-950/35 border border-fuchsia-200 dark:border-fuchsia-500/35">
            <label className="flex items-center gap-1 text-xs font-bold text-fuchsia-900 dark:text-fuchsia-200 mb-1.5">
              <Flame className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
              All Missions Bonus
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={completionBonus}
              onChange={(e) => setCompletionBonus(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-fuchsia-200 dark:border-fuchsia-500/35 rounded-lg focus:outline-none focus:border-fuchsia-500"
            />
            <p className="text-[11px] text-fuchsia-700 dark:text-fuchsia-300 mt-1">Extra Birr prize</p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/35">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1.5">🥉 Bronze Min (Birr)</label>
            <input
              type="number"
              min={0}
              value={bronzeMin}
              onChange={(e) => setBronzeMin(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-amber-200 dark:border-amber-500/35 rounded-lg focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-500/40">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">🥈 Silver Min (Birr)</label>
            <input
              type="number"
              min={0}
              value={silverMin}
              onChange={(e) => setSilverMin(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-slate-300 dark:border-slate-500/40 rounded-lg focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-500/35">
            <label className="block text-xs font-bold text-yellow-900 dark:text-yellow-200 mb-1.5">🥇 Gold Min (Birr)</label>
            <input
              type="number"
              min={0}
              value={goldMin}
              onChange={(e) => setGoldMin(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-yellow-300 dark:border-yellow-500/35 rounded-lg focus:outline-none focus:border-yellow-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-300 dark:border-cyan-500/35">
            <label className="block text-xs font-bold text-cyan-900 dark:text-cyan-200 mb-1.5">💎 Diamond Min (Birr)</label>
            <input
              type="number"
              min={0}
              value={diamondMin}
              onChange={(e) => setDiamondMin(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-cyan-300 dark:border-cyan-500/35 rounded-lg focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/35 border border-purple-300 dark:border-purple-500/35">
            <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1.5">👑 Platinum Min (Birr)</label>
            <input
              type="number"
              min={0}
              value={platinumMin}
              onChange={(e) => setPlatinumMin(e.target.value)}
              className="w-full px-3 py-1.5 text-sm tabular-nums bg-white dark:bg-[#070E20] text-slate-900 dark:text-white border border-purple-300 dark:border-purple-500/35 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </form>
    </div>
  );
};
