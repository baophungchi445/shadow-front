import type { BuildingTypeId, EntityId, PlayerId, ResearchId, TeamId, UnitTypeId } from './ids';
import type { WeaponType } from './definitions';

export type Command =
  | { type: 'move'; player: PlayerId; units: EntityId[]; x: number; y: number; attackMove?: boolean }
  | { type: 'attack'; player: PlayerId; units: EntityId[]; target: EntityId }
  | { type: 'stop'; player: PlayerId; units: EntityId[] }
  | { type: 'hold'; player: PlayerId; units: EntityId[] }
  | { type: 'retreat'; player: PlayerId; units: EntityId[] }
  | { type: 'build'; player: PlayerId; building: BuildingTypeId; tx: number; ty: number }
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
  /** Sell a completed building (not the HQ) for part of its price. */
  | { type: 'sell'; player: PlayerId; building: EntityId };

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
  | { type: 'creditsSent'; from: PlayerId; to: PlayerId; amount: number }
  /** Capture the Flag (`team` = owner of the flag). */
  | { type: 'flagTaken'; team: TeamId; by: TeamId; x: number; y: number }
  | { type: 'flagDropped'; team: TeamId; x: number; y: number }
  | { type: 'flagReturned'; team: TeamId }
  | { type: 'flagCaptured'; team: TeamId; flagTeam: TeamId }
  | { type: 'unloaded'; carrier: EntityId; player: PlayerId; count: number }
  /** Survival: a wave will arrive at (x, y) in `inTicks` ticks. */
  | { type: 'waveIncoming'; wave: number; x: number; y: number; inTicks: number }
  /** Survival: a wave has entered the map. */
  | { type: 'waveSpawned'; wave: number; x: number; y: number; count: number };
