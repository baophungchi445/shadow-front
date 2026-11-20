# SHADOW FRONT

Modern-warfare **real-time strategy** game for the browser — 2.5D isometric, base building, classic Credits + Power
economy, hybrid combat and a custom AI Commander. Design source of truth: [`docs/MASTER_GAME_DEVELOPMENT.md`](docs/MASTER_GAME_DEVELOPMENT.md).

> Status: **v0.12 prototype** (English / Tiếng Việt, with a map editor) — playable offline: skirmish vs AI (strategic points, research, repair, transports, formations),
> **Survival** (enemy waves), **Domination**, **Capture the Flag** and a **Campaign** of 4 missions (starting with a tutorial), on eight maps plus a random map. Current priority is local play; online co-op (Phases 6–7) has a lobby server
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

0. New to RTS? Open **Campaign** → **Boot Camp** (8 guided objectives); later missions unlock one by one.
1. **Play** → choose map, mission, faction and 1–3 AI commanders (difficulty + personality, AI allies allowed) → **Deploy**.
   Mission **Survival**: hold out against 5/10/15 escalating waves (choose wave strength; AI allies optional).
   **Unit limit**: 100 / 150 (default) / 200 / unlimited population per commander.
   Mission **Domination**: strategic points score 1 point/s, first team to 1500 wins. **Capture the Flag**: bring the enemy flag home 3 times. Map **🎲 Random**: a new seeded map each time.
   **Profile** (main menu): level, XP, statistics, match history and achievements, saved in the browser.
   **Map editor** (main menu): draw your own map, save it, then pick it under *Custom maps* in the match setup.
   **Settings → Language**: English or Tiếng Việt.
2. Build a **Power Plant**, then a **Resource Extractor** next to an ore field, **Barracks**, **War Factory**, …
3. Select a building to queue units; right-click the map to set its rally point.
4. Capture **strategic points** (flags) with ground units for extra income and vision; research upgrades at the **Research Center**; repair damaged buildings from the selection panel.
5. Destroy all enemy forces (Annihilation) or the enemy HQ (Decapitation).

| Input                                     | Action                                            |
| ----------------------------------------- | ------------------------------------------------- |
| Left click / drag                         | Select unit or building / box select (Shift adds) |
| Double click                              | Select all units of that type on screen           |
| Right click                               | Move · attack · get in transport · rally point    |
| F · X · G · R                             | Attack-move · Stop · Hold position · Retreat      |
| Q                                         | Select whole army                                 |
| T · U                                     | Patrol · Unload transport / deploy MCV            |
| B                                         | Next formation (Spread / Line / Column / Wedge)   |
| Z, then click                             | Smoke grenade (Rifleman, Ranger, Engineer)        |
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

Maps: `packages/game-data/src/maps/river-crossing.json` and `highland-pass.json` are regular [Tiled](https://www.mapeditor.org) map — open it, edit, save, reload the
game. The authoring contract is in [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md#map-pipeline-v04).

See [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) and [`RESULT.md`](RESULT.md) (work log).
