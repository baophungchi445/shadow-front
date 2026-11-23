# SHADOW FRONT — AI Design

## 1. Principles

- No LLM / external API. Pure TypeScript in `packages/game-ai`.
- **Same rules as players**: the AI only acts through `world.issue(command)`, pays the same costs and build times.
- **No map hack**: the AI reads enemies only through `world.visibleEnemies(team)`; enemy base location must be scouted (spawn candidates are public map knowledge, like a human reading the map).
- Difficulty never grants free resources.

## 2. Structure

```text
AICommander (per AI player)
├── StrategyFSM          OPENING → BUILDUP → ATTACK ↔ DEFEND → (RETREAT)
├── EconomyManager       power balance, extractors on free ore
├── BuildManager         build order from personality, placement search
├── ProductionManager    utility scoring of units (counters to seen enemy)
├── ScoutManager         sends one fast unit to unexplored spawn candidates
└── ArmyManager          squads: defense squad, attack squad, retreat logic
```

Decisions run every `thinkInterval` ticks (difficulty-dependent; 2–4 Hz on Hard/Insane).

## 3. Strategy FSM

| State   | Enter when                                     | Behaviour                                   |
| ------- | ---------------------------------------------- | ------------------------------------------- |
| OPENING | match start                                    | follow build order, minimal army            |
| BUILDUP | opening done                                   | produce army, expand extractors             |
| ATTACK  | army value ≥ attack threshold and target known | attack-move toward known enemy building     |
| DEFEND  | visible enemy within base radius               | pull all combat units to threat             |
| RETREAT | attack squad lost > 60% strength               | move survivors back home, return to BUILDUP |

## 4. Utility production

Score for unit `u` = `baseWeight[personality][u] + counterBonus(u, seenEnemyComposition) − queuePenalty`. Highest affordable score is queued.

## 5. Difficulty

| Level  | Think interval | Attack threshold    | Micro            | Notes                                |
| ------ | -------------- | ------------------- | ---------------- | ------------------------------------ |
| Easy   | 2.0 s          | high, slow          | none             | builds slowly (delay between orders) |
| Normal | 1.0 s          | medium              | basic            | defends base                         |
| Hard   | 0.5 s          | lower               | counters, scouts | retreats damaged squads              |
| Insane | 0.25 s         | lowest, multi-prong | full             | splits two attack groups             |

## 6. Personalities

| Personality     | Build order bias  | Unit bias              | Attack timing        |
| --------------- | ----------------- | ---------------------- | -------------------- |
| RUSH            | Barracks early    | infantry + light tanks | early, frequent      |
| FORTRESS        | Turrets/SAM early | heavy tanks, artillery | late, counter-attack |
| EAGLE           | Airfield early    | helicopters, drones    | medium               |
| SHADOW (later)  | recon focus       | light raiders          | ambush               |
| WARLORD (later) | balanced          | mixed                  | large, multi-front   |

MVP implements RUSH, FORTRESS, EAGLE, WARLORD (SHADOW falls back to balanced weights).

## 6b. Pacing, territory and technology (v0.3)

- First attack is held back per difficulty (`firstAttackTick`: Easy 9 min, Normal 7, Hard 5, Insane 3.5; scaled ×0.6–1.4 by personality aggression) and waves are separated by `attackCooldown`. Defence is always active.
- **Capture:** outside of opening/defence, the AI sends a 3-unit ground squad to the nearest strategic point not held by its team (Easy holds at most one). Points are public map information.
- **Research:** Normal+ AIs research in their personality's `researchOrder` when they own an idle Research Center and have the cost + 300 credits.
- **Repair:** buildings below 70% HP are repaired when no visible enemy is within 9 tiles and the AI has ≥ 400 credits.

## 6c. Balance guard, Survival and Tutorial (v0.4)

- **No pre-attack deathball:** while the first attack is held back (`firstAttackTick`), the AI stops queuing combat units once its army value
  reaches 1.5× its attack threshold and keeps the credits. Defence overrides this. (Before this rule a Normal RUSH AI hoarded ~60 units /
  12 000 credits of army by 4:30 and ended most AI-vs-AI matches in 5–7 minutes.)
- **Survival allies:** the wave attacker has no base, so allied AIs neither scout nor launch attacks; they build, capture points and defend.
  The wave attacker itself is not an AI Commander (see GAMEPLAY_SYSTEMS §5e).
- **Tutorial:** the enemy outpost has no AI Commander at all.

## 6d. v0.5

- The AI obeys the population cap like a player (it does not queue units that would exceed it).
- AI decision randomness is seeded from the match seed (`World.seed`); before v0.5 it depended on the player slot only, so every match
  against the AI played out identically when the player acted the same way.
- Known weakness found by simulation: Easy/Normal AIs do not pick counters (`counters: false`), so they handle massed helicopters poorly.
  The Iron Fist mission therefore teaches the player to build SAM Sites.

## 6e. v0.6

- Production only offers units available to the AI's faction; every personality favours its faction unit.
- Support units: at most 2 medics and 2 engineers, only with ≥ 6 combat units, picked occasionally (15%) so they never crowd out combat units.
- Defensive personalities (defenses ≥ 2) add a Missile Launcher after the Research Center; Hard/Insane build a Radar Station. Walls are never built
  by the AI (they could block its own paths).
- Domination uses the existing capture logic (Normal+ AIs contest every point).

## 6f. v0.7

- Researches its faction technology after the personality order; defensive personalities upgrade defenses / power plants when rich (cost + 800).
- Capture the Flag: a 4-unit raid squad (fastest ground units) goes for the enemy flag (public position), carriers run home without fighting,
  home units chase whoever took our flag.
- Transports and bunkers: see §6g (v0.8).

## 6g. v0.8 — transports, coordination, rush balance

- **APC mounting**: when an attack is launched, infantry within 12 tiles board the squad's APCs (the APCs wait up to 6 s, stragglers are
  released); loaded APCs unload when within 7 tiles of the target or of a visible enemy. Squad members riding inside are kept in the squad.
- **Drop raids** (Eagle / Shadow / Warlord, Normal+): one Transport Helicopter is produced once the army has ≥ 8 units; it loads 6 home
  infantry, flies to the nearest remembered enemy extractor / power plant, lands 3 tiles short, unloads (or earlier below 40% HP) and returns;
  the dropped troops become an attack squad.
- **Bunkers** (personalities with ≥ 2 defenses): one Bunker after the War Factory; the cheapest home infantry garrison it, but at least
  4 infantry always stay mobile.
- **Team coordination** through per-world team boards (no shared knowledge beyond the team's fog): an attack posts its target; allies with
  ≥ 50% of their own threshold join within 15 s. A base attacked by ≥ 3 enemies posts a help call; allies within 50 tiles send half of
  their idle home army (at most every 30 s).
- **Standing army** (rush balance): from minute 2 an AI whose army value is below `attackValue × clamp(tick / 9000, 0.35, 0.8)` or below
  80% of the largest enemy army it has seen (decaying estimate) only builds economy / production / defense, does not research or upgrade and
  keeps no reserve. Capture squads need ≥ 6 ground units at home (4 in Survival).
- **Rush** (`economyCap: 1`): one extractor and one strategic point; first attack at ≥ 0.75 × the difficulty's first-attack time; pre-attack
  army capped at 1.25 × threshold. Simulation (Rush vs the 4 other personalities × 3 maps × Normal/Hard × both sides = 48 matches):
  Rush wins 46 → 17, matches 8–23 min.
- **New units**: Fighter Jets only after enemy aircraft were seen; Eagle and Warlord build Bombers. The AI does not use the MCV.

## 6h. v0.10

- Builds its faction building after the War Factory (Desert Corps: two Oil Derricks).
- **Armor answer** (all difficulties): when the enemies attacking its base are armored, rockets / shells score up to +4 and rifles −2.
  (Found by the Survival regression test: a Normal AI kept training Rangers against a lone Heavy Tank and never finished the match.)
- **Smoke**: an attack squad with ≥ 2 wounded infantry within 9 tiles of a visible enemy defense throws smoke on them (every 15 s).
- **Forward base** (Hard / Insane, not Rush, after minute 10, ≥ 2 extractors, not under-defended): saves for and builds one Mobile
  Command Vehicle, drives it to the nearest unclaimed ore ≥ 20 tiles from home and ≥ 16 from known enemy buildings, deploys it, then saves
  for two extractors around the new HQ. Simulations: 4/4 matches opened a forward base (minutes 18–24) with 1–2 extractors.

## 6i. v0.11

- **Unit upgrades** (Normal and above, not while defending or under-defended): upgrades the armed unit type it has most of (≥ 4) when it
  has the upgrade cost + 600 spare, one at a time.
- Weather and darkness affect the AI exactly like the player (it only sees what its units see).

## 6j. v0.12

- Producers are built facing the map centre so units leave toward the front.
- High ground and destructible terrain apply to the AI like to the player; the AI does not yet seek hills on purpose.

## 6k. v0.13

- **High ground**: from Normal, once ≥ 6 armed ground units are home and the minimum army stands, up to 3 long-range units (artillery
  first, then longest range) hold the nearest hill cluster (≥ 3 tiles, within 36 tiles of the HQ). They are kept out of attack squads
  and walk back to their tile after chasing something off the hill.
- **Navy**: from Normal, after the War Factory, `navalMap()` checks once whether a shore site exists near the HQ whose sea is ≥ 300 tiles
  and comes within 16 tiles of an enemy spawn. If so it builds one Naval Yard (`findShoreSite`, facing the water; outside the producer
  limit) and keeps up to 5 ships (destroyers preferred). Ships join the home army and attack squads; orders on land targets bring them to
  the nearest water, where they bombard the coast. Dry maps never get a yard.

## 6l. v0.14

- **Amphibious raids** (`manageLanding`): one Landing Craft once two warships exist. It waits on the home beach; after the first-attack
  time, with a known enemy and ≥ 8 home ground units, it picks a beach 5–12 tiles from a known enemy building (economy first), loads the
  nearest home units (up to 20 s), sails, unloads them as a new squad with an attack-move on the target and returns. Below 40% HP it lands
  early. No reachable beach → no raid.
- Units that received a `board` order this decision are removed from the home army before an attack is launched.

## 6m. v0.15

- **Fleet** (`manageFleet`): armed ships leave the land army. Priority each decision: nearest visible enemy ship → coastal defence (enemy
  near our buildings with a beach within 8) → with ≥ 3 warships after the first-attack time, the water within 12 tiles of the remembered
  enemy building closest to the sea → back to the home bay. Orders are re-issued only when the goal moves > 3 tiles or ships are idle.
- **Production**: up to 6 warships; destroyers preferred, one patrol boat kept for sonar, submarines once enemy warships were seen
  (`seenShips`).

## 7. Acceptance criteria

- AI builds Power Plant, Extractor, Barracks, War Factory by itself.
- AI keeps power positive, produces units, defends when attacked, attacks once it knows the enemy base.
- Unit test: an AI vs AI headless match progresses (buildings and units are created; combat happens).
