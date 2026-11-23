import type { AiTactic, Difficulty, PlayStyle } from '@shadow-front/shared-types';

/**
 * v0.17 — how an AI commander learns during a match.
 *
 * Rule-based, deterministic memory (no machine learning): the commander reports what happened (the outcome of each
 * attack, what it saw of the opponent), this class turns it into lessons and exposes the parameters the commander
 * reads back (attack threshold / cooldown multipliers, places to avoid, the opponent's play styles).
 *
 * Levels by difficulty: Easy never adapts; Normal learns from its attacks; Hard also reads the opponent's play style;
 * Insane reads it sooner (lower thresholds) and learns faster.
 */

/** One stretch of an attack (90 s of fighting, or what was left when the squad ended). */
export interface AttackOutcome {
  tick: number;
  /** Where the squad was sent. */
  x: number;
  y: number;
  /** Credits worth of the squad still standing at the start of the stretch. */
  sent: number;
  /** Credits worth of enemies destroyed by the squad (buildings count half, as for veterancy). */
  dealt: number;
  /** Credits worth of the squad lost (dead units + damage on survivors). */
  lost: number;
}

/** What the commander currently knows about the opponent. */
export interface StyleSignals {
  tick: number;
  /** An assault (≥ 3 enemies) reached our base; `firstAssaultTick` is when that first happened. */
  firstAssaultTick: number | null;
  /** Enemy defensive buildings (turrets, SAM sites, bunkers, missile batteries) the commander knows of. */
  enemyDefenses: number;
  /** Decaying counts of enemy units seen: all of them, aircraft, warships. */
  seenUnits: number;
  seenAir: number;
  seenShips: number;
}

export interface AdaptationEntry {
  tick: number;
  tactic: AiTactic;
}

const LEVEL: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2, insane: 3 };

/** The answer to each play style. */
export const STYLE_TACTIC: Record<PlayStyle, AiTactic> = {
  rush: 'anti-rush',
  turtle: 'siege',
  air: 'anti-air',
  naval: 'anti-naval',
};

export const PLAY_STYLES: readonly PlayStyle[] = ['rush', 'turtle', 'air', 'naval'];

/** v0.17.2: how strongly each play style shows in the player's recent matches (0 … 1). */
export type Habits = Record<PlayStyle, number>;

export const NO_HABITS: Habits = { rush: 0, turtle: 0, air: 0, naval: 0 };

/**
 * Moving average over matches: the latest match weighs 40 %. A style seen in two matches in a row crosses the 0.5
 * "habit" line (0.64); a habit kept for four matches or more (≥ 0.87) survives one match without it.
 */
export function updateHabits(prev: Habits, detected: Iterable<PlayStyle>): Habits {
  const seen = new Set(detected);
  const next = { ...NO_HABITS };
  for (const s of PLAY_STYLES) next[s] = Math.round((prev[s] * 0.6 + (seen.has(s) ? 0.4 : 0)) * 1000) / 1000;
  return next;
}

/** Styles that count as habits (≥ 0.5). */
export function rememberedStyles(h: Habits): PlayStyle[] {
  return PLAY_STYLES.filter((s) => h[s] >= 0.5);
}

/** Accepts stored data of any shape (old or hand-edited storage) and returns valid habits. */
export function sanitizeHabits(raw: unknown): Habits {
  const out = { ...NO_HABITS };
  if (raw && typeof raw === 'object')
    for (const s of PLAY_STYLES) {
      const v = (raw as Record<string, unknown>)[s];
      if (typeof v === 'number' && v >= 0 && v <= 1) out[s] = v;
    }
  return out;
}

/** Ticks (20 per second). */
const MINUTE = 1200;

export class Adaptation {
  readonly level: number;
  /** Multiplies the army value needed before attacking (1 … 2). */
  patience = 1;
  /** Multiplies the cooldown between attacks (0.7 after a successful attack, back to 1 after a failed one). */
  cooldownFactor = 1;
  /** Opponent play styles being answered (recognised this match or remembered; each kept for the match). */
  readonly styles = new Set<PlayStyle>();
  /** Opponent play styles noticed this match, at any difficulty (what the offline memory learns from). */
  readonly detected = new Set<PlayStyle>();
  /** Every tactic change, in order (shown on the results screen). */
  readonly log: AdaptationEntry[] = [];
  private failures: { x: number; y: number; tick: number }[] = [];
  /** Places where attacks failed twice: avoided as targets until `until`. */
  private avoid: { x: number; y: number; until: number }[] = [];
  private lastAnnounced = new Map<AiTactic, number>();

  constructor(difficulty: Difficulty) {
    this.level = LEVEL[difficulty];
  }

  /** Learns from a finished attack. Returns the tactics that changed (to announce). */
  recordAttack(o: AttackOutcome): AiTactic[] {
    if (this.level === 0 || o.sent < 800) return []; // tiny groups (a lost scout) teach nothing
    const out: AiTactic[] = [];
    const ratio = o.dealt / Math.max(1, o.lost);
    if (ratio < 0.5 && o.lost >= o.sent * 0.2) {
      // A bad trade: wait for a bigger army next time, and stop attacking a place that failed twice.
      const step = this.level >= 3 ? 1.4 : 1.3;
      this.patience = Math.min(2, this.patience * step);
      this.cooldownFactor = 1;
      out.push('patience');
      this.failures = this.failures.filter((f) => o.tick - f.tick < 8 * MINUTE);
      const again = this.failures.some((f) => Math.hypot(f.x - o.x, f.y - o.y) < 10);
      this.failures.push({ x: o.x, y: o.y, tick: o.tick });
      if (again) {
        this.avoid.push({ x: o.x, y: o.y, until: o.tick + 5 * MINUTE });
        out.push('switch-target');
      }
    } else if (ratio > 1.5 && o.dealt >= o.sent * 0.25) {
      // A good trade: the opponent is weak right now — press on sooner.
      this.patience = Math.max(1, this.patience / 1.3);
      if (this.cooldownFactor > 0.7) {
        this.cooldownFactor = 0.7;
        out.push('press');
      }
    }
    return this.announce(out, o.tick);
  }

  /** Reads the opponent's play style (Hard and Insane). Returns the tactics that changed. */
  observe(s: StyleSignals): AiTactic[] {
    // Every commander notices the opponent's style (it feeds the offline memory, v0.17.2); only Hard and Insane act.
    const quick = this.level >= 3;
    const out: AiTactic[] = [];
    const found = (style: PlayStyle, cond: boolean) => {
      if (!cond) return;
      this.detected.add(style);
      if (this.level >= 2 && !this.styles.has(style)) {
        this.styles.add(style);
        out.push(STYLE_TACTIC[style]);
      }
    };
    // An assault reaching our base before ~5.5 min is early: a Hard AI launches its first attack at 5 min and needs
    // a minute to arrive.
    found('rush', s.firstAssaultTick !== null && s.firstAssaultTick < (quick ? 6.5 : 5.5) * MINUTE);
    found('turtle', s.enemyDefenses >= (quick ? 3 : 4));
    found('air', s.seenUnits >= 6 && s.seenAir / s.seenUnits >= (quick ? 0.25 : 0.3));
    found('naval', s.seenShips >= (quick ? 2 : 3));
    return this.announce(out, s.tick);
  }

  /**
   * v0.17.2: prepares answers from the start of a match for habits remembered from earlier matches (Hard and
   * Insane only). Returns the tactics prepared (to announce as "remembered").
   */
  prime(remembered: readonly PlayStyle[]): AiTactic[] {
    if (this.level < 2) return [];
    const out: AiTactic[] = [];
    for (const style of remembered)
      if (!this.styles.has(style)) {
        this.styles.add(style);
        out.push(STYLE_TACTIC[style]);
      }
    return this.announce(out, 0);
  }

  /** Extra "distance" for a target near a place where attacks keep failing (0 elsewhere). */
  targetPenalty(x: number, y: number, tick: number): number {
    this.avoid = this.avoid.filter((a) => a.until > tick);
    return this.avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 10) ? 30 : 0;
  }

  has(style: PlayStyle): boolean {
    return this.styles.has(style);
  }

  /** Logs every change; the same tactic is announced at most once every 2 minutes (no message spam). */
  private announce(tactics: AiTactic[], tick: number): AiTactic[] {
    const shown: AiTactic[] = [];
    for (const t of tactics) {
      const last = this.lastAnnounced.get(t);
      if (last !== undefined && tick - last < 2 * MINUTE) continue;
      this.lastAnnounced.set(t, tick);
      this.log.push({ tick, tactic: t });
      shown.push(t);
    }
    return shown;
  }
}
