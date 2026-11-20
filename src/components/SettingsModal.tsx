import React from 'react';
import { X, Globe, Moon, Sun, Volume2, Mic, CheckCircle2, Sparkles } from 'lucide-react';
import { AppLanguage } from '../../shared/bingo';
import { Translations } from '../utils/i18n';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  t: Translations;
  language: AppLanguage;
  onChangeLanguage: (lang: AppLanguage) => void;
  theme: 'dark' | 'light';
  onChangeTheme: (theme: 'dark' | 'light') => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  autoDaub: boolean;
  onToggleAutoDaub: () => void;
  autoClaim: boolean;
  onToggleAutoClaim: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  t,
  language,
  onChangeLanguage,
  theme,
  onChangeTheme,
  soundEnabled,
  onToggleSound,
  voiceEnabled,
  onToggleVoice,
  autoDaub,
  onToggleAutoDaub,
  autoClaim,
  onToggleAutoClaim,
}) => {
  if (!open) return null;

  const langOptions: Array<{ code: AppLanguage; label: string; sub: string }> = [
    { code: 'en', label: 'English', sub: 'English' },
    { code: 'am', label: 'አማርኛ', sub: 'Amharic' },
    { code: 'om', label: 'Afaan Oromoo', sub: 'Oromo' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090216]/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-settings-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto hall-scroll rounded-t-3xl sm:rounded-2xl bg-[#FFF5FA] dark:bg-[#15072E] border border-pink-200 dark:border-purple-500/35 text-purple-950 dark:text-purple-50 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-white/95 dark:bg-[#15072E]/95 backdrop-blur-md border-b border-pink-200 dark:border-purple-500/30">
          <h2 id="player-settings-title" className="font-display text-lg font-bold">
            {t.settingsTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-purple-600 dark:text-purple-300 hover:bg-pink-100 dark:hover:bg-[#230B48] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Language & Voice Selection */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-amber-300">
              <Globe className="w-4 h-4" />
              {t.languageLabel}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {langOptions.map((opt) => {
                const active = language === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => onChangeLanguage(opt.code)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-br from-pink-500 via-fuchsia-600 to-purple-600 text-white border-pink-400 shadow-md shadow-pink-500/25'
                        : 'bg-white dark:bg-[#1F0B3F] text-purple-900 dark:text-purple-100 border-pink-200 dark:border-purple-500/30 hover:border-pink-400'
                    }`}
                  >
                    <div className="font-display font-bold text-sm">{opt.label}</div>
                    <div className={`text-[10px] mt-0.5 ${active ? 'text-pink-100' : 'text-purple-600 dark:text-purple-300'}`}>
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Dark / Light Theme */}
          <section className="space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-amber-300">
              {t.themeLabel}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onChangeTheme('dark')}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition-all ${
                  theme === 'dark'
                    ? 'bg-[#281052] text-amber-300 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-white dark:bg-[#1F0B3F] text-purple-800 dark:text-purple-200 border-pink-200 dark:border-purple-500/30'
                }`}
              >
                <Moon className="w-4 h-4" />
                {t.darkMode}
              </button>
              <button
                type="button"
                onClick={() => onChangeTheme('light')}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition-all ${
                  theme === 'light'
                    ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white border-pink-400 shadow-md shadow-pink-500/20'
                    : 'bg-white dark:bg-[#1F0B3F] text-purple-800 dark:text-purple-200 border-pink-200 dark:border-purple-500/30'
                }`}
              >
                <Sun className="w-4 h-4" />
                {t.lightMode}
              </button>
            </div>
          </section>

          {/* Audio & Gameplay Toggles */}
          <section className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={onToggleVoice}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <Mic className="w-4 h-4 text-pink-600 dark:text-amber-300 shrink-0" />
                  <span className="text-sm font-semibold">{t.voiceCaller}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    voiceEnabled
                      ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white'
                      : 'bg-pink-100 dark:bg-[#0D0320] text-purple-600 dark:text-purple-300'
                  }`}
                >
                  {voiceEnabled ? t.on : t.off}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleSound}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <Volume2 className="w-4 h-4 text-pink-600 dark:text-amber-300 shrink-0" />
                  <span className="text-sm font-semibold">{t.soundEffects}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    soundEnabled
                      ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white'
                      : 'bg-pink-100 dark:bg-[#0D0320] text-purple-600 dark:text-purple-300'
                  }`}
                >
                  {soundEnabled ? t.on : t.off}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoDaub}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="w-4 h-4 text-pink-600 dark:text-amber-300 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{t.autoMark}</div>
                    <div className="text-[11px] text-purple-600 dark:text-purple-300">{t.autoMarkDesc}</div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                    autoDaub
                      ? 'bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white'
                      : 'bg-pink-100 dark:bg-[#0D0320] text-purple-600 dark:text-purple-300'
                  }`}
                >
                  {autoDaub ? t.on : t.off}
                </span>
              </button>

              <button
                type="button"
                onClick={onToggleAutoClaim}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#1F0B3F] border border-pink-200 dark:border-purple-500/30 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{t.autoWin}</div>
                    <div className="text-[11px] text-purple-600 dark:text-purple-300">{t.autoWinDesc}</div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                    autoClaim
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950'
                      : 'bg-pink-100 dark:bg-[#0D0320] text-purple-600 dark:text-purple-300'
                  }`}
                >
                  {autoClaim ? t.on : t.off}
                </span>
              </button>
            </div>
          </section>

          {/* Footer */}
          <div className="pt-2 flex justify-end border-t border-pink-200 dark:border-purple-500/30">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 text-sm font-extrabold hover:brightness-105 cursor-pointer"
            >
              {t.done}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
