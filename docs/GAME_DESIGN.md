# SHADOW FRONT — Game Design

> Source of truth: `MASTER_GAME_DEVELOPMENT.md`. This document condenses the agreed design into an implementable specification. It must not contradict the master document.

## 1. Goal

SHADOW FRONT is a browser-based, modern-warfare real-time strategy (RTS) game rendered in 2.5D isometric view. Players build a base, harvest resources, produce an army and defeat AI commanders, alone or cooperatively online (up to 5 players).

Target match length: 20–35 minutes.

## 2. Locked design decisions

| Category             | Decision                                                    |
| -------------------- | ----------------------------------------------------------- |
| Camera               | 2.5D isometric                                              |
| Art style            | Stylized realism (placeholders until production art exists) |
| Setting              | Modern warfare                                              |
| Factions             | 5                                                           |
| Combat               | Hybrid (auto-engage + direct commands)                      |
| Economy              | Classic RTS (Credits + Power)                               |
| Multiplayer priority | Co-op vs AI                                                 |
| Max players          | 5                                                           |
| AI                   | Custom rule/utility based, no LLM                           |

## 3. Core loop

`BUILD BASE → GATHER RESOURCES → BUILD ARMY → EXPLORE → CONTROL TERRITORY → COMBAT → VICTORY`

Opening sequence: Headquarters + starting credits → Power Plant → Resource Extractor → Barracks → War Factory → army → scout → attack/defend.

## 4. Factions

All factions share the base roster and differ through stat modifiers, colour, preferred units and (since v0.6) **one exclusive faction unit** each
(master doc §2.2, "MVP may share units"). Faction-specific buildings, weapons and technologies are not implemented yet.

| Faction            | Style           | MVP modifier                                |
| ------------------ | --------------- | ------------------------------------------- |
| Western Alliance   | Balanced        | +5% all-round HP, standard costs            |
| Eastern Legion     | Heavy firepower | Armor/artillery +15% damage, −10% speed     |
| Pacific Technology | Technology      | +25% vision, drones/air −10% cost           |
| Desert Corps       | Rapid assault   | +20% speed for vehicles, −10% HP            |
| Iron Republic      | Defensive       | Buildings/defenses +30% HP, units −5% speed |

No faction may be strictly dominant; modifiers are balanced as +/− pairs.

## 5. Units (MVP roster)

| Unit                       | Category  | Armor class | Role                                      |
| -------------------------- | --------- | ----------- | ----------------------------------------- |
| Rifleman                   | Infantry  | infantry    | Cheap anti-infantry, weak anti-air        |
| Anti-Tank Soldier          | Infantry  | infantry    | Rockets, strong vs vehicles               |
| Light Tank / Recon Vehicle | Armored   | light       | Fast raider                               |
| Main Battle Tank           | Armored   | heavy       | Core line unit                            |
| Heavy Tank                 | Armored   | heavy       | Slow, high HP (Research Center required)  |
| APC                        | Armored   | light       | Durable, anti-infantry MG                 |
| Mobile Artillery           | Artillery | light       | Long range, min-range, weak up close      |
| Attack Helicopter          | Air       | air         | Fast, strong vs armor, flies over terrain |
| Recon Drone                | Air       | air         | Unarmed, large vision                     |
| Sniper (v0.6)              | Infantry  | infantry    | Range 9, kills infantry, weak vs armor    |
| Medic (v0.6)               | Infantry  | infantry    | Unarmed, heals nearby infantry            |
| Engineer (v0.6)            | Infantry  | infantry    | Unarmed, repairs vehicles and buildings   |

Faction units (v0.6, only the owning faction can produce them):

| Faction            | Unit                    | Role                                    |
| ------------------ | ----------------------- | --------------------------------------- |
| Western Alliance   | Ranger (Special Forces) | Fast, tough elite infantry              |
| Eastern Legion     | Rocket Launcher (MLRS)  | Salvo artillery, wide splash            |
| Pacific Technology | Gunship                 | Anti-infantry helicopter                |
| Desert Corps       | Light Tank              | Very fast flanking tank                 |
| Iron Republic      | IFV                     | Armored infantry vehicle, also hits air |

In progress (v0.7, simulation only, no HUD yet): Transport Helicopter (carries 6 infantry); the APC carries 5 infantry.

Counter rules are expressed as a damage multiplier table `weaponType × armorClass` (see `GAMEPLAY_SYSTEMS.md`).

## 6. Buildings

MVP: Headquarters, Power Plant, Barracks, War Factory, Airfield, Research Center. Supporting: Resource Extractor, Defense Turret (anti-ground) and SAM Site (anti-air).
v0.6: Radar Station (long vision), Wall (blocks ground units), Missile Launcher (long-range anti-ground).
In progress (v0.7, simulation only): Bunker (garrisons 4 infantry who fire out).

Buildings can be repaired (credits over time) and sold (50% of price × HP ratio). Building rotation and upgrades are not implemented.

## 7. Modes

- **Skirmish vs AI (offline)** — 1 human vs 1–3 AI, AI allies allowed (offline co-op with AI).
- **Survival (offline, v0.4)** — 5 / 10 / 15 escalating waves.
- **Campaign (offline, v0.5)** — 4 missions with briefings and objectives; mission 1 is the tutorial.
- **Domination (offline, v0.6)** — hold strategic points to score; first team to 1500 wins.
- **Co-op vs AI (online)** — primary multiplayer mode, phase 6–7 (deferred).
- PvP 3v3 / 5v5, Capture the Flag — future.

Mission types: **Annihilation** (destroy all enemy buildings and units), **Decapitation** (destroy enemy Headquarters), plus the Survival
and Domination rules above. Optional population cap 100 / 150 / 200 / unlimited.

## 8. Maps

- **Desert Storm** — open desert, ridges, many resource fields, tank-friendly.
- **Urban Conflict** — city blocks, narrow streets, chokepoints, infantry-friendly.
- **River Crossing** (v0.4, Tiled) — river valley with 3 bridges and 2 fords.
- **Highland Pass** (v0.5, Tiled) — walled hill town with rich ore, reached through 4 passes.
- **Random Map** (v0.6) — seeded generator (Dunes / Valley / Outskirts themes), 180° symmetric, re-rolled until playable.

Not yet: Forest Warfare, Snowfield, Island Conflict, Industrial Zone (need snow / forest terrain), in-game map editor, elevation, destructible terrain.

Each map defines: tile grid, blocked tiles, resource nodes, spawn points / base zones, strategic points.

## 9. Acceptance criteria (MVP game)

- Isometric map renders; camera pans/zooms within bounds.
- Units can be selected (click / drag box), moved with pathfinding, and fight.
- Buildings can be placed, constructed, powered and destroyed.
- Credits and power work; production queues spawn units.
- Fog of War hides unexplored/unseen areas.
- AI builds, harvests, produces, defends and attacks under the same rules.
- A match ends with victory/defeat and a results screen.

## 10. Player profile (offline, v0.6)

Stored per browser: nickname, faction emblem, level & XP, statistics, last 20 matches, 13 achievements. Accounts, friends, chat,
leaderboards and ranking need the online backend and are deferred. Feature-by-feature status: `docs/PLAN_STATUS.md`.
