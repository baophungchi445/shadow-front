# SHADOW FRONT — Technical Architecture

## 1. Goals

- Deterministic, renderer-independent simulation that can run in the browser (offline) and later on the server (authoritative multiplayer).
- Configuration-driven content.
- Clear separation: **data → core simulation → AI → rendering/UI → network**.

## 2. Monorepo

pnpm workspace.

```text
shadow-front/
├── apps/
│   ├── web/            React + Vite + Phaser 3 client (UI + rendering + input)
│   └── server/         NestJS + Socket.IO (lobby now, authoritative simulation later)
├── packages/
│   ├── shared-types/   Pure TypeScript types shared by every workspace
│   ├── game-data/      Factions, units, buildings, weapons, maps (config only)
│   ├── game-core/      Simulation: entities, grid, A*, movement, economy, combat, fog
│   └── game-ai/        AI Commander (economy, build, production, tactics)
├── assets/             Asset folders + manifest (placeholders documented in ART_ASSET_GUIDE)
└── docs/
```

### Dependency graph (no cycles)

```text
shared-types ← game-data ← game-core ← game-ai ← web
shared-types ← server (type-only for now)
```

Packages expose their TypeScript source (`exports: ./src/index.ts`); Vite and Vitest compile them directly. Every package has its own `tsconfig.json` with `strict: true` and a `typecheck` script.

## 3. Responsibilities

| Layer        | Owns                                                                                                    | Must not                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| game-data    | Static numbers, tile layouts                                                                            | Contain logic                            |
| game-core    | `World`, fixed tick (20 Hz), commands, systems                                                          | Import React/Phaser/DOM/Nest             |
| game-ai      | `AICommander` that reads a team-filtered view of the world and issues the same `Command`s players issue | Read fogged information, cheat resources |
| web (Phaser) | Rendering, camera, input → commands, effects                                                            | Compute damage or game rules             |
| web (React)  | Menus, HUD, minimap, results                                                                            | Run simulation                           |
| server       | Rooms, lobby, later authoritative world                                                                 | Trust client results                     |

## 4. Simulation

- Fixed timestep `TICK_MS = 50` (20 ticks/s). The client accumulates frame time and calls `world.tick()` as many times as needed; rendering interpolates between previous and current positions.
- Entities are plain objects keyed by numeric `id`, stored in a `Map`.
- All mutations happen through `world.issue(command)` (validated: ownership, cost, placement, prerequisites) or inside systems during `tick()`.
- Systems run in order (`World.step`): power → construction → production → economy → movement → combat → projectiles → research → repair →
  support (medic/engineer) → boarding (transports/bunkers) → control points (every 10 ticks) → survival waves → fog (4 Hz) →
  heroic regeneration, victory check and cleanup (1 Hz). AI commanders run outside `step()` and act only through `world.issue()`.
- A seeded PRNG (`mulberry32`) is used for any randomness to keep runs reproducible; AI commanders derive their seed from `World.seed`.
- `world.events` collects per-tick events that the renderer and HUD consume: `shot`, `hit`, `destroyed`, `built`, `produced`, `underAttack`,
  `playerDefeated`, `gameOver`, `pointCaptured`, `pointNeutralized`, `researchComplete`, `promoted`, `sold`, `waveIncoming`, `waveSpawned`.
- Other pure modules in game-core: `missions.ts` (campaign missions + `ObjectiveTracker`), `tutorial.ts`, `progression.ts` (offline profile:
  XP, levels, statistics, achievements). The web app persists their results in `localStorage` (`shadow-front.profile`, `shadow-front.campaign`,
  `shadow-front.settings`).

## 5. Coordinate systems

- **Tile/world space**: continuous `(x, y)` in tile units; tile `(i, j)` covers `[i, i+1) × [j, j+1)`.
- **Screen space (isometric)**: `sx = (x − y) · TILE_W/2`, `sy = (x + y) · TILE_H/2` with `TILE_W = 64`, `TILE_H = 32`. Implemented in `game-core/src/iso.ts` with inverse conversion.
- Depth sorting: `depth = sx/sy based on (x + y)` so objects lower on screen draw on top.

## 6. React ↔ Phaser bridge

- `GameCanvas` React component creates exactly one `Phaser.Game` in `useEffect`, destroys it on unmount (`game.destroy(true)`).
- `GameController` (plain TS) owns the `World`, the AI commanders and an event emitter. The Phaser scene and the React HUD both receive the same controller instance.
- HUD state is pushed into a Zustand store at ~10 Hz (credits, power, selection, queues) — not every frame.
- HUD buttons call controller methods (`queueUnit`, `beginPlacement`, `command`) — never mutate the world directly.
- HUD is a DOM layer above the canvas: clicks on HUD never reach Phaser, satisfying "HUD clicks must not move units".

## 7. Server (phase 0 scope)

NestJS 10 app with:

- `GET /api/health`.
- `LobbyGateway` (Socket.IO namespace `/lobby`): create/join/leave room, ready, faction, add/remove bot. In-memory store.

PostgreSQL + Prisma and Redis are deferred to Phase 6 (accounts, persistence, horizontal scaling). Environment variables are documented in `apps/server/.env.example`.

## 8. Performance targets (to be validated by profiling)

Simulation 20 Hz, client 60 FPS, AI decisions 2–4 Hz, fog recompute 4 Hz, HUD sync 10 Hz.
Pathfinding uses A* with octile heuristic on a binary heap; group moves compute one path per unit with spread destinations.

## 9. Acceptance criteria

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` succeed.
- game-core has no dependency on React/Phaser/Nest (verified by package.json).
- Only one Phaser game instance exists per match screen.

## Map pipeline (v0.4)

`MapDef` (shared-types) is produced either by deterministic layout scripts (`game-data/maps.ts`: Desert Storm, Urban Conflict) or by
importing a [Tiled](https://www.mapeditor.org) JSON map with `parseTiledMap` (`game-data/tiled.ts`; River Crossing and Highland Pass in `game-data/src/maps/`).
Tiled contract: orthogonal, embedded tileset whose tiles carry a string property `kind` (a `TileKind`), CSV tile layer `terrain`,
object layers `spawns` (point objects, int property `index`) and `points` (named point objects), map properties `name`, `description`,
`oreAmount`. Authoring mistakes raise `TiledImportError` with the tile/object at fault. Every map is checked by the game-data tests
(spawn ↔ point connectivity, ore near every base).

Generators for the initial versions of the Tiled maps live in `tools/` (`tiled-lib.mjs` + one script per map). After generation the JSON
file is the source of truth; re-running a generator overwrites manual edits made in Tiled.

Random maps (v0.6): `getMap('random', mapSeed)` calls `generateRandomMap(seed)` (`game-data/maps.ts`), which builds a 64×64, 180°-symmetric
map and re-rolls the seed until `mapIsPlayable` passes (spawn/point connectivity, ore near every base). The result is cached per seed and
`MatchConfig.mapSeed` is stored with the match so rematches use the same map.

## Audio (web only)

All sound is synthesised with Web Audio, with no audio files: `game/audio.ts` (weapons, explosions, alerts; throttled, distance-attenuated,
fog-aware) and `game/music.ts` (procedural menu / battle music). Both start after the first user gesture (browser autoplay policy);
effects and music volumes are separate settings.
