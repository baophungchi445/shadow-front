# Changelog

## 0.4.0 — 2026-11-19 (offline content)

- **Survival mode:** 5 / 10 / 15 escalating enemy waves from the free spawns, announced 20 s ahead; wave strength Easy–Insane; AI allies optional.
- **Tutorial:** 8 guided objectives against a passive enemy outpost, objective panel in the HUD, Tutorial entry in the main menu.
- **Tiled JSON map importer** (`parseTiledMap`) with clear authoring errors, and a third map, **River Crossing** (3 bridges, 2 fords, 180° symmetric).
- AI: no pre-attack "deathball" (production pauses at 1.5× attack threshold until the first attack is allowed); allied AIs defend in Survival.
- Fix: Match Setup panel overflowed horizontally (second map button cut off).
- Tests: dedicated AI repair test; survival, tutorial and Tiled importer suites (49 tests).

## 0.3.0 — 2026-11-19 (local play vs AI)

- Strategic control points (capture / neutralise / contested, income + vision), Research Center technologies, building repair.
- AI captures points, researches by personality, repairs buildings; first-attack timers per difficulty; building HP ×1.6.
- Game speed 0.5×–3×, procedural WebAudio sound effects + volume, attack pings on minimap and Space-to-alert, remembered skirmish setup.
- Rendering: procedural shapes baked into cached textures and pooled particle sprites (300-unit battle 25 → 124 FPS).
- Fix: hotkeys fired several times when focus was on a HUD button.
- Multiplayer menu entry hidden while development focuses on local play.

## 0.1.0 — 2026-11-19

- pnpm monorepo (apps/web, apps/server, packages/shared-types, game-data, game-core, game-ai), strict TypeScript, ESLint, Prettier.
- Documentation set in `docs/`.
- Deterministic simulation: A* pathfinding, group movement, economy (credits, power, finite ore), construction,
  production queues, projectile combat with counter table, fog of war, Annihilation/Decapitation victory.
- AI Commander with 4 difficulties and 5 personalities, fog-respecting, same rules as players.
- Phaser 3 isometric renderer with procedural placeholder art, effects, fog overlay; React HUD, minimap, menus, results.
- Two maps (Desert Storm, Urban Conflict), five faction configurations, nine unit types, nine buildings.
- NestJS + Socket.IO lobby server (in-memory rooms).
