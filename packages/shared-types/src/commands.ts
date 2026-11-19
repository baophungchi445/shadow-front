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
  | { type: 'repair'; player: PlayerId; building: EntityId; on: boolean };

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
  /** Survival: a wave will arrive at (x, y) in `inTicks` ticks. */
  | { type: 'waveIncoming'; wave: number; x: number; y: number; inTicks: number }
  /** Survival: a wave has entered the map. */
  | { type: 'waveSpawned'; wave: number; x: number; y: number; count: number };
