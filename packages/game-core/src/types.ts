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
  | {
      type: 'move';
      x: number;
      y: number;
      attackMove: boolean;
      /** Patrol: the other end of the route (the unit turns around on arrival). */
      patrol?: { x: number; y: number };
      /** Formation move: shared speed cap (the slowest unit's speed) so the group keeps its shape. */
      speed?: number;
    }
  | { type: 'attack'; target: EntityId }
  | { type: 'hold' }
  | { type: 'retreat'; x: number; y: number }
  /** Walking to a transport / bunker to get in. */
  | { type: 'board'; carrier: EntityId };

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
  /** Incendiary damage still to be applied (null = not burning). */
  burn: { ticks: number; dps: number; owner: PlayerId } | null;
}

export interface Unit extends EntityBase {
  kind: 'unit';
  type: UnitTypeId;
  def: UnitDef;
  air: boolean;
  /** v0.13: ships move on water tiles only (see `World.navFor`). */
  naval: boolean;
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
  /** Veterancy experience (credits worth of enemies destroyed) and rank 0..3. */
  xp: number;
  rank: number;
  /** Infantry carried inside (transports). Passengers are removed from the world while inside. */
  passengers: Unit[];
  /** Infantry suppression (see BALANCE.suppressionThreshold). */
  suppression: number;
  /** Tick from which the smoke grenade can be thrown again. */
  smokeReadyTick: number;
}

/** Smoke screen on the ground. */
export interface SmokeCloud {
  x: number;
  y: number;
  radius: number;
  /** Tick on which it disappears. */
  until: number;
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
  /** Infantry garrisoned inside (bunkers). */
  passengers: Unit[];
  /** 1, or 2 once upgraded. */
  level: number;
  /** Ticks of upgrade work done, or null when not upgrading. */
  upgrading: number | null;
  /** Front side (v0.12): 0 = +y (screen bottom-left), 1 = +x (bottom-right), 2 = −y, 3 = −x. Units leave here. */
  facing: number;
  /** Unit-type upgrade in progress at this producer. */
  unitUpgrade: { unit: UnitTypeId; progress: number } | null;
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
  /** Critical hit (damage × BALANCE.critMultiplier). */
  crit: boolean;
  startX: number;
  startY: number;
  /** Ballistic shells (v0.11): peak height of the arc in tiles (0 = flat / falling bomb). The horizontal speed is
   *  constant, so height follows a parabola 4·apex·t·(1−t) over the flight. */
  apex: number;
}

export interface PlayerStats {
  unitsBuilt: number;
  unitsLost: number;
  buildingsBuilt: number;
  buildingsLost: number;
  kills: number;
  creditsEarned: number;
  creditsSpent: number;
  /** v0.16: ships (naval units) lost — campaign objectives. */
  shipsLost?: number;
  /** Per unit type: units produced and enemies destroyed by units of that type (unit mastery, v0.11). */
  byUnit: Partial<Record<UnitTypeId, { built: number; kills: number }>>;
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
  /** Unit types upgraded at their producing building (v0.11). */
  unitUpgrades: UnitTypeId[];
  /** Survival wave attacker: has no base, is driven by the wave system (not an AI Commander). */
  raider: boolean;
}

/** Capture the Flag: one flag per team, standing in front of the team's first HQ. */
export interface Flag {
  team: TeamId;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  /** Unit carrying the flag, if any. */
  carrier: EntityId | null;
  atHome: boolean;
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
