import type { ArmorClass, UnitTypeId, WeaponType } from '@shadow-front/shared-types';

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
  /** Capture the Flag: pick-up / capture radius (tiles) and captures needed to win. */
  flagRadius: 1.2,
  ctfCaptures: 3,
  /** Flag carriers move at this fraction of their speed (gives defenders time to intercept). */
  flagCarrierSpeed: 0.6,
  /** Domination: score per owned point per second, and the score that wins. */
  dominationRate: 1,
  dominationTarget: 1500,
  /** Selling returns this fraction of the price, scaled by remaining HP. */
  sellRefund: 0.5,
  /** Veterancy: XP needed for ranks 1..3, as multiples of the unit's own cost. XP = cost of what it destroyed. */
  veterancyThresholds: [1, 2.5, 5],
  /** Per rank: +damage and +max HP. */
  veterancyDamage: 0.1,
  veterancyHp: 0.1,
  /** Heroic (rank 3) units regenerate this fraction of max HP per second. */
  heroicRegen: 0.01,
} as const;

/** Population cost of each unit (population cap). Heavier units take more room. */
export const UNIT_SUPPLY: Record<UnitTypeId, number> = {
  rifleman: 1,
  'at-soldier': 1,
  'recon-drone': 1,
  'recon-vehicle': 2,
  apc: 2,
  'main-battle-tank': 3,
  'mobile-artillery': 3,
  'attack-helicopter': 3,
  'heavy-tank': 4,
  sniper: 1,
  medic: 1,
  engineer: 1,
  ranger: 1,
  'rocket-launcher': 3,
  gunship: 3,
  'light-tank': 2,
  ifv: 3,
  'transport-helicopter': 3,
};

/** Population cap options offered in match setup (0 = unlimited) and the default. */
export const UNIT_CAP_OPTIONS = [100, 150, 200, 0] as const;
export const DEFAULT_UNIT_CAP = 150;
