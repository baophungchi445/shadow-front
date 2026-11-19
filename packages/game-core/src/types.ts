import type {
  BuildingDef,
  BuildingTypeId,
  Difficulty,
  EntityId,
  FactionId,
  Personality,
  PlayerId,
  ResearchId,
  TeamId,
  UnitDef,
  UnitTypeId,
  WeaponDef,
} from '@shadow-front/shared-types';
import type { PathPoint } from './pathfinding';

export type Order =
  | { type: 'idle' }
  | { type: 'move'; x: number; y: number; attackMove: boolean }
  | { type: 'attack'; target: EntityId }
  | { type: 'hold' }
  | { type: 'retreat'; x: number; y: number };

interface EntityBase {
  id: EntityId;
  owner: PlayerId;
  team: TeamId;
  /** World position (tile units, continuous). Buildings: footprint centre. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Damage multiplier from faction. */
  damageMul: number;
  /** Ticks until the weapon can fire again. */
  cooldown: number;
  targetId: EntityId | null;
  /** Angle (world space) the weapon is pointing. */
  turretFacing: number;
  vision: number;
  /** Tick on which this entity last fired (for muzzle flash rendering). */
  lastFiredTick: number;
}

export interface Unit extends EntityBase {
  kind: 'unit';
  type: UnitTypeId;
  def: UnitDef;
  air: boolean;
  speed: number;
  radius: number;
  prevX: number;
  prevY: number;
  /** Hull facing in world space radians. */
  facing: number;
  order: Order;
  path: PathPoint[];
  pathIndex: number;
  /** Grid version used when the path was computed. */
  pathVersion: number;
  /** Tick at which the path was last computed (to throttle chasing re-paths). */
  pathTick: number;
  /** Destination of the current path (to detect when re-pathing is needed). */
  pathGoal: PathPoint | null;
  /** Anchor point an aggressive idle unit returns to after chasing. */
  anchorX: number;
  anchorY: number;
  moving: boolean;
  stuckTicks: number;
  lastDist: number;
}

export interface Building extends EntityBase {
  kind: 'building';
  type: BuildingTypeId;
  def: BuildingDef;
  /** Footprint top-left tile. */
  tx: number;
  ty: number;
  w: number;
  h: number;
  /** Construction progress 0..1. */
  progress: number;
  complete: boolean;
  queue: UnitTypeId[];
  /** Ticks of work done on the head of the queue. */
  queueProgress: number;
  rallyX: number;
  rallyY: number;
  /** Tile indices of ore fields this extractor drains. */
  oreTiles: number[];
  /** Technology being researched here (Research Center only). */
  research: { id: ResearchId; progress: number } | null;
  /** Auto-repair toggled on by the owner (costs credits per tick). */
  repairing: boolean;
}

export type Entity = Unit | Building;

export interface Projectile {
  id: number;
  owner: PlayerId;
  team: TeamId;
  sourceId: EntityId;
  x: number;
  y: number;
  /** Fixed impact point (artillery) or last known target position (homing). */
  tx: number;
  ty: number;
  targetId: EntityId | null;
  homing: boolean;
  weapon: WeaponDef;
  damageMul: number;
  /** Target is an air unit (projectile is drawn at altitude). */
  air: boolean;
  startX: number;
  startY: number;
}

export interface PlayerStats {
  unitsBuilt: number;
  unitsLost: number;
  buildingsBuilt: number;
  buildingsLost: number;
  kills: number;
  creditsEarned: number;
  creditsSpent: number;
}

export interface Player {
  id: PlayerId;
  name: string;
  team: TeamId;
  faction: FactionId;
  color: number;
  isAI: boolean;
  difficulty?: Difficulty;
  personality?: Personality;
  credits: number;
  powerProduced: number;
  powerUsed: number;
  defeated: boolean;
  spawnIndex: number;
  stats: PlayerStats;
  lastUnderAttackTick: number;
  /** Completed technologies. */
  researched: ResearchId[];
  /** Survival wave attacker: has no base, is driven by the wave system (not an AI Commander). */
  raider: boolean;
}

/** Runtime state of Survival mode. */
export interface SurvivalState {
  difficulty: Difficulty;
  /** Total waves to survive. */
  total: number;
  /** Waves that have entered the map so far. */
  wave: number;
  /** Tick on which the next wave enters (meaningless once all waves are out). */
  nextWaveTick: number;
  /** Entry point chosen for the next wave (announced before it arrives). */
  nextEntry: { x: number; y: number };
  /** Player id of the wave attacker. */
  raider: PlayerId;
  /** Entry points: map spawns not used by defenders. */
  entries: { x: number; y: number }[];
}

/** Capturable strategic point (map data + runtime ownership). */
export interface ControlPoint {
  index: number;
  name: string;
  x: number;
  y: number;
  /** Owning team, or null when neutral. */
  team: TeamId | null;
  /** Player credited with the income (the capturer with most units present). */
  player: PlayerId | null;
  /** Team currently capturing / neutralising. */
  capTeam: TeamId | null;
  /** 0..1 progress of the current capture or neutralisation. */
  progress: number;
  /** Teams with ground units inside the radius (updated every check). */
  contested: boolean;
}
