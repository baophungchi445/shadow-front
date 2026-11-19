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

## 7. Acceptance criteria

- AI builds Power Plant, Extractor, Barracks, War Factory by itself.
- AI keeps power positive, produces units, defends when attacked, attacks once it knows the enemy base.
- Unit test: an AI vs AI headless match progresses (buildings and units are created; combat happens).
