import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Server, Bot, Clock, ShieldCheck } from 'lucide-react';

interface HostGuideModalProps {
  open: boolean;
  onClose: () => void;
  botConfigured: boolean;
}

export const HostGuideModal: React.FC<HostGuideModalProps> = ({ open, onClose, botConfigured }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  if (!open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.onrender.com';
  const healthUrl = `${origin}/api/health`;
  const webhookUrl = `${origin}/api/telegram/webhook`;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    setWebhookStatus(null);
    try {
      const res = await fetch('/api/telegram/register-webhook', { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; error?: string; webhookUrl?: string };
      if (data.ok) {
        setWebhookStatus(`Webhook connected to ${data.webhookUrl}`);
      } else {
        setWebhookStatus(data.error || 'Could not register webhook.');
      }
    } catch {
      setWebhookStatus('Request failed. Check server logs.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090216]/85 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-guide-title"
    >
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto hall-scroll rounded-t-3xl sm:rounded-2xl bg-[#FFF5FA] dark:bg-[#15072E] border border-pink-200 dark:border-purple-500/35 text-purple-950 dark:text-purple-100 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-white/95 dark:bg-[#15072E]/95 backdrop-blur-md border-b border-pink-200 dark:border-purple-500/30">
          <div>
            <h2 id="host-guide-title" className="font-display text-lg font-bold">
              Free 24/7 Hosting & Telegram Bot Setup
            </h2>
            <p className="text-xs text-purple-600 dark:text-purple-300">
              Zero paid database required · Runs on one free Node.js server
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close setup guide"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-purple-600 dark:text-purple-300 hover:bg-pink-100 dark:hover:bg-[#230B48] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 text-sm leading-relaxed text-purple-900 dark:text-purple-200">
          {/* Step 1: BotFather */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-display font-bold text-base text-pink-600 dark:text-amber-400">
              <Bot className="w-4 h-4" />
              01. Create Your Free Telegram Bot
            </div>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                Message <span className="font-mono font-bold text-purple-950 dark:text-white">@BotFather</span> on Telegram and run{' '}
                <code className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-[#0D0320] font-mono text-xs">/newbot</code> to get your{' '}
                <code className="font-mono text-xs font-bold">TELEGRAM_BOT_TOKEN</code>.
              </li>
              <li>
                Run <code className="px-1.5 py-0.5 rounded bg-pink-100 dark:bg-[#0D0320] font-mono text-xs">/setmenubutton</code> and paste your HTTPS Mini App URL:
              </li>
            </ol>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30 font-mono text-xs">
              <span className="truncate">{origin}</span>
              <button
                type="button"
                onClick={() => copyText('origin', origin)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white hover:brightness-110 shrink-0 cursor-pointer"
              >
                {copiedKey === 'origin' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy URL
              </button>
            </div>
          </section>

          {/* Step 2: Owner Admin Access */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-display font-bold text-base text-pink-600 dark:text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              02. Owner-Only Admin Access (Hidden from Players)
            </div>
            <p className="text-xs leading-relaxed">
              Regular players never see any Admin button. Set <code className="font-mono font-bold">ADMIN_TELEGRAM_IDS</code> to your numeric Telegram user ID so your account unlocks Admin automatically, or append <code className="font-mono font-bold">?admin=1</code> to the URL (or tap the Zemen Bingo title 5 times) and enter <code className="font-mono font-bold">ADMIN_PIN</code>.
            </p>
          </section>

          {/* Step 3: Free Hosting & Custom Audio */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-display font-bold text-base text-pink-600 dark:text-amber-400">
              <Server className="w-4 h-4" />
              03. Deploy Completely Free ($0/month)
            </div>
            <p>
              Push this repo to GitHub and deploy a Web Service on <strong>Render (Free)</strong>,{' '}
              <strong>Koyeb (Free)</strong>, or <strong>Fly.io</strong>:
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30">
                <div className="text-purple-600 dark:text-purple-300 mb-1">Build Command</div>
                <code className="font-mono font-bold">npm install && npm run build</code>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30">
                <div className="text-purple-600 dark:text-purple-300 mb-1">Start Command</div>
                <code className="font-mono font-bold">npm start</code>
              </div>
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-300">
              Optional custom caller voice clips: place <code className="font-mono">b1.mp3..o75.mp3</code> inside{' '}
              <code className="font-mono">public/audio/am/</code>, <code className="font-mono">public/audio/om/</code>, or{' '}
              <code className="font-mono">public/audio/en/</code>.
            </p>
          </section>

          {/* Step 4: 24/7 Keep Alive */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 font-display font-bold text-base text-pink-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
              04. Keep Free Hosting Awake 24/7
            </div>
            <p className="text-xs">
              Point a free{' '}
              <a
                href="https://uptimerobot.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-pink-600 dark:text-amber-400 underline"
              >
                UptimeRobot <ExternalLink className="w-3 h-3" />
              </a>{' '}
              HTTP monitor (every 5 min) to:
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30 font-mono text-xs">
              <span className="truncate">{healthUrl}</span>
              <button
                type="button"
                onClick={() => copyText('health', healthUrl)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 via-fuchsia-600 to-purple-600 text-white hover:brightness-110 shrink-0 cursor-pointer"
              >
                {copiedKey === 'health' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy
              </button>
            </div>
          </section>

          {/* Webhook Registration */}
          <section className="p-3.5 rounded-xl bg-white dark:bg-[#0D0320] border border-pink-200 dark:border-purple-500/30 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-semibold">Telegram Webhook Status: </span>
                <span className={botConfigured ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
                  {botConfigured ? 'Token detected on server' : 'Guest / Preview Mode (no token set)'}
                </span>
              </div>
              <button
                type="button"
                disabled={!botConfigured || registering}
                onClick={handleRegisterWebhook}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-300 text-purple-950 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {registering ? 'Registering...' : 'Register Webhook'}
              </button>
            </div>
            <div className="text-[11px] font-mono text-purple-600 dark:text-purple-300 truncate">
              Endpoint: {webhookUrl}
            </div>
            {webhookStatus && <div className="text-xs text-pink-600 dark:text-amber-300">{webhookStatus}</div>}
          </section>
        </div>
      </div>
    </div>
  );
};
