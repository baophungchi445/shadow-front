# SHADOW FRONT — Development Roadmap

Status legend: ✅ done · 🟡 partial · ⬜ not started. Work log: `/RESULT.md`.

| Phase | Name                | Scope                                                                                 | Acceptance criteria                              | Status                                                                                                                                                                                                                                                   |
| ----- | ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation          | pnpm monorepo, TS strict, ESLint/Prettier, packages, docs, NestJS skeleton            | install/typecheck/lint/build pass                | ✅ (PostgreSQL/Prisma/Redis deferred to 6)                                                                                                                                                                                                               |
| 1     | Isometric prototype | Phaser iso terrain, camera pan/zoom/bounds, units, click/drag selection, HUD, minimap | map renders, camera works, units selectable      | ✅ (scripted maps + Tiled JSON importer, 4 maps + random generator)                                                                                                                                                                                      |
| 2     | Unit movement       | A*, obstacles, group move, separation, re-path                                        | units avoid blocked terrain, move in groups      | ✅                                                                                                                                                                                                                                                       |
| 3     | Economy & building  | credits, power, extractors, placement, construction, production queues                | base can be built, units produced, costs correct | ✅                                                                                                                                                                                                                                                       |
| 4     | Combat              | vision, targeting, projectiles, damage table, stances, effects                        | units fight, die, commands override              | ✅                                                                                                                                                                                                                                                       |
| 5     | AI Commander        | FSM + utility AI, difficulty, personalities, fog-respecting                           | AI builds, produces, attacks, defends            | ✅                                                                                                                                                                                                                                                       |
| 6     | Lobby               | NestJS rooms via Socket.IO, auth, Postgres/Prisma, Redis, lobby UI                    | 2 browsers share a room                          | 🟡 gateway + rooms service done; auth, DB, Redis, web lobby UI pending                                                                                                                                                                                   |
| 7     | Online Co-op        | authoritative server sim, snapshots/deltas, reconnection                              | consistent state across clients                  | ⬜                                                                                                                                                                                                                                                       |
| 8     | PvP / UI polish     | real art, audio, PvP modes                                                            | MVP DoD                                          | 🟡 local polish done (procedural audio, speed control, alerts, control points, research, repair, Survival, Tutorial, Campaign, population cap, Domination, patrol/sell/veterancy, new units & buildings, offline profile, music); real art & PvP pending |
| 9     | Testing & release   | profiling, security, deployment                                                       | public beta                                      | 🟡 local: profiling + render optimisation (25→124 FPS), Chrome/Edge/Firefox verified; deployment/security of online parts pending                                                                                                                        |

## Current priority

Local play vs AI first (decided 2026-11-19). Online multiplayer (Phases 6–7) and a graphics upgrade are deferred.

## Next steps (recommended order, local first)

1. Playtest with real players (skirmish, Survival, Tutorial); tune AI difficulty, wave strength and match length toward the
   20–35 min target; decide whether the population cap stays on by default. Simulations show AI-vs-AI matches end in 6–15 min because
   the first successful attack is usually decisive.
2. More offline content: more Tiled maps and campaign missions (the mission framework only needs a config + objectives).
3. Later (deferred by decision): online lobby UI + authoritative server simulation (Phases 6–7), production art.

Done in v0.4: Survival mode, Tutorial, Tiled importer + River Crossing.
Done in v0.5: Campaign (4 missions), population cap option, Highland Pass.
Done in v0.6–v0.8: offline items from `docs/PLAN.md` (see `docs/PLAN_STATUS.md`). v0.8: AI transports / bunkers / team coordination,
Rush balance, Fighter Jet, Bomber, Mobile Command Vehicle, formations, graphics quality, faction mastery.
v0.9: Vietnamese / English UI, in-game map editor, Long-range Missile System, burning, suppression.
v0.10: Vietnamese game data, faction buildings, smoke grenades, critical hits, AI forward bases (MCV).
v0.11: per-unit-type upgrades, unit mastery, weather and day / night, ballistic artillery.
v0.12: high ground (hills), destructible woods / city blocks, building facing, profile avatars.

## Rules

- Do not start a phase while the previous one has blocking errors.
- Each phase ends with: lint, typecheck, tests, build, manual verification, doc update.
