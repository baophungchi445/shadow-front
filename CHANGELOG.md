# Changelog

## 0.12.0 — 2026-11-20 (offline: terrain, building facing, avatars)

- **High ground**: hills give +2 vision and +1 range; direct fire from below misses a target on a hill 25% of the time. On Desert Storm,
  random maps and in the map editor.
- **Destructible terrain**: artillery, bombs and other explosions burn woods down and collapse city blocks into walkable rubble.
- **Building facing**: press R while placing to turn a building; units come out of its front. The AI points its factories at the front.
- **Avatars**: pick a glyph and a colour in the Profile; shown on the main menu.

## 0.11.0 — 2026-11-20 (offline: unit upgrades, unit mastery, weather, ballistics)

- **Unit upgrades**: at the Barracks / War Factory / Airfield, upgrade a unit type (+20% HP, +15% damage for every unit of that type,
  existing ones too). The AI upgrades the unit type its army relies on.
- **Unit mastery** in the Profile: stars per unit type from units produced and enemies destroyed; new title *Weapons Expert*.
- **Weather and time of day** (match setup): rain, sandstorm, snow; day, night or a day / night cycle. Less vision at night and in bad
  weather, slower ground units in rain / snow / sand; rain, snowflakes, blowing sand and darkness on screen.
- **Ballistic artillery**: shells fly on real arcs, gunners lead moving targets, scatter grows with range, and the landing zone is marked
  while the shell is in the air.

## 0.10.0 — 2026-11-20 (offline: faction buildings, smoke, crits, AI expansion)

- Vietnamese translation of all game data: unit / building / technology / faction names and descriptions, campaign and tutorial,
  achievements, challenges and titles (names inside messages too).
- **Faction buildings**: Field Hospital (Western, heals infantry), Howitzer Emplacement (Eastern, fixed artillery), Repair Bay
  (Pacific, repairs vehicles / buildings), Oil Derrick (Desert, income without ore), Bastion (Iron, armored fortress).
- **Smoke grenades** (Rifleman, Ranger, Engineer; Z then click): enemies cannot see units inside the cloud unless right next to it.
- **Critical hits**: 8% (+3% per veterancy rank) for ×1.5 damage.
- **AI**: Hard / Insane commanders open a forward base with a Mobile Command Vehicle after minute 10; every difficulty answers
  armored assaults on its base with anti-armor units; AI infantry hide in smoke under defensive fire.

## 0.9.0 — 2026-11-20 (offline: language, map editor, combat depth)

- **Language**: Vietnamese / English UI (Settings → Language), including in-game messages and command errors.
  Game data names (units, buildings, maps, campaign text) stay in English for now.
- **Map editor** (main menu): paint 10 terrain kinds and ore, place 2–4 spawns and up to 8 strategic points, mirror mode for fair
  maps, live validation with the game's own rules, save up to 20 maps in the browser and play them in any mode vs AI.
- New unit **Long-range Missile System** (range 20, incendiary). **Incendiary** damage over time (also the Eastern MLRS) and
  **infantry suppression** (pinned infantry move and fire slower).
- Fix: the camera drifted left at match start when the game appeared under a motionless mouse cursor.

## 0.8.0 — 2026-11-20 (offline: smarter AI, new units, formations)

- **AI** uses transports and bunkers: infantry ride APCs into attacks and dismount near the fight, air-minded commanders run
  **Transport Helicopter drop raids** on enemy extractors, defensive commanders build and man a **Bunker**.
  **Allied AIs coordinate**: they join a teammate's attack and send help when an ally's base is assaulted.
- **Rush balance**: every AI keeps a minimum standing army (scaled with match time and with the enemy army it has seen) before
  spending on tech; Rush trades economy for tempo (1 extractor, 1 strategic point). Rush AI win rate in 48 simulated matches: 96% → 35%.
- New units: **Fighter Jet** (air-to-air only), **Bomber** (drops heavy splash bombs on ground targets),
  **Mobile Command Vehicle** (deploys into a Headquarters anywhere: forward bases).
- **Formations**: Spread / Line / Column / Wedge for group moves (B cycles; formation groups move at the slowest unit's speed).
- Settings: **graphics quality** Low / Medium / High (replaces performance mode), **zoom speed**, **drag-pan sensitivity**.
- Profile: **faction mastery** levels 0–10 and two new titles (Specialist, Grandmaster).
- Fix: attack orders on aircraft no longer leave units that cannot shoot up standing idle (they attack-move instead).

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
