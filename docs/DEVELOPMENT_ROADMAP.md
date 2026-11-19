# SHADOW FRONT — Development Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ not started. Work log: `/RESULT.md`.

| Phase | Name                | Scope                                                                                 | Acceptance criteria                              | Status                                                                                                                                       |
| ----- | ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation          | pnpm monorepo, TS strict, ESLint/Prettier, packages, docs, NestJS skeleton            | install/typecheck/lint/build pass                | ✅ (PostgreSQL/Prisma/Redis deferred to 6)                                                                                                   |
| 1     | Isometric prototype | Phaser iso terrain, camera pan/zoom/bounds, units, click/drag selection, HUD, minimap | map renders, camera works, units selectable      | ✅ (scripted maps + Tiled JSON importer, 3 maps)                                                                                             |
| 2     | Unit movement       | A*, obstacles, group move, separation, re-path                                        | units avoid blocked terrain, move in groups      | ✅                                                                                                                                           |
| 3     | Economy & building  | credits, power, extractors, placement, construction, production queues                | base can be built, units produced, costs correct | ✅                                                                                                                                           |
| 4     | Combat              | vision, targeting, projectiles, damage table, stances, effects                        | units fight, die, commands override              | ✅                                                                                                                                           |
| 5     | AI Commander        | FSM + utility AI, difficulty, personalities, fog-respecting                           | AI builds, produces, attacks, defends            | ✅                                                                                                                                           |
| 6     | Lobby               | NestJS rooms via Socket.IO, auth, Postgres/Prisma, Redis, lobby UI                    | 2 browsers share a room                          | 🟡 gateway + rooms service done; auth, DB, Redis, web lobby UI pending                                                                       |
| 7     | Online Co-op        | authoritative server sim, snapshots/deltas, reconnection                              | consistent state across clients                  | ⬜                                                                                                                                           |
| 8     | PvP / UI polish     | real art, audio, PvP modes                                                            | MVP DoD                                          | 🟡 local polish done (procedural audio, speed control, alerts, control points, research, repair, Survival, Tutorial); real art & PvP pending |
| 9     | Testing & release   | profiling, security, deployment                                                       | public beta                                      | 🟡 local: profiling + render optimisation (25→124 FPS), Chrome/Edge/Firefox verified; deployment/security of online parts pending            |

## Current priority

Local play vs AI first (decided 2026-11-19). Online multiplayer (Phases 6–7) and a graphics upgrade are deferred.

## Next steps (recommended order, local first)

1. Playtest with real players (skirmish, Survival, Tutorial); tune AI difficulty, wave strength and match length toward the
   20–35 min target. Open design question: a population cap (the master doc mentions "unit limitations") would also bound army size.
2. More offline content: further maps authored in Tiled, campaign-style missions built on the tutorial objective system.
3. Later (deferred by decision): online lobby UI + authoritative server simulation (Phases 6–7), production art.

Done in v0.4: Survival mode, Tutorial, Tiled importer + River Crossing.

## Rules

- Do not start a phase while the previous one has blocking errors.
- Each phase ends with: lint, typecheck, tests, build, manual verification, doc update.
