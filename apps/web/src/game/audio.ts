/**
 * Procedural sound effects synthesised with the Web Audio API (no audio files, no licensing concerns).
 * Placeholder quality until production audio is added to assets/audio.
 */
export type SfxKind =
  | 'bullet'
  | 'shell'
  | 'rocket'
  | 'missile'
  | 'artillery'
  | 'explosion'
  | 'explosionBig'
  | 'built'
  | 'produced'
  | 'alert'
  | 'click'
  | 'error';

/** Minimum milliseconds between two plays of the same kind (avoids noise walls in big fights). */
const THROTTLE: Record<SfxKind, number> = {
  bullet: 45,
  shell: 70,
  rocket: 90,
  missile: 90,
  artillery: 120,
  explosion: 80,
  explosionBig: 200,
  built: 300,
  produced: 250,
  alert: 1500,
  click: 60,
  error: 250,
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume = 0.6;
  private last = new Map<SfxKind, number>();

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume * 0.5;
  }

  /** Must be called from a user gesture at least once (browser autoplay policy). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume * 0.5;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // Audio unavailable — the game stays silent.
      this.ctx = null;
    }
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Plays a sound; `gain` (0..1) is used for distance attenuation. */
  play(kind: SfxKind, gain = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.volume <= 0 || gain <= 0.02 || ctx.state !== 'running') return;
    const now = performance.now();
    if (now - (this.last.get(kind) ?? -1e9) < THROTTLE[kind]) return;
    this.last.set(kind, now);
    const t = ctx.currentTime;
    switch (kind) {
      case 'bullet':
        this.noiseBurst(t, 0.05, 'highpass', 1800, 0.35 * gain);
        break;
      case 'shell':
        this.noiseBurst(t, 0.18, 'lowpass', 900, 0.6 * gain);
        this.tone(t, 'sine', 140, 45, 0.22, 0.7 * gain);
        break;
      case 'rocket':
      case 'missile':
        this.noiseSweep(t, 0.35, 600, 2400, 0.35 * gain);
        break;
      case 'artillery':
        this.noiseBurst(t, 0.3, 'lowpass', 500, 0.8 * gain);
        this.tone(t, 'sine', 90, 30, 0.4, 0.9 * gain);
        break;
      case 'explosion':
        this.noiseBurst(t, 0.6, 'lowpass', 700, 0.8 * gain);
        this.tone(t, 'sine', 80, 30, 0.5, 0.6 * gain);
        break;
      case 'explosionBig':
        this.noiseBurst(t, 1.4, 'lowpass', 450, 1 * gain);
        this.tone(t, 'sine', 60, 22, 1.1, 0.9 * gain);
        break;
      case 'built':
        this.tone(t, 'triangle', 660, 660, 0.12, 0.35);
        this.tone(t + 0.13, 'triangle', 880, 880, 0.18, 0.35);
        break;
      case 'produced':
        this.tone(t, 'triangle', 520, 620, 0.12, 0.3);
        break;
      case 'alert':
        for (let i = 0; i < 2; i++) {
          this.tone(t + i * 0.32, 'square', 440, 440, 0.14, 0.18);
          this.tone(t + i * 0.32 + 0.15, 'square', 330, 330, 0.14, 0.18);
        }
        break;
      case 'click':
        this.tone(t, 'sine', 1200, 900, 0.04, 0.15);
        break;
      case 'error':
        this.tone(t, 'sawtooth', 160, 120, 0.16, 0.18);
        break;
    }
  }

  private env(t: number, dur: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master!);
    return g;
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.env(t, dur, peak));
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private noiseSweep(t: number, dur: number, from: number, to: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    src.connect(f).connect(this.env(t, dur, peak));
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number): void {
    const osc = this.ctx!.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    osc.connect(this.env(t, dur, peak));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
