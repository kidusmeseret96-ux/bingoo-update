import type { PlayerIdentity } from '../../shared/bingo';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
}

function getTg(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
  if (!tg || !tg.initDataUnsafe) return null;
  return tg;
}

export function initTelegramMiniApp(): boolean {
  const tg = getTg();
  if (!tg) return false;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#0B0314');
    tg.setBackgroundColor?.('#0B0314');
    return Boolean(tg.initData);
  } catch {
    return false;
  }
}

export function triggerHaptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
  const tg = getTg();
  if (!tg?.HapticFeedback) return;
  try {
    if (kind === 'success' || kind === 'error') {
      tg.HapticFeedback.notificationOccurred(kind);
    } else {
      tg.HapticFeedback.impactOccurred(kind);
    }
  } catch {
    // Ignore unsupported haptic environments
  }
}

const STORAGE_ID_KEY = 'cartela_guest_id';
const STORAGE_NAME_KEY = 'cartela_guest_name';

export function getSavedGuestName(): string {
  try {
    return localStorage.getItem(STORAGE_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGuestName(name: string) {
  try {
    localStorage.setItem(STORAGE_NAME_KEY, name.trim().slice(0, 24));
  } catch {
    // Ignore storage errors
  }
}

export async function resolvePlayerIdentity(): Promise<PlayerIdentity> {
  const tg = getTg();

  if (tg?.initData) {
    try {
      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      if (res.ok) {
        const data = (await res.json()) as { verified: boolean; player?: PlayerIdentity };
        if (data.verified && data.player) {
          return data.player;
        }
      }
    } catch {
      // Fallback to initDataUnsafe below
    }
  }

  const u = tg?.initDataUnsafe?.user;
  if (u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || `User ${u.id}`;
    return {
      id: `tg_${u.id}`,
      name: name.slice(0, 32),
      username: u.username,
      isTelegram: true,
    };
  }

  let guestId = '';
  try {
    guestId = localStorage.getItem(STORAGE_ID_KEY) || '';
    if (!guestId) {
      guestId = `guest_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_ID_KEY, guestId);
    }
  } catch {
    guestId = `guest_${Math.random().toString(36).slice(2, 10)}`;
  }

  const savedName = getSavedGuestName();
  const suffix = guestId.slice(-4).toUpperCase();
  return {
    id: guestId,
    name: savedName || `Player ${suffix}`,
    isTelegram: false,
  };
}
