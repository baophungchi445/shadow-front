# SHADOW FRONT — API Specification

## 1. HTTP (NestJS, prefix `/api`)

| Method | Path              | Response                                          | Status      |
| ------ | ----------------- | ------------------------------------------------- | ----------- |
| GET    | `/api/health`     | `{ status: "ok", uptime: number, rooms: number }` | implemented |
| GET    | `/api/rooms`      | `RoomSummary[]` (public rooms)                    | implemented |
| POST   | `/api/auth/guest` | `{ token, playerId }`                             | phase 6     |
| GET    | `/api/me`         | player profile                                    | phase 6     |

## 2. Socket.IO — namespace `/lobby`

Types are defined in `packages/shared-types/src/lobby.ts`.

```ts
interface RoomState {
  id: string;
  name: string;
  hostId: string;
  isPrivate: boolean;
  status: 'lobby' | 'loading' | 'in-match' | 'results';
  settings: { mapId: MapId; mission: MissionType; startingCredits: number; maxPlayers: number };
  players: { id: string; name: string; faction: FactionId; ready: boolean; team: number }[];
  bots: { id: string; faction: FactionId; difficulty: Difficulty; personality: Personality; team: number }[];
}
```

Events: see `MULTIPLAYER_DESIGN.md` §4. Every client→server event uses an acknowledgement callback `(res: { ok: true, room?: RoomState } | { ok: false, error: string })`.

Error codes: `ROOM_NOT_FOUND`, `ROOM_FULL`, `BAD_PASSWORD`, `NOT_HOST`, `INVALID_PAYLOAD`, `NOT_IN_ROOM`.

## 3. Game commands (shared by offline client, AI and future server)

Defined in `packages/shared-types/src/commands.ts`:

```ts
type Command =
  | { type: 'move'; player: PlayerId; units: EntityId[]; x: number; y: number; attackMove?: boolean }
  | { type: 'attack'; player: PlayerId; units: EntityId[]; target: EntityId }
  | { type: 'stop' | 'hold'; player: PlayerId; units: EntityId[] }
  | { type: 'retreat'; player: PlayerId; units: EntityId[] }
  | { type: 'build'; player: PlayerId; building: BuildingTypeId; tx: number; ty: number }
  | { type: 'produce'; player: PlayerId; producer: EntityId; unit: UnitTypeId }
  | { type: 'cancel'; player: PlayerId; producer: EntityId }
  | { type: 'rally'; player: PlayerId; producer: EntityId; x: number; y: number };
```

`world.issue(cmd)` returns `{ ok: true } | { ok: false, reason: string }`.

## 4. Snapshot format (phase 7)

```ts
interface Snapshot {
  tick: number;
  full: boolean;
  entities: EntitySnapshot[];
  removed: EntityId[];
  events: GameEvent[];
  players: PlayerEconomy[];
}
```
