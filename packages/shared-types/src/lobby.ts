import type { Difficulty, FactionId, MapId, MissionType, Personality } from './ids';
import type { MapDef } from './definitions';

export type RoomStatus = 'lobby' | 'loading' | 'in-match' | 'results';

export interface RoomSettings {
  mapId: MapId;
  mission: MissionType;
  startingCredits: number;
  maxPlayers: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  faction: FactionId;
  ready: boolean;
  team: number;
}

export interface LobbyBot {
  id: string;
  faction: FactionId;
  difficulty: Difficulty;
  personality: Personality;
  team: number;
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  status: RoomStatus;
  settings: RoomSettings;
  players: LobbyPlayer[];
  bots: LobbyBot[];
}

export interface RoomSummary {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  mapId: MapId;
  status: RoomStatus;
}

export type LobbyAck =
  { ok: true; room?: RoomState; rooms?: RoomSummary[] } | { ok: false; error: LobbyErrorCode };

export type LobbyErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'BAD_PASSWORD'
  | 'NOT_HOST'
  | 'INVALID_PAYLOAD'
  | 'NOT_IN_ROOM'
  | 'NOT_ALL_READY';

/** Match setup used by both offline skirmish and (later) the server. */
export interface MatchSlot {
  kind: 'human' | 'ai';
  name: string;
  faction: FactionId;
  team: number;
  difficulty?: Difficulty;
  personality?: Personality;
  /** Army colour (0xRRGGBB); defaults to the faction colour. Ignored if already taken. */
  color?: number;
}

export interface SurvivalSettings {
  /** Scales the size of every wave. */
  difficulty: Difficulty;
  /** Number of waves to survive. */
  waves: number;
}

/** Match weather (v0.11). */
export type Weather = 'clear' | 'rain' | 'sandstorm' | 'snow';
/** Time of day: always day, always night, or a day / night cycle. */
export type DayTime = 'day' | 'night' | 'cycle';

export interface MatchConfig {
  mapId: MapId;
  mission: MissionType;
  startingCredits: number;
  seed: number;
  slots: MatchSlot[];
  /** Required when mission === 'survival'. All slots must be on team 0. */
  survival?: SurvivalSettings;
  /** Population cap per player (sum of unit supply, queued units included). 0 or missing = unlimited. */
  unitCap?: number;
  /** Seed for `mapId: 'random'` (defaults to `seed`). */
  mapSeed?: number;
  /** Campaign mission id when this match is a campaign mission (offline). */
  campaignMission?: string;
  /** Required when `mapId: 'custom'`: a player-made map (validated by the World). */
  customMap?: MapDef;
  /** Weather (missing = clear). */
  weather?: Weather;
  /** Time of day (missing = day). */
  dayTime?: DayTime;
}
