import {
  AppLanguage,
  getAmharicCallText,
  getAudioFilename,
  getBallLetter,
  getOromoCallText,
} from '../../shared/bingo';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private clipAvailableCache = new Map<string, boolean>();
  private decodedCache = new Map<string, AudioBuffer>();
  private currentSource: AudioBufferSourceNode | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private activePlaybackId = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureContext();
      };
      window.addEventListener('pointerdown', unlock, { passive: true, once: true });
      window.addEventListener('touchstart', unlock, { passive: true, once: true });
      window.addEventListener('keydown', unlock, { passive: true, once: true });

      if ('speechSynthesis' in window) {
        this.refreshVoices();
        window.speechSynthesis.addEventListener?.('voiceschanged', () => {
          this.refreshVoices();
        });
      }
    }
  }

  private refreshVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const list = window.speechSynthesis.getVoices();
    if (list.length > 0) {
      this.cachedVoices = list;
    }
    return this.cachedVoices;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private stopCurrentVoice() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }
  }

  public playBallPop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(320, now);
    clickOsc.frequency.exponentialRampToValueAtTime(620, now + 0.055);
    clickGain.gain.setValueAtTime(0.001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.075, now + 0.012);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.11);
  }

  public playDaub() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.065);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playCountdownTick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playBingoFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
      const t = now + i * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  private async tryPlayClip(path: string, playbackId: number): Promise<boolean> {
    if (this.clipAvailableCache.get(path) === false) return false;

    const ctx = this.ensureContext();
    if (ctx) {
      try {
        let buffer = this.decodedCache.get(path);
        if (!buffer) {
          const res = await fetch(path);
          if (!res.ok) {
            this.clipAvailableCache.set(path, false);
            return false;
          }
          const arr = await res.arrayBuffer();
          buffer = await ctx.decodeAudioData(arr);
          this.decodedCache.set(path, buffer);
          this.clipAvailableCache.set(path, true);
        }

        if (playbackId !== this.activePlaybackId) return true;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        if (ctx.state === 'running') {
          this.stopCurrentVoice();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gain = ctx.createGain();
          gain.gain.value = 1.0;
          source.connect(gain);
          gain.connect(ctx.destination);
          source.onended = () => {
            if (this.currentSource === source) {
              this.currentSource = null;
            }
          };
          this.currentSource = source;
          source.start(0);
          return true;
        }
      } catch {
        // Fall through to HTMLAudioElement fallback
      }
    }

    try {
      if (playbackId !== this.activePlaybackId) return true;
      this.stopCurrentVoice();
      const audio = new Audio(path);
      this.currentAudio = audio;
      await audio.play();
      this.clipAvailableCache.set(path, true);
      return true;
    } catch {
      this.clipAvailableCache.set(path, false);
      return false;
    }
  }

  private pickNaturalVoice(voices: SpeechSynthesisVoice[], prefix: string): SpeechSynthesisVoice | undefined {
    const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (matching.length === 0) return undefined;
    return (
      matching.find((v) => /ameha|daniel|andrew|brian|guy|ryan|google uk english male/i.test(v.name)) ||
      matching.find((v) => /natural|neural|google/i.test(v.name)) ||
      matching[0]
    );
  }

  public async speakBall(num: number, lang: AppLanguage) {
    const playbackId = ++this.activePlaybackId;
    const filename = getAudioFilename(num);
    if (filename) {
      if (await this.tryPlayClip(`/audio/${lang}/${filename}?v=2`, playbackId)) return;
      if (lang === 'am' && (await this.tryPlayClip(`/audio/${filename}?v=2`, playbackId))) return;
    }

    if (playbackId !== this.activePlaybackId) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const voices = this.refreshVoices();
      const letter = getBallLetter(num);
      let text = `${letter}, ${num}`;
      let voice = this.pickNaturalVoice(voices, 'en');
      let langTag = voice?.lang || 'en-US';

      if (lang === 'am') {
        const am = getAmharicCallText(num);
        const amVoice = this.pickNaturalVoice(voices, 'am');
        if (amVoice) {
          text = am.native;
          voice = amVoice;
          langTag = amVoice.lang;
        } else {
          text = am.phonetic;
          langTag = 'am-ET';
        }
      } else if (lang === 'om') {
        const om = getOromoCallText(num);
        const omVoice = this.pickNaturalVoice(voices, 'om');
        if (omVoice) {
          text = om.native;
          voice = omVoice;
          langTag = omVoice.lang;
        } else {
          text = om.phonetic;
          langTag = 'om-ET';
        }
      }

      const utter = new SpeechSynthesisUtterance(text);
      if (voice) utter.voice = voice;
      utter.lang = langTag;
      utter.rate = 0.96;
      utter.pitch = 0.95;
      utter.volume = 0.98;
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis blocked or unsupported
    }
  }

  public async speakWinner(_winnerName: string, _prizeAmount: number, lang: AppLanguage) {
    const playbackId = ++this.activePlaybackId;
    if (await this.tryPlayClip(`/audio/${lang}/bingo.mp3?v=2`, playbackId)) return;
  }
}

export const soundEngine = new SoundEngine();
