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

All factions share the base roster in the MVP and differ through stat modifiers, colour and preferred units (master doc §2.2, "MVP may share units").

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

Counter rules are expressed as a damage multiplier table `weaponType × armorClass` (see `GAMEPLAY_SYSTEMS.md`).

## 6. Buildings

MVP: Headquarters, Power Plant, Barracks, War Factory, Airfield, Research Center. Supporting: Resource Extractor, Defense Turret (anti-ground) and SAM Site (anti-air).

## 7. Modes

- **Skirmish vs AI (offline)** — implemented first; 1 human vs 1–3 AI.
- **Co-op vs AI (online)** — primary multiplayer mode, phase 6–7.
- PvP, Survival, Campaign — future.

Mission types (MVP): **Annihilation** (destroy all enemy buildings) and **Decapitation** (destroy enemy Headquarters).

## 8. Maps

- **Desert Storm** — open desert, ridges, many resource fields, tank-friendly.
- **Urban Conflict** — city blocks, narrow streets, chokepoints, infantry-friendly.

Each map defines: tile grid, blocked tiles, resource nodes, spawn points / base zones, strategic points.

## 9. Acceptance criteria (MVP game)

- Isometric map renders; camera pans/zooms within bounds.
- Units can be selected (click / drag box), moved with pathfinding, and fight.
- Buildings can be placed, constructed, powered and destroyed.
- Credits and power work; production queues spawn units.
- Fog of War hides unexplored/unseen areas.
- AI builds, harvests, produces, defends and attacks under the same rules.
- A match ends with victory/defeat and a results screen.
