# Changelog

## 0.7.0 — 2026-11-19 (more of docs/PLAN.md, offline)

- **Transports & garrisons**: APC carries 5 infantry, new **Transport Helicopter** carries 6; new **Bunker** for 4 infantry (fires only when occupied).
  Right-click your transport / bunker with infantry selected; **U** unloads.
- **Building upgrades** (level 2 for power plants and defenses) and one **faction technology** per faction.
- **Capture the Flag** mode (first to 3 captures; carriers move at 60% speed).
- New terrain (**snow**, **forest**) and the four maps named in PLAN.md: **Snowfield, Forest Warfare, Island Conflict, Industrial Zone**.
- **Army colour** choice, **send credits** to teammates, **rebindable hotkeys**, **performance mode**.
- **Daily / weekly challenges** with XP rewards and selectable **titles** (offline profile).

## 0.6.0 — 2026-11-19 (features from docs/PLAN.md, offline)

- Commands: **Patrol** (T), **Sell** buildings (50% × HP, queued units refunded), unit **veterancy** (Veteran / Elite / Heroic: +10% damage & HP per rank, Heroic regenerates).
- Units: **Sniper**, **Medic** (heals infantry), **Engineer** (repairs vehicles & buildings) and one **faction unit** each
  (Ranger, MLRS, Gunship, Light Tank, IFV).
- Buildings: **Radar Station** (20-tile vision), **Wall**, **Missile Launcher** (long-range anti-ground).
- Modes & maps: **Domination** (first to 1500 points), **Random Map** generator (seeded, mirrored, playability-checked).
- **Offline profile**: nickname, emblem, level & XP, statistics, match history, 13 achievements; XP / level-up / achievements on the results screen.
- Settings: **procedural music** (menu / battle) with separate music & effects volume, fullscreen toggle, working FPS counter, controls reference.
- Docs: `docs/PLAN_STATUS.md` maps every item of `docs/PLAN.md` to its status.

## 0.5.0 — 2026-11-19 (campaign & population cap)

- **Campaign** with 4 missions (Boot Camp tutorial, Hold the River, Iron Fist, Highland Siege): briefings, objectives, unlock order, saved progress,
  Next mission / Retry on the results screen. The main menu entry "Tutorial" became "Campaign".
- **Population cap** option (100 / 150 default / 200 / unlimited) with a HUD counter; the AI follows the same rule.
- Fourth map **Highland Pass** (Tiled): walled hill town with rich ore, four passes. Shared map generator library in `tools/`.
- Fix: AI randomness ignored the match seed, so matches against the AI repeated identically.

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
