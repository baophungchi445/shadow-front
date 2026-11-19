import type { Difficulty, UnitTypeId } from '@shadow-front/shared-types';
import { TICK_RATE } from './balance';
import { UNITS } from './units';

/** Survival mode timing and wave sizing. */
export const SURVIVAL = {
  /** Default number of waves. */
  defaultWaves: 10,
  waveOptions: [5, 10, 15] as const,
  /** First wave arrives after 3 minutes (time to build a base). */
  firstWaveTick: 3 * 60 * TICK_RATE,
  /** Time between waves. */
  intervalTicks: 90 * TICK_RATE,
  /** Warning shown this long before a wave arrives. */
  warningTicks: 20 * TICK_RATE,
  /** Idle wave units are re-targeted this often. */
  retargetTicks: 5 * TICK_RATE,
  /** Hard cap on units in one wave. */
  maxUnitsPerWave: 36,
  /** Wave size multiplier per difficulty. */
  difficulty: { easy: 0.6, normal: 1, hard: 1.35, insane: 1.75 } satisfies Record<Difficulty, number>,
  /** Name and team of the wave attacker. */
  raiderName: 'Hostile Forces',
  raiderTeam: 9,
  raiderColor: 0xc8462e,
} as const;

/** Credits worth of units in a wave (before the difficulty multiplier). Every 5th wave is a heavy wave. */
export function waveBudget(wave: number): number {
  const base = 450 + 420 * wave + 45 * wave * wave;
  return wave % 5 === 0 ? base * 1.3 : base;
}

/** Unit pool available to the attacker on a given wave (weights). */
export function wavePool(wave: number): Partial<Record<UnitTypeId, number>> {
  const pool: Partial<Record<UnitTypeId, number>> = { rifleman: 3, 'at-soldier': 2, 'recon-vehicle': 1.5 };
  if (wave >= 3) Object.assign(pool, { apc: 1.5, 'main-battle-tank': 2 });
  if (wave >= 5) Object.assign(pool, { 'mobile-artillery': 1, 'attack-helicopter': 1 });
  if (wave >= 7) Object.assign(pool, { 'heavy-tank': 1.5, rifleman: 1.5 });
  return pool;
}

/** Deterministic wave composition for (wave, difficulty) using the given RNG. */
export function waveComposition(wave: number, difficulty: Difficulty, rnd: () => number): UnitTypeId[] {
  let budget = waveBudget(wave) * SURVIVAL.difficulty[difficulty];
  const pool = Object.entries(wavePool(wave)) as [UnitTypeId, number][];
  const total = pool.reduce((s, [, w]) => s + w, 0);
  const out: UnitTypeId[] = [];
  const cheapest = Math.min(...pool.map(([t]) => UNITS[t].cost));
  while (budget >= cheapest && out.length < SURVIVAL.maxUnitsPerWave) {
    let r = rnd() * total;
    let pick = pool[0][0];
    for (const [t, w] of pool) {
      r -= w;
      if (r <= 0) {
        pick = t;
        break;
      }
    }
    if (UNITS[pick].cost > budget) pick = 'rifleman';
    out.push(pick);
    budget -= UNITS[pick].cost;
  }
  return out;
}
