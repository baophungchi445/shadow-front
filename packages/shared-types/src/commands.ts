import type { AiTactic, BuildingTypeId, EntityId, PlayerId, ResearchId, TeamId, UnitTypeId } from './ids';
import type { TileKind, WeaponType } from './definitions';

/** Group move formation. `spread` = loose blob (default); the others keep shape and move at the slowest unit's speed. */
export type Formation = 'spread' | 'line' | 'column' | 'wedge';

export type Command =
  | {
      type: 'move';
      player: PlayerId;
      units: EntityId[];
      x: number;
      y: number;
      attackMove?: boolean;
      formation?: Formation;
    }
  | { type: 'attack'; player: PlayerId; units: EntityId[]; target: EntityId }
  | { type: 'stop'; player: PlayerId; units: EntityId[] }
  | { type: 'hold'; player: PlayerId; units: EntityId[] }
  | { type: 'retreat'; player: PlayerId; units: EntityId[] }
  /** `facing` (v0.12): side of the front (exit / rally side): 0 = +y, 1 = +x, 2 = −y, 3 = −x; default 0. */
  | { type: 'build'; player: PlayerId; building: BuildingTypeId; tx: number; ty: number; facing?: number }
  | { type: 'produce'; player: PlayerId; producer: EntityId; unit: UnitTypeId }
  | { type: 'cancel'; player: PlayerId; producer: EntityId }
  | { type: 'cancelBuild'; player: PlayerId; building: EntityId }
  | { type: 'rally'; player: PlayerId; producer: EntityId; x: number; y: number }
  | { type: 'research'; player: PlayerId; building: EntityId; research: ResearchId }
  | { type: 'cancelResearch'; player: PlayerId; building: EntityId }
  | { type: 'repair'; player: PlayerId; building: EntityId; on: boolean }
  /** Attack-move back and forth between each unit's current position and (x, y). */
  | { type: 'patrol'; player: PlayerId; units: EntityId[]; x: number; y: number }
  /** Infantry board a friendly transport or garrison a bunker. */
  | { type: 'load'; player: PlayerId; units: EntityId[]; carrier: EntityId }
  /** Everyone inside the carrier gets out next to it. */
  | { type: 'unload'; player: PlayerId; carrier: EntityId }
  /** Send credits to a teammate. */
  | { type: 'transfer'; player: PlayerId; to: PlayerId; amount: number }
  /** Start the level-2 upgrade of a building. */
  | { type: 'upgrade'; player: PlayerId; building: EntityId }
  /** Upgrade every unit of `unit` (produced by this building): +HP, +damage. */
  | { type: 'upgradeUnit'; player: PlayerId; building: EntityId; unit: UnitTypeId }
  | { type: 'cancelUnitUpgrade'; player: PlayerId; building: EntityId }
  /** Sell a completed building (not the HQ) for part of its price. */
  | { type: 'sell'; player: PlayerId; building: EntityId }
  /** Turn a deployable vehicle (Mobile Command Vehicle) into its building where it stands. */
  | { type: 'deploy'; player: PlayerId; unit: EntityId }
  /** The nearest ready grenadier among `units` throws a smoke grenade at (x, y). */
  | { type: 'smoke'; player: PlayerId; units: EntityId[]; x: number; y: number };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type GameEvent =
  | { type: 'shot'; from: EntityId; x: number; y: number; tx: number; ty: number; weapon: WeaponType }
  | { type: 'hit'; x: number; y: number; weapon: WeaponType; splash: number }
  | { type: 'destroyed'; id: EntityId; x: number; y: number; kind: 'unit' | 'building'; big: boolean }
  | { type: 'built'; id: EntityId; player: PlayerId }
  | { type: 'produced'; id: EntityId; player: PlayerId }
  | { type: 'underAttack'; player: PlayerId; x: number; y: number; building: boolean }
  | { type: 'playerDefeated'; player: PlayerId }
  | { type: 'gameOver'; winningTeam: number }
  | { type: 'pointCaptured'; point: number; team: TeamId; previousTeam: TeamId | null }
  | { type: 'pointNeutralized'; point: number; previousTeam: TeamId }
  | { type: 'researchComplete'; player: PlayerId; research: ResearchId }
  /** A unit gained a veterancy rank (1 Veteran, 2 Elite, 3 Heroic). */
  | { type: 'promoted'; id: EntityId; player: PlayerId; rank: number }
  | { type: 'sold'; id: EntityId; player: PlayerId; refund: number; x: number; y: number }
  | { type: 'boarded'; id: EntityId; carrier: EntityId; player: PlayerId }
  | { type: 'upgraded'; id: EntityId; player: PlayerId }
  /** A unit-type upgrade finished. */
  | { type: 'unitUpgraded'; player: PlayerId; unit: UnitTypeId }
  | { type: 'creditsSent'; from: PlayerId; to: PlayerId; amount: number }
  /** Capture the Flag (`team` = owner of the flag). */
  | { type: 'flagTaken'; team: TeamId; by: TeamId; x: number; y: number }
  | { type: 'flagDropped'; team: TeamId; x: number; y: number }
  | { type: 'flagReturned'; team: TeamId }
  | { type: 'flagCaptured'; team: TeamId; flagTeam: TeamId }
  | { type: 'unloaded'; carrier: EntityId; player: PlayerId; count: number }
  /** A smoke screen appeared. */
  | { type: 'smoke'; x: number; y: number; player: PlayerId }
  /** Destructible terrain (v0.12): a forest / city tile was destroyed and is now `kind`. */
  | { type: 'terrainDestroyed'; tx: number; ty: number; was: TileKind; kind: TileKind }
  /** A critical hit. */
  | { type: 'crit'; x: number; y: number }
  /** A Mobile Command Vehicle became building `building`. */
  | { type: 'deployed'; unit: EntityId; building: EntityId; player: PlayerId; x: number; y: number }
  /** Survival: a wave will arrive at (x, y) in `inTicks` ticks. */
  | { type: 'waveIncoming'; wave: number; x: number; y: number; inTicks: number }
  /** Survival: a wave has entered the map. */
  | { type: 'waveSpawned'; wave: number; x: number; y: number; count: number }
  /** v0.17: an AI commander changed its tactics (learned from the match). */
  | { type: 'aiAdapted'; player: PlayerId; tactic: AiTactic; remembered?: boolean };
