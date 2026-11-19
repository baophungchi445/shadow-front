# SHADOW FRONT — Testing

## Automated (run with `pnpm test`)

| Package   | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| game-data | 9     | MVP content counts, producer consistency, map connectivity between all spawns and strategic points, ore near every base (all 3 maps), survival wave composition, Tiled importer (conversion, 9 authoring errors, River Crossing symmetry)                                                                                                                                                                                                                                                                                                     |
| game-core | 31    | iso projection round-trip, A* (obstacles, blocked goal, occupancy), counter damage, starting state, placement validation, credit deduction, production + cancel refund, low power, ore extraction, movement, command ownership, auto-combat, fog, decapitation victory, control points (capture, neutralise, contested, air cannot capture), research (cost, time, upgrades, cancel), repair (cost, auto-stop), survival (raider setup, validation, wave warning/spawn/schedule, win, loss), tutorial (setup, ordered objectives, completion) |
| game-ai   | 6     | AI builds base + produces army, AI-vs-AI match reaches combat and a result, AI has no knowledge through fog, AI captures points and researches without overspending, AI repairs only when safe, allied AI survives 10 Easy survival waves                                                                                                                                                                                                                                                                                                     |
| server    | 3     | room create/join/leave/host migration, permissions/password/capacity/validation, start conditions                                                                                                                                                                                                                                                                                                                                                                                                                                             |

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
