# Changelog

## 0.17.0 — in progress (offline: adaptive AI, new campaign missions)

- **AI learns during a match** (Normal and up): every attack is judged (enemy losses vs own losses). Bad trades make it
  gather a bigger army; failing twice at the same place makes it strike elsewhere; a good trade makes it press on.
  From Hard it also reads your play style — early rushes (bigger home guard), turtling behind turrets (artillery,
  missile battery), aircraft (SAM sites, anti-air), fleets (submarines). Enemy tactic changes show as a message and
  are listed on the results screen ("How the enemy adapted"). Easy never adapts.
- **AI remembers your habits between skirmishes** (Hard / Insane): a style seen in two skirmishes in a row (early
  attacks, heavy defenses, aircraft, fleets) becomes a habit; the next Hard AI prepares the answer from the first
  second and tells you so. Settings: "Hard AI remembers my play style" (on by default), the remembered habits and
  a Forget button. Campaign missions are not affected.
- **Campaign mission 6 "Iron Convoy"** (Snowfield, snow at night): no base — escort a Mobile Command Vehicle past an
  ambush to the Frozen Crossroads, deploy it, hold the forward base for 5 minutes (the clock restarts if it falls)
  while the Iron Guard counter-attacks, then destroy them.
- **Campaign mission 7 "Shadow Front"** (Forest Warfare, day / night cycle, finale): 2 vs 2 with an allied Hard AI
  against two Hard commanders that adapt; hold all 3 points at once and destroy both enemy Headquarters.
- Fixes: the AI never found an enemy that built away from every spawn (it now scouts strategic points and the map
  centre, then keeps patrolling them); the camera starts on your units when you have no base.

## 0.16.0 — 2026-11-23 (offline: Tidewater mission, random sea maps, AI balance)

- **Campaign mission 5 "Tidewater"** (Strait Crossing, unlocks after Highland Siege): build a Naval Yard, sink 3 enemy ships, land troops
  and capture the South Shore, destroy the enemy. New player stat: ships lost.
- **Random map with sea**: a 🌊 Sea option for the random map (remembered) adds an inland sea with a bay at every base ("… Coast", no
  centre point). With the option off every seed still gives the same map as before. Random map descriptions are translated for every seed.
- **AI navy**: the Naval Yard keeps building while land production is held, the AI saves up for Destroyers (it never built one before)
  and pauses the yard for 2 minutes after losing 4 ships in 3 minutes instead of feeding boats one by one.
- **Fairer spawns** (AI-vs-AI simulations): AI building placement, hill choice and A* tie-breaking no longer favour one map corner;
  routes are now mirrored on symmetric maps. Paths prefer the straight line between equally long routes.
- Balance simulations moved to `pnpm --filter @shadow-front/game-ai sim` (not part of `pnpm test`).

## 0.15.0 — 2026-11-20 (offline: submarines, AI fleets, harbour check)

- **Submarine** (Naval Yard, needs Research Center): always submerged — enemies only see it with sonar (Patrol Boat) within 7 tiles,
  anything within 2 tiles, or for 2 s after it fires. Torpedoes hit ships only. Only Patrol Boats (depth charges ×6) and other
  submarines can hurt it. Naval counters: submarine > destroyer > patrol boat > submarine.
- **AI fleets** act on their own: engage visible enemy ships, guard the coast, shell coastal buildings with 3+ warships, otherwise hold
  the home bay. The AI keeps a patrol boat for sonar and builds submarines once it has seen enemy warships.
- **Map editor**: harbour check (⚓) — size of the largest sea and which spawns can build a Naval Yard (same 300-tile rule as the AI).

## 0.14.0 — 2026-11-20 (offline: amphibious warfare, Strait Crossing)

- **Landing Craft** (Naval Yard): unarmed transport with 6 seats — infantry take 1, ground vehicles 3 (a tank + 3 riflemen fills it).
  Troops board from the nearest beach (right-click the craft); unload with U only next to a beach.
- **AI amphibious raids**: from Normal, an AI with a fleet builds one Landing Craft, loads home troops and lands them 5–12 tiles from a
  known enemy building, then sails back for more.
- New map **Strait Crossing**: a strait splits north from south; armies cross only at the two isthmuses, ships rule the middle.
- Fixes: troops just ordered into a transport are no longer pulled into the AI's main attack in the same decision; missing Vietnamese
  messages for full / empty transports.

## 0.13.0 — 2026-11-20 (offline: navy, high-ground AI, raised hills, building backs)

- **Navy**: new map **Coastal Front** (an inland sea with a bay at every base). Build a **Naval Yard** on the shore (it faces the water
  by itself) to launch **Patrol Boats** (fast machine-gun boats, also shoot aircraft) and **Destroyers** (armored, deck gun shells the
  coast from 13 tiles). Ships sail on water only and stop at the coast when sent inland; they cannot take points or flags.
- **AI**: from Normal up the AI holds the nearest hill with up to 3 long-range units (artillery first); on sea maps it builds a Naval
  Yard and keeps a fleet of up to 5 ships.
- Hills are drawn **raised** above the plain with cliff faces; units and buildings on them stand on the plateau and glide up / down
  its edges.
- Buildings now have distinct **front and back** sides (garage door / entrance in front, hatches, vents and ducts at the back) instead of
  a mirrored sprite; the Airfield paints a taxi line toward its front.

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
