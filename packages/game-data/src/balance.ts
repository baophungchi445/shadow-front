import type { ArmorClass, WeaponType } from '@shadow-front/shared-types';

/** Simulation ticks per second. All per-tick values in game-data assume this rate. */
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Damage multiplier: weapon type × armor class. Encodes the unit counter system. */
export const DAMAGE_TABLE: Record<WeaponType, Record<ArmorClass, number>> = {
  bullet: { infantry: 1.0, light: 0.4, heavy: 0.15, air: 0.5, building: 0.2 },
  shell: { infantry: 0.5, light: 1.0, heavy: 1.0, air: 0, building: 0.8 },
  rocket: { infantry: 0.3, light: 1.2, heavy: 1.4, air: 0.8, building: 0.9 },
  artillery: { infantry: 1.2, light: 0.9, heavy: 0.7, air: 0, building: 1.2 },
  missile: { infantry: 0.2, light: 0.6, heavy: 0.6, air: 1.8, building: 0.2 },
};

export const BALANCE = {
  /** Production/construction speed multiplier while power is insufficient. */
  lowPowerSpeed: 0.5,
  /** Defense fire-rate multiplier while power is insufficient. */
  lowPowerFireRate: 0.5,
  /** Max tile distance from an existing friendly building to place a new one. */
  buildRadius: 8,
  /** Ore extraction radius (tiles) around a Resource Extractor centre. */
  extractorRadius: 3.5,
  /** Max items per production queue. */
  maxQueue: 5,
  /** Ticks between fog-of-war recomputation. */
  fogInterval: 5,
  /** Distance a unit may chase from its anchor before returning (aggressive stance). */
  chaseLeash: 10,
  defaultStartingCredits: 5000,
  /** Refund ratio when cancelling a building under construction. */
  buildingCancelRefund: 1,
  /** Strategic control points. */
  pointRadius: 3,
  /** Ticks for one ground unit to capture a neutral point (more units capture faster, up to 3×). */
  pointCaptureTicks: 240,
  /** Credits per second per owned point. */
  pointIncome: 6,
  /** Vision radius granted around an owned point. */
  pointVision: 7,
  /** Repair: full 0 → max HP repair takes this many ticks… */
  repairTicks: 500,
  /** …and costs this fraction of the building's price. */
  repairCostRatio: 0.5,
} as const;
