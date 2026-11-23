# SHADOW FRONT — Testing

## Automated (run with `pnpm test`)

Total **78** tests (v0.6, 2026-11-19). The v0.7 transport / bunker code has no tests yet.

| Package   | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| game-data | 13    | MVP content counts (shared roster + one unit per faction), random maps (determinism, 40 seeds playable), Highland Pass, producer consistency, map connectivity between all spawns and strategic points, ore near every base (all 3 maps), survival wave composition, Tiled importer (conversion, 9 authoring errors, River Crossing symmetry)                                                                                                                                                                                                                                                                                                                                                |
| game-core | 56    | iso projection round-trip, A* (obstacles, blocked goal, occupancy), counter damage, starting state, placement validation, credit deduction, production + cancel refund, low power, ore extraction, movement, command ownership, auto-combat, fog, decapitation victory, control points (capture, neutralise, contested, air cannot capture), research (cost, time, upgrades, cancel), repair (cost, auto-stop), survival (raider setup, validation, wave warning/spawn/schedule, win, loss), tutorial (setup, ordered objectives, completion), population cap, campaign missions, patrol / sell / veterancy, faction units, medic / engineer, new buildings, domination, offline progression |
| game-ai   | 6     | AI builds base + produces army, AI-vs-AI match reaches combat and a result, AI has no knowledge through fog, AI captures points and researches without overspending, AI repairs only when safe, allied AI survives 10 Easy survival waves                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| server    | 3     | room create/join/leave/host migration, permissions/password/capacity/validation, start conditions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Browser verification (v0.1)

Performed with headless/headed Chrome driven by `puppeteer-core` (scripts kept outside the repo). The web client exposes
`window.__sf` (the `GameController`) **only in Vite dev mode** for such scripts.

Verified: camera pan (WASD), wheel zoom, select army (Q), right-click move (all units moved), drag-box select,
placing a Power Plant via HUD (600 credits deducted) and its construction completing, click-selecting a building,
HUD clicks not reaching the battlefield, pause stopping the simulation, surrender → results → rematch → quit
(exactly one Phaser canvas per match, none after leaving). No console errors. GPU: ~100 FPS at 20 sim ticks/s.

## Manual checklist before a phase is closed

- `pnpm check` passes.
- Start a skirmish on both maps with each difficulty; confirm the AI builds, attacks and defends.
- Watch for units stuck on corners or in crowds; check low-power warning and production slowdown.

## v0.3 additions

- Browsers: the same scripted suites (24 checks) pass on **Chrome, Edge and Firefox**.
- Performance (see RESULT.md §3.5): simulation 1.4 ms/tick with 400 units; rendering 300 fighting units at ~124 FPS (Chrome, GPU) after
  baking procedural shapes into cached textures. AI repair behaviour is exercised in AI-vs-AI runs but has no dedicated assertion yet.

## v0.4 additions

- AI repair now has a dedicated assertion (no repair under fire, repair once safe).
- New browser suites: Survival (8 checks), Tutorial (12 checks, real Q / right-click / HUD build & train input), River Crossing (4 checks).
- Balance is measured with headless AI-vs-AI and AI-defender-vs-waves simulations (numbers in RESULT.md §4.2 and §4.6).

## v0.5 additions

- game-core: population cap (blocked over cap, queued units count, death frees supply), campaign (valid worlds, unlock order, independent
  objectives that stay complete, Iron Fist win condition). game-data: Highland Pass (symmetry, wall, passes, ore).
- Browser: Campaign suite (11 checks), Tutorial now started through Campaign, River suite extended (4th map listed, unit limit in HUD,
  production stops at the limit with the reason in the button tooltip).

## v0.6 additions

- game-core: patrol, sell, veterancy, faction-restricted production, medic / engineer support, Radar / Wall / Missile Launcher, domination scoring,
  random-map worlds, offline progression (levels, XP, achievements, history, sanitising stored data). game-data: random maps (determinism, 40 seeds
  playable), MVP roster rule updated (8–12 shared units + one per faction).
- Browser: `round6` suite (24 checks): profile badge/page, nickname, settings (volumes, fullscreen, controls, FPS), music state menu → battle,
  Domination on a random map, faction rosters, Medic via HUD, Sell via HUD, Patrol via T + click, promotion, XP and achievements on results, history.

## v0.7 additions

- game-core: transports & bunker, building upgrades, faction technologies, capture the flag, credit transfer & colours, challenges (ISO weeks,
  rewards once per period) and titles. game-data: four new maps through the shared connectivity / ore checks.
- Browser: `round7` suite (27 checks): key rebinding (reserved key rejected, in-game effect, panel label), performance mode, challenges & titles,
  four new maps load, CTF HUD and flag alert, army colour, credit transfer, APC boarding by right-click and unloading with U, turret upgrade,
  Bunker in build menu, faction-only research, CTF victory with XP.

## v0.8 additions

- game-ai: `tactics.test.ts` — bunker garrison (keeps 4 mobile infantry), APC boarding + unloading in an attack, allies joining a posted
  attack, transport-helicopter drop raid.
- game-core: MCV deploy (far from base, cannot cancel, build around it; invalid unit / blocked ground / wrong owner), Fighter Jet (air only),
  Bomber splash, formations (shapes, shared speed, tank at the wedge tip, spread unchanged), faction mastery (levels, per-faction gain,
  titles, migration from history).
- Balance: headless AI-vs-AI matrix (Rush vs others, 48 matches) recorded in RESULT.md 8.2.
- Browser: `round8` suite (18 checks): v0.7 performance-mode migration to Low quality, quality / zoom / pan settings saved, formation hotkey
  listed, mastery panel and locked Specialist title, formation row + B hotkey + right-click Line move at the slowest speed, Wedge button,
  Fighter / Bomber / MCV in production menus, MCV deploy via panel, attack on a helicopter (jet attacks, tank attack-moves), fighter kill,
  victory with mastery on results and in Profile. `round7` updated for the quality selector.

## v0.9 additions

- game-data: custom map encoding and validation (spawns, ore, reachability, sizes, damaged data).
- game-core: matches on a custom map (bases on the map's spawns, invalid maps refused), burning, suppression, Missile System stats.
- Balance: Rush matrix re-run after suppression (15/48 Rush wins, 7–26 min).
- Browser: `round9` suite (20 checks): language switch (settings, menu, setup, HUD, translated simulation message, pause menu, back to
  English), map editor (validation messages, mirrored spawns, ore / water / point tools, save, preselected in setup), custom-map match with
  the camera on the base, Missile System in the factory menu, suppressed status, burning damage.

## v0.10 additions

- game-core: faction buildings (one per faction, other factions refused, hospital heals infantry only, repair bay, derrick income,
  howitzer range), smoke (range, cooldown, expiry, hiding from distant enemies), critical-hit rate.
- game-ai: forward base with a Mobile Command Vehicle and extractors.
- Browser: `round10` suite (14 checks): Vietnamese codex / campaign / profile / selection panel / names inside messages, Western build
  menu shows only its faction building, Field Hospital healing, smoke via Z + click with cooldown display, Desert Oil Derrick.

## v0.11 additions

- game-core: unit upgrades (cost, effect on existing / carried / new units only of that type, refusals, cancel refund), unit mastery
  (levels, accumulation, level-ups, title, sanitizing, per-type counting in the simulation), weather / day-night (defaults, vision with
  floor, fog, cycle phases, speed per unit class), ballistic artillery (lead point, apex, bomb drop, hitting a crossing tank).
- game-ai: upgrades its most numerous unit type when it has spare credits.
- Browser: `round11` suite (15 checks): empty unit mastery, weather / time selectors, rain + night match and top-bar indicator, Barracks
  upgrades row (start, pay, complete, message, star), artillery arc, unit mastery on results and Profile, setup remembered, Vietnamese labels.

## v0.12 additions

- game-core: high ground (hill storage, hills on Desert Storm / random maps, vision / range bonus, ~25% misses from below), destructible
  terrain (forest → grass, urban → concrete, walkable, shared map untouched, splash only), building facing (front point per facing,
  stored by `build`, units leave through the front), avatar (default, valid / damaged data).
- Browser: `round12` suite (11 checks): avatar picker, menu badge, saved avatar, editor hill brush, hill bonuses on Desert Storm, rotate with
  R while placing (hint, facing, rally side), R still retreats otherwise, artillery burning a wood to walkable grass, Vietnamese label.

## v0.13 additions

- game-core: navy (Coastal Front has one open sea within 14 tiles of every spawn and is playable; Naval Yard needs the shore and faces
  the water; ships launch on water and stay on water when sent inland; tanks cannot enter water; a destroyer shells a coastal HQ).
- game-ai: holds the nearest hill with long-range units; builds a Naval Yard and a fleet on Coastal Front with no ship ever on land; never
  builds one on Desert Storm.
- Browser: `round13` suite (11 checks): Coastal Front listed and played, shore rule message, shore site near the base, Naval Yard in the
  build panel, yard faces the water even after pressing R, Patrol Boat queued and launched on water, boat ordered inland stays on water,
  War Factories in all four facings, Vietnamese map description. Screenshots checked: raised hills with units on the plateau, distinct
  front / back building sprites, yard and boat.
- All 14 suites pass on Chrome, Edge and Firefox with no console errors (one Firefox launch timed out at browser start-up; the rerun passed).

## v0.14 additions

- game-core: seats (infantry 1, vehicles 3; aircraft / ships never board; APC still infantry only), Landing Craft carries a tank + 3
  riflemen across the sea, refuses to unload at open sea, lands everyone on walkable ground at a beach; passengers die with the craft;
  Strait Crossing layout (playable, one strait within 14 tiles of every spawn, middle column cut by water, edge columns dry).
- game-ai: amphibious raid on Coastal Front (≥ 4 seats loaded, landing, troops ashore near the enemy); Naval Yard + fleet on Strait Crossing.
- Browser: `round14` suite (10 checks): Strait Crossing listed / described / played, Naval Yard on the strait, Landing Craft queued,
  tank + 3 riflemen board through the right-click path (heavy tank left ashore), "6/6 seats" in the selection panel, U refused at sea
  with a shore hint, U at the far beach lands everyone on the south shore, Vietnamese description.
- Browser launcher: `protocolTimeout` raised to 120 s (a slow Firefox start had timed out in v0.13).

## v0.15 additions

- game-data: harbour check (`navalInfo`) on sea maps, a dry map and Desert Storm's small oases.
- game-core: submarine targeting (only sub hunters; torpedoes only hit ships), detection (hidden from a destroyer 7 tiles away inside its
  vision, revealed by Patrol Boat sonar at 6.5, hidden again when the boat is gone, revealed for 2 s after firing), naval counter
  triangle in three 1v1 duels.
- game-ai: fleet sinks a visible enemy destroyer; three destroyers shell a remembered coastal HQ and stay on water.
- Browser: `round15` suite (7 checks): editor harbour check (EN / VI), Submarine built, enemy submarine hidden from a destroyer (inside
  its fog vision), revealed by a Patrol Boat and hunted down, Submarine in the selection panel. Screenshots: hidden enemy sub, see-through
  own sub.

## v0.16 additions

- game-core: Tidewater mission (unlock order, player north / enemy south, Naval Yard objective, 3 ships sunk, South Shore captured);
  a match with `mapSea` gets the Coast variant.
- game-data: 25 random seeds with sea are playable (sea ≥ 300 tiles, a Naval Yard site at all 4 spawns, no "Centre"); the same seed
  without sea keeps "Centre".
- game-ai: the AI still builds ships while it holds land production.
- Balance simulations (`pnpm --filter @shadow-front/game-ai sim`, ~3 min, print tables, no assertions): spawn fairness of identical
  Hard Warlords on 5 symmetric maps, ships built / lost on 3 sea maps.
- Browser: `round16` suite (7 checks): Tidewater unlocked, starts on Strait Crossing with the Naval Yard objective; random map Sea
  checkbox gives a "Coast" map with a big sea and no Centre, choice remembered; a Hard AI given a yard and Research Center queues a
  Destroyer.

## v0.17 additions

- game-ai `adaptation.test.ts` (9): rules (Easy never adapts; patience / switch-target / press; cap; small groups
  ignored; announcement throttle; Hard reads styles once each; Insane sooner) and in a match (4 known turrets → siege
  event, threshold ×1.15, artillery preferred, missile battery in the build list; an early assault → anti-rush and a
  bigger home guard; a wiped-out attack → patience).
- `pnpm sim` adds: adaptive vs non-adaptive Hard AIs (sides swapped), and the same Warlord with / without adaptation
  against Rush and Fortress opponents (24 matches each).
- game-ai memory (4): habits moving average (habit after 2 matches, long habit survives a gap), sanitizing,
  every difficulty notices but only Hard+ act / prime, a Hard commander facing a human primes from memory and
  announces it while an AI-only match ignores it.
- game-core missions (+2): Iron Convoy (no base, convoy + 7-unit ambush, not defeated without buildings, escort →
  deploy → 5-minute hold whose clock restarts when the base falls → destroy) and Shadow Front (2 vs 2 Hard,
  all points + both HQs, decapitation win); unlock order for 7 missions.
- Browser: `round17b` suite (11 checks): Shadow Front locked until Iron Convoy; Iron Convoy briefing, Snowfield /
  snow / night, no base + convoy + ambush, U deploys the MCV at the crossroads, objectives advance to the hold;
  Shadow Front 2 vs 2 against Hard commanders with its objectives; Vietnamese names and briefing. `campaign` suite
  now expects 7 missions.
- Browser: `round17` suite (12 checks): a Hard enemy that knows 4+ player turrets announces the siege tactic in the
  match; the results screen lists it; the turtling is saved to the memory (0.4); no section when nothing was
  adapted; Settings shows "Remembered: heavy defenses"; a Hard AI prepares from memory (message, marked on the
  results screen); option off → fresh AI; Forget clears; Vietnamese message and results section.
