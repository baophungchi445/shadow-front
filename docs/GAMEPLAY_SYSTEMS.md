# SHADOW FRONT — Gameplay Systems

All numbers live in `packages/game-data`. This document defines rules, not balance values.

## 1. Grid & terrain

- Map = `width × height` tiles. Tile kinds: `sand`, `grass`, `road`, `rock` (blocked), `water` (blocked), `building-lot`, `urban` (blocked structures), `ore` (resource field, walkable).
- Navigation grid: a tile is walkable for ground units when terrain is walkable and no building footprint occupies it. Air units ignore the grid.

## 2. Movement & pathfinding

- A* on 8-connected grid, octile heuristic, no diagonal corner cutting.
- When a destination is blocked, the nearest walkable tile (BFS ring search) is used.
- Group move: destinations are spread in a spiral around the clicked tile so units don't stack.
- Units follow waypoints; light separation pushes overlapping ground units apart.
- If the next waypoint becomes blocked (new building), the unit re-paths.

## 3. Economy

- **Credits**: starting amount from match settings. Income from **Resource Extractors** built on/adjacent to `ore` tiles (each ore field has finite credits) plus a small HQ trickle.
- **Power**: Power Plants produce, other buildings consume. When `consumed > produced` the team is in **low power**: production and construction speed ×0.5, defenses fire at ×0.5 rate.
- Costs are deducted when production/construction is queued; cancel refunds in full.

## 4. Buildings

- Placement rules: footprint inside map, all tiles buildable, not overlapping, within build radius of an existing friendly building (except HQ), not on unexplored tiles.
- Construction: building spawns with `progress = 0`, HP grows with progress, completes after `buildTime`.
- Prerequisites: e.g. War Factory requires Barracks; Airfield and Research Center require War Factory; Heavy Tank requires Research Center.
- Production queue per producer (max 5). Produced units spawn at the nearest free tile next to the building and move to the rally point.

## 5. Combat

- Each unit/defense has a weapon: `damage`, `range`, `cooldown`, `projectile speed`, `weaponType` (`bullet`, `shell`, `rocket`, `artillery`, `missile`), `canTargetGround`, `canTargetAir`, optional `minRange`, optional `splash`.
- Damage = `weapon.damage × multiplier[weaponType][armorClass] × factionModifier`.
- Projectiles travel with finite speed; damage applies on arrival (hit detection at impact point). Artillery uses splash.
- Auto-acquire: idle / attack-moving units pick the best target within vision (priority: can-hit-back → lowest HP ratio → nearest).
- Stances: `aggressive` (default: chase within leash), `hold` (fire only in range, never move), `move` (ignore enemies until arrival).
- Commands: Move, Attack (focus fire), Attack-Move, Hold Position, Stop, Retreat (move to HQ ignoring enemies).
- Destruction emits events for explosion/smoke effects; buildings leave rubble.

### Counter multipliers (rows = weapon, cols = armor)

|           | infantry | light | heavy | air | building |
| --------- | -------- | ----- | ----- | --- | -------- |
| bullet    | 1.0      | 0.4   | 0.15  | 0.5 | 0.2      |
| shell     | 0.5      | 1.0   | 1.0   | 0   | 0.8      |
| rocket    | 0.3      | 1.2   | 1.4   | 0.8 | 0.9      |
| artillery | 1.2      | 0.9   | 0.7   | 0   | 1.2      |
| missile   | 0.2      | 0.6   | 0.6   | 1.8 | 0.2      |

## 5b. Strategic control points

- Each map defines 3 points (`MapDef.strategicPoints`). Radius 3 tiles.
- Ground units of a single team inside the radius capture the point: 240 ticks (12 s) with one unit, up to 3× faster with three or more.
- An enemy-held point must first be **neutralised**, then captured. If several teams are present the point is **contested** and progress freezes. Without units, progress decays.
- Aircraft cannot capture.
- Owner receives +6 credits/s per point; the owning team gets 7-tile vision around it.
- Ownership of a defeated player passes to a living teammate, otherwise the point becomes neutral.

## 5c. Research (Research Center)

| Technology           | Cost | Time | Effect                                                    |
| -------------------- | ---- | ---- | --------------------------------------------------------- |
| Composite Armor      | 1200 | 30 s | Vehicles & artillery +20% max HP (existing and new units) |
| Improved Munitions   | 1500 | 35 s | +15% damage for all units and defenses                    |
| Advanced Optics      | 800  | 20 s | +25% unit vision                                          |
| Efficient Extraction | 1000 | 25 s | Resource Extractors +30% credits                          |

One technology at a time per Research Center; cancel refunds; low power halves research speed.

## 5d. Repair

Owner toggles repair on a completed, damaged building. A full 0→100% repair takes 25 s and costs 50% of the building price, paid per tick. Repair stops automatically when full or when credits run out.

## 5e. Survival mode (v0.4, offline)

- `mission: 'survival'` with `MatchConfig.survival = { difficulty, waves }` (5 / 10 / 15 waves). All commanders are on one team and at least one
  map spawn must stay free: the free spawns are the wave **entry points**.
- The attacker is a special base-less player (**Hostile Forces**, `Player.raider`). Waves are a rule of the mode, spawned by
  `game-core/systems/waves.ts`, not an AI Commander; defenders follow the normal economy.
- Timing: first wave at 3:00, then every 1:30; each wave is announced 20 s ahead (`waveIncoming` with its entry point), enters at a random
  entry point (`waveSpawned`) and attack-moves to the nearest defender building; idle wave units are re-targeted every 5 s.
- Size: budget `450 + 420·n + 45·n²` credits of units (every 5th wave ×1.3) × difficulty (Easy 0.6, Normal 1, Hard 1.35, Insane 1.75), max 36 units.
  Pool: infantry + recon from wave 1, APC + MBT from 3, artillery + helicopter from 5, heavy tanks from 7. Deterministic per seed.
- Victory: every wave has entered and been destroyed. Defeat: all defenders eliminated.

## 5f. Tutorial (v0.4, offline)

- `mission: 'tutorial'`, fixed setup (`tutorialConfig()`): Desert Storm, 8000 credits, the player vs. a passive **Enemy Outpost**
  (starting HQ + units, no AI Commander — its units only defend themselves). Annihilation rules apply.
- Objectives are completed strictly in order (`TutorialTracker`): select units → move → Power Plant → Resource Extractor → Barracks →
  train 3 units → capture a strategic point → destroy the outpost.

## 6. Fog of War

- Per team: `explored` (ever seen) and `visible` (seen now) bitsets, recomputed at 4 Hz from vision radius of units and buildings.
- Allies share vision.
- Enemies outside `visible` are not rendered and are not available to the AI.

## 7. Victory

- Annihilation: a team loses when it has no buildings left and no units.
- Decapitation: a team loses when its Headquarters is destroyed.
- Match ends when only one alliance remains.

## 8. Acceptance criteria

- Unit tests cover: iso conversion, A*, placement validation, credit deduction/refund, power, damage multipliers, targeting, fog, control points, research, repair, survival waves and victory, tutorial objectives, Tiled map import.
