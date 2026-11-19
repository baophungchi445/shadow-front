import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  Difficulty,
  FactionId,
  LobbyBot,
  LobbyErrorCode,
  MapId,
  MissionType,
  Personality,
  RoomSettings,
  RoomState,
  RoomSummary,
} from '@shadow-front/shared-types';

const FACTIONS: FactionId[] = ['western', 'eastern', 'pacific', 'desert', 'iron'];
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
const PERSONALITIES: Personality[] = ['rush', 'fortress', 'eagle', 'shadow', 'warlord'];
const MAPS: MapId[] = ['desert-storm', 'urban-conflict'];
const MISSIONS: MissionType[] = ['annihilation', 'decapitation'];
/** Map spawn count bounds the total of humans + bots. */
const MAX_SLOTS = 4;

export class LobbyError extends Error {
  constructor(readonly code: LobbyErrorCode) {
    super(code);
  }
}

interface RoomRecord {
  state: RoomState;
  password: string | null;
}

const isStr = (v: unknown, max = 32): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/**
 * In-memory room registry (Phase 0/6 foundation). Persistence (PostgreSQL) and horizontal
 * scaling (Redis adapter) are planned for Phase 6.
 */
@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  private readonly rooms = new Map<string, RoomRecord>();
  /** playerId → roomId */
  private readonly membership = new Map<string, string>();

  count(): number {
    return this.rooms.size;
  }

  list(): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => !r.state.isPrivate)
      .map(({ state }) => ({
        id: state.id,
        name: state.name,
        players: state.players.length,
        maxPlayers: state.settings.maxPlayers,
        mapId: state.settings.mapId,
        status: state.status,
      }));
  }

  get(roomId: string): RoomState {
    const r = this.rooms.get(roomId);
    if (!r) throw new LobbyError('ROOM_NOT_FOUND');
    return r.state;
  }

  roomOf(playerId: string): RoomState | null {
    const id = this.membership.get(playerId);
    return id ? (this.rooms.get(id)?.state ?? null) : null;
  }

  create(
    playerId: string,
    input: { name?: unknown; playerName?: unknown; isPrivate?: unknown; password?: unknown },
  ): RoomState {
    if (!isStr(input.name, 40) || !isStr(input.playerName, 20)) throw new LobbyError('INVALID_PAYLOAD');
    this.leave(playerId);
    const isPrivate = input.isPrivate === true;
    const state: RoomState = {
      id: randomUUID().slice(0, 8),
      name: input.name.trim(),
      hostId: playerId,
      isPrivate,
      status: 'lobby',
      settings: {
        mapId: 'desert-storm',
        mission: 'annihilation',
        startingCredits: 5000,
        maxPlayers: MAX_SLOTS,
      },
      players: [{ id: playerId, name: input.playerName.trim(), faction: 'western', ready: false, team: 0 }],
      bots: [],
    };
    this.rooms.set(state.id, {
      state,
      password: isPrivate && isStr(input.password, 64) ? input.password : null,
    });
    this.membership.set(playerId, state.id);
    this.logger.log(`room ${state.id} created by ${playerId}`);
    return state;
  }

  join(playerId: string, input: { roomId?: unknown; playerName?: unknown; password?: unknown }): RoomState {
    if (!isStr(input.roomId, 64) || !isStr(input.playerName, 20)) throw new LobbyError('INVALID_PAYLOAD');
    const rec = this.rooms.get(input.roomId);
    if (!rec) throw new LobbyError('ROOM_NOT_FOUND');
    if (rec.password !== null && rec.password !== input.password) throw new LobbyError('BAD_PASSWORD');
    const s = rec.state;
    if (s.players.some((p) => p.id === playerId)) return s;
    if (s.players.length + s.bots.length >= s.settings.maxPlayers || s.status !== 'lobby')
      throw new LobbyError('ROOM_FULL');
    this.leave(playerId);
    s.players.push({
      id: playerId,
      name: input.playerName.trim(),
      faction: 'western',
      ready: false,
      team: 0,
    });
    this.membership.set(playerId, s.id);
    return s;
  }

  /** Removes the player; migrates host or deletes the room when empty. Returns the updated room, if any. */
  leave(playerId: string): RoomState | null {
    const roomId = this.membership.get(playerId);
    if (!roomId) return null;
    this.membership.delete(playerId);
    const rec = this.rooms.get(roomId);
    if (!rec) return null;
    const s = rec.state;
    s.players = s.players.filter((p) => p.id !== playerId);
    if (s.players.length === 0) {
      this.rooms.delete(roomId);
      this.logger.log(`room ${roomId} closed`);
      return null;
    }
    if (s.hostId === playerId) s.hostId = s.players[0].id;
    return s;
  }

  private mine(playerId: string): RoomState {
    const s = this.roomOf(playerId);
    if (!s) throw new LobbyError('NOT_IN_ROOM');
    return s;
  }

  private hosted(playerId: string): RoomState {
    const s = this.mine(playerId);
    if (s.hostId !== playerId) throw new LobbyError('NOT_HOST');
    return s;
  }

  setReady(playerId: string, ready: unknown): RoomState {
    const s = this.mine(playerId);
    const p = s.players.find((x) => x.id === playerId)!;
    p.ready = ready === true;
    return s;
  }

  setFaction(playerId: string, faction: unknown): RoomState {
    if (!FACTIONS.includes(faction as FactionId)) throw new LobbyError('INVALID_PAYLOAD');
    const s = this.mine(playerId);
    s.players.find((x) => x.id === playerId)!.faction = faction as FactionId;
    return s;
  }

  updateSettings(playerId: string, patch: Partial<Record<keyof RoomSettings, unknown>>): RoomState {
    const s = this.hosted(playerId);
    if (patch.mapId !== undefined) {
      if (!MAPS.includes(patch.mapId as MapId)) throw new LobbyError('INVALID_PAYLOAD');
      s.settings.mapId = patch.mapId as MapId;
    }
    if (patch.mission !== undefined) {
      if (!MISSIONS.includes(patch.mission as MissionType)) throw new LobbyError('INVALID_PAYLOAD');
      s.settings.mission = patch.mission as MissionType;
    }
    if (patch.startingCredits !== undefined) {
      const c = Number(patch.startingCredits);
      if (!Number.isInteger(c) || c < 1000 || c > 50000) throw new LobbyError('INVALID_PAYLOAD');
      s.settings.startingCredits = c;
    }
    return s;
  }

  addBot(
    playerId: string,
    input: { faction?: unknown; difficulty?: unknown; personality?: unknown; team?: unknown },
  ): RoomState {
    const s = this.hosted(playerId);
    if (s.players.length + s.bots.length >= s.settings.maxPlayers) throw new LobbyError('ROOM_FULL');
    const bot: LobbyBot = {
      id: `bot-${randomUUID().slice(0, 6)}`,
      faction: FACTIONS.includes(input.faction as FactionId) ? (input.faction as FactionId) : 'eastern',
      difficulty: DIFFICULTIES.includes(input.difficulty as Difficulty)
        ? (input.difficulty as Difficulty)
        : 'normal',
      personality: PERSONALITIES.includes(input.personality as Personality)
        ? (input.personality as Personality)
        : 'warlord',
      team: input.team === 0 ? 0 : 1,
    };
    s.bots.push(bot);
    return s;
  }

  removeBot(playerId: string, botId: unknown): RoomState {
    const s = this.hosted(playerId);
    s.bots = s.bots.filter((b) => b.id !== botId);
    return s;
  }

  /** Host starts the match once every human is ready and an enemy team exists. */
  start(playerId: string): RoomState {
    const s = this.hosted(playerId);
    if (!s.players.every((p) => p.ready || p.id === s.hostId)) throw new LobbyError('NOT_ALL_READY');
    const teams = new Set([...s.players.map((p) => p.team), ...s.bots.map((b) => b.team)]);
    if (teams.size < 2) throw new LobbyError('INVALID_PAYLOAD');
    // Authoritative match simulation is Phase 7; the room only transitions state for now.
    s.status = 'loading';
    return s;
  }
}
