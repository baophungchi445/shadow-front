import type { BuildingTypeId, FactionId, MapId, ResearchId, UnitTypeId } from './ids';

export type ArmorClass = 'infantry' | 'light' | 'heavy' | 'air' | 'building';
export type WeaponType = 'bullet' | 'shell' | 'rocket' | 'artillery' | 'missile';
export type UnitCategory = 'infantry' | 'armored' | 'artillery' | 'air';

export interface WeaponDef {
  type: WeaponType;
  damage: number;
  /** Range in tiles. */
  range: number;
  minRange?: number;
  /** Ticks between shots. */
  cooldown: number;
  /** Projectile speed in tiles per tick. */
  projectileSpeed: number;
  /** Splash radius in tiles (0 = single target). */
  splash?: number;
  canTargetGround: boolean;
  canTargetAir: boolean;
}

export interface UnitDef {
  id: UnitTypeId;
  name: string;
  category: UnitCategory;
  armor: ArmorClass;
  cost: number;
  /** Build time in ticks. */
  buildTime: number;
  hp: number;
  /** Tiles per tick. */
  speed: number;
  /** Vision radius in tiles. */
  vision: number;
  /** Collision radius in tiles. */
  radius: number;
  weapon: WeaponDef | null;
  producedBy: BuildingTypeId;
  requires: BuildingTypeId[];
  hotkey: string;
  description: string;
  /** Only this faction can produce the unit (faction-specific roster). */
  faction?: FactionId;
  /** Unit whose model / icon is reused for rendering (placeholder art). */
  look?: UnitTypeId;
  /** Unarmed support: heals / repairs nearby friendlies automatically. */
  support?: SupportDef;
  /** Carries infantry (APC, transport helicopter). */
  transport?: { capacity: number };
}

export interface SupportDef {
  /** What it can heal: infantry (medic) or vehicles + buildings (engineer). */
  heals: 'infantry' | 'mechanical';
  /** HP restored per second to one target. */
  rate: number;
  /** Range in tiles. */
  range: number;
}

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  cost: number;
  buildTime: number;
  hp: number;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Positive = produces power, negative = consumes. */
  power: number;
  vision: number;
  /** Visual height (screen pixels) for the isometric prism placeholder. */
  height: number;
  requires: BuildingTypeId[];
  weapon: WeaponDef | null;
  /** Credits per second while powered (extractor, HQ trickle). */
  income?: number;
  /** Must be placed touching ore tiles. */
  needsOre?: boolean;
  produces?: boolean;
  /** Infantry can garrison inside; the weapon only fires while occupied (damage × occupants). */
  garrison?: { capacity: number };
  /** Optional level-2 upgrade. */
  upgrade?: UpgradeDef;
  hotkey: string;
  description: string;
}

export interface FactionDef {
  id: FactionId;
  name: string;
  style: string;
  color: number;
  /** Multipliers applied on top of base definitions. */
  modifiers: {
    unitHp: number;
    buildingHp: number;
    speed: number;
    vehicleSpeed: number;
    damage: Partial<Record<'infantry' | 'armored' | 'artillery' | 'air' | 'defense', number>>;
    vision: number;
    airCost: number;
  };
}

export interface ResearchDef {
  id: ResearchId;
  name: string;
  cost: number;
  /** Research time in ticks. */
  time: number;
  description: string;
  /** Only this faction can research it. */
  faction?: FactionId;
}

/** Level-2 upgrade of a building. */
export interface UpgradeDef {
  cost: number;
  /** Ticks. */
  time: number;
  /** Max HP multiplier. */
  hp: number;
  /** Weapon damage multiplier. */
  damage?: number;
  /** Power output multiplier (power plants). */
  power?: number;
}

export type TileKind =
  | 'sand'
  | 'grass'
  | 'road'
  | 'rock'
  | 'water'
  | 'urban'
  | 'ore'
  | 'concrete'
  /** v0.7: walkable snow and impassable forest. */
  | 'snow'
  | 'forest';

export interface MapSpawn {
  /** Top-left tile for the Headquarters. */
  tx: number;
  ty: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  description: string;
  width: number;
  height: number;
  /** Row-major tile kinds, length = width * height. */
  tiles: TileKind[];
  /** Credits stored in each ore tile. */
  oreAmount: number;
  spawns: MapSpawn[];
  strategicPoints: { x: number; y: number; name: string }[];
}
