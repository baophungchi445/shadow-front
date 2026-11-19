# SHADOW FRONT

Modern-warfare **real-time strategy** game for the browser — 2.5D isometric, base building, classic Credits + Power
economy, hybrid combat and a custom AI Commander. Design source of truth: [`docs/MASTER_GAME_DEVELOPMENT.md`](docs/MASTER_GAME_DEVELOPMENT.md).

> Status: **v0.4 prototype** — playable offline: skirmish vs AI (strategic points, research, repair), **Survival** (enemy waves) and a
> **Tutorial**, on three maps (one imported from Tiled). Current priority is local play; online co-op (Phases 6–7) has a lobby server
> foundation only. All battlefield graphics are procedural placeholders, not production art.

## Requirements

- Node.js ≥ 20 (tested with 22)
- pnpm 9 (`corepack enable` or `npm i -g pnpm`)

## Run

```bash
pnpm install
pnpm dev            # web client → http://localhost:5173
pnpm dev:server     # optional: lobby server → http://localhost:3000/api/health
```

Quality gates:

```bash
pnpm typecheck      # strict TypeScript in every workspace
pnpm lint           # ESLint (flat config)
pnpm test           # Vitest: game-data, game-core, game-ai, server
pnpm build          # web (Vite) + server (tsc)
pnpm check          # all of the above
```

## How to play

0. New to RTS? Start with **Tutorial** in the main menu (8 guided objectives).
1. **Play** → choose map, mission, faction and 1–3 AI commanders (difficulty + personality, AI allies allowed) → **Deploy**.
   Mission **Survival**: hold out against 5/10/15 escalating waves (choose wave strength; AI allies optional).
2. Build a **Power Plant**, then a **Resource Extractor** next to an ore field, **Barracks**, **War Factory**, …
3. Select a building to queue units; right-click the map to set its rally point.
4. Capture **strategic points** (flags) with ground units for extra income and vision; research upgrades at the **Research Center**; repair damaged buildings from the selection panel.
5. Destroy all enemy forces (Annihilation) or the enemy HQ (Decapitation).

| Input                                     | Action                                            |
| ----------------------------------------- | ------------------------------------------------- |
| Left click / drag                         | Select unit or building / box select (Shift adds) |
| Double click                              | Select all units of that type on screen           |
| Right click                               | Move · attack enemy · set rally point             |
| F · X · G · R                             | Attack-move · Stop · Hold position · Retreat      |
| Q                                         | Select whole army                                 |
| Ctrl+1-9 / 1-9                            | Assign / recall group (double tap centres camera) |
| WASD / arrows / screen edge / middle drag | Pan camera                                        |
| Mouse wheel                               | Zoom                                              |
| Space                                     | Jump to latest attack alert, then base            |
| - / =                                     | Game speed (0.5× – 3×)                            |
| P / F10                                   | Pause menu                                        |

## Structure

```text
apps/web            React + Vite + Phaser 3 client (UI, rendering, input)
apps/server         NestJS + Socket.IO lobby server
packages/shared-types   Shared TypeScript types (ids, definitions, commands, lobby)
packages/game-data      Config-driven content: units, buildings, factions, maps (+ Tiled importer), AI profiles, survival waves, balance
packages/game-core      Deterministic simulation: grid, A*, movement, economy, combat, fog, victory
packages/game-ai        AI Commander (FSM + utility scoring, fog-respecting)
docs/                   Design & technical documentation
tools/                  One-off generators (e.g. the initial River Crossing Tiled map)
assets/                 Asset folders + manifest (production art pending)
```

Maps: `packages/game-data/src/maps/river-crossing.json` is a regular [Tiled](https://www.mapeditor.org) map — open it, edit, save, reload the
game. The authoring contract is in [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md#map-pipeline-v04).

See [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) and [`RESULT.md`](RESULT.md) (work log).
