/**
 * Procedural background music (Web Audio, no files): a slow pad progression for menus and a
 * driving pulse for battles. Placeholder until production music is added to assets/audio.
 */
export type Mood = 'menu' | 'battle';

/** A minor progression (root frequencies in Hz): Am – F – C – G. */
const CHORDS: number[][] = [
  [220.0, 261.63, 329.63],
  [174.61, 220.0, 261.63],
  [196.0, 261.63, 329.63],
  [196.0, 246.94, 293.66],
];
const BAR_SEC: Record<Mood, number> = { menu: 4.8, battle: 2.4 };
const LOOKAHEAD = 0.6;

class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private volume = 0.35;
  private mood: Mood | null = null;
  private timer: number | null = null;
  private bar = 0;
  private nextBar = 0;

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.volume * 0.25, this.ctx.currentTime, 0.2);
  }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        if (!window.AudioContext) return;
        this.ctx = new AudioContext();
        this.out = this.ctx.createGain();
        this.out.gain.value = this.volume * 0.25;
        this.out.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.mood && this.timer === null) this.start();
    } catch {
      this.ctx = null; // Audio unavailable — stay silent.
    }
  }

  play(mood: Mood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    if (this.ctx) {
      this.stopTimer();
      this.start();
    }
  }

  get playing(): Mood | null {
    return this.timer !== null ? this.mood : null;
  }

  private start(): void {
    const ctx = this.ctx;
    if (!ctx || !this.mood) return;
    this.nextBar = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 200);
    this.schedule();
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.mood || ctx.state !== 'running') return;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD) {
      const chord = CHORDS[this.bar % CHORDS.length];
      const len = BAR_SEC[this.mood];
      this.pad(chord, this.nextBar, len, this.mood === 'menu' ? 0.18 : 0.1);
      if (this.mood === 'battle') this.pulse(chord[0] / 2, this.nextBar, len);
      this.nextBar += len;
      this.bar++;
    }
  }

  private pad(freqs: number[], t: number, len: number, level: number): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + len * 0.3);
    env.gain.linearRampToValueAtTime(0, t + len * 1.05);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    env.connect(lp).connect(this.out!);
    for (const f of freqs) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(env);
        o.start(t);
        o.stop(t + len * 1.1);
      }
    }
  }

  /** Battle: bass note on every beat and a soft kick (4 beats per bar). */
  private pulse(root: number, t: number, len: number): void {
    const ctx = this.ctx!;
    const beat = len / 4;
    for (let i = 0; i < 4; i++) {
      const bt = t + i * beat;
      const bass = ctx.createOscillator();
      const bg = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.value = i === 3 ? root * 1.5 : root;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      bg.gain.setValueAtTime(0.0001, bt);
      bg.gain.exponentialRampToValueAtTime(0.22, bt + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, bt + beat * 0.9);
      bass.connect(lp).connect(bg).connect(this.out!);
      bass.start(bt);
      bass.stop(bt + beat);

      const kick = ctx.createOscillator();
      const kg = ctx.createGain();
      kick.frequency.setValueAtTime(110, bt);
      kick.frequency.exponentialRampToValueAtTime(40, bt + 0.15);
      kg.gain.setValueAtTime(i % 2 === 0 ? 0.5 : 0.25, bt);
      kg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.2);
      kick.connect(kg).connect(this.out!);
      kick.start(bt);
      kick.stop(bt + 0.22);
    }
  }
}

/** One music player for the whole app. */
export const music = new Music();
