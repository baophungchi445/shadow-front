import type {
  BuildingTypeId,
  Difficulty,
  Personality,
  ResearchId,
  UnitTypeId,
} from '@shadow-front/shared-types';

export interface DifficultyProfile {
  /** Ticks between AI decisions. */
  thinkInterval: number;
  /** Extra ticks the AI waits between build orders (slower expansion on Easy). */
  buildDelay: number;
  /** Army value (credits) required before launching an attack. */
  attackValue: number;
  /** Earliest tick for the first attack (gives the player time to build up). */
  firstAttackTick: number;
  /** Minimum ticks between two attack waves. */
  attackCooldown: number;
  /** Max simultaneous production buildings it will use. */
  maxProducers: number;
  /** Hard+ adapt unit choices to what they have seen. */
  counters: boolean;
  /** Hard+ retreat badly damaged squads. */
  retreats: boolean;
  /** Insane splits the army into two attack groups. */
  multiProng: boolean;
  /** Max extractors the AI builds. */
  maxExtractors: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: {
    thinkInterval: 40,
    buildDelay: 400,
    attackValue: 6000,
    firstAttackTick: 10800, // 9 min
    attackCooldown: 2400,
    maxProducers: 1,
    counters: false,
    retreats: false,
    multiProng: false,
    maxExtractors: 1,
  },
  normal: {
    thinkInterval: 20,
    buildDelay: 120,
    attackValue: 5000,
    firstAttackTick: 8400, // 7 min
    attackCooldown: 1800,
    maxProducers: 2,
    counters: false,
    retreats: false,
    multiProng: false,
    maxExtractors: 2,
  },
  hard: {
    thinkInterval: 10,
    buildDelay: 40,
    attackValue: 4500,
    firstAttackTick: 6000, // 5 min
    attackCooldown: 1200,
    maxProducers: 3,
    counters: true,
    retreats: true,
    multiProng: false,
    maxExtractors: 3,
  },
  insane: {
    thinkInterval: 5,
    buildDelay: 0,
    attackValue: 4500,
    firstAttackTick: 4200, // 3.5 min
    attackCooldown: 900,
    maxProducers: 4,
    counters: true,
    retreats: true,
    multiProng: true,
    maxExtractors: 4,
  },
};

export interface PersonalityProfile {
  name: string;
  description: string;
  buildOrder: BuildingTypeId[];
  unitWeights: Partial<Record<UnitTypeId, number>>;
  /** Multiplier on DIFFICULTY.attackValue. */
  aggression: number;
  /** Number of defensive structures to aim for. */
  defenses: number;
  /** Optional cap on extractors and held strategic points (Rush trades economy for early pressure). */
  economyCap?: number;
  /** Technologies in the order this commander researches them. */
  researchOrder: ResearchId[];
}

export const PERSONALITIES: Record<Personality, PersonalityProfile> = {
  rush: {
    name: 'RUSH',
    description: 'Aggressive. Early attacks with fast production.',
    buildOrder: ['power-plant', 'barracks', 'resource-extractor', 'war-factory', 'power-plant'],
    unitWeights: { rifleman: 3, 'at-soldier': 2, 'recon-vehicle': 3, apc: 2, 'main-battle-tank': 2 },
    aggression: 0.55,
    defenses: 0,
    economyCap: 1,
    researchOrder: ['improved-munitions', 'efficient-extraction', 'composite-armor', 'advanced-optics'],
  },
  fortress: {
    name: 'FORTRESS',
    description: 'Defensive. Strong base and late counter-attacks.',
    buildOrder: [
      'power-plant',
      'resource-extractor',
      'barracks',
      'defense-turret',
      'war-factory',
      'power-plant',
      'research-center',
      'sam-site',
    ],
    unitWeights: {
      'at-soldier': 1,
      'main-battle-tank': 3,
      'heavy-tank': 4,
      'mobile-artillery': 3,
      'missile-system': 2,
    },
    aggression: 1.6,
    defenses: 4,
    researchOrder: ['composite-armor', 'efficient-extraction', 'improved-munitions', 'advanced-optics'],
  },
  eagle: {
    name: 'EAGLE',
    description: 'Air force and reconnaissance.',
    buildOrder: [
      'power-plant',
      'resource-extractor',
      'barracks',
      'war-factory',
      'power-plant',
      'airfield',
      'sam-site',
    ],
    unitWeights: {
      rifleman: 1,
      'attack-helicopter': 5,
      bomber: 2,
      'fighter-jet': 2,
      'recon-drone': 1,
      'main-battle-tank': 1,
      'at-soldier': 1,
    },
    aggression: 1,
    defenses: 1,
    researchOrder: ['advanced-optics', 'improved-munitions', 'efficient-extraction', 'composite-armor'],
  },
  shadow: {
    name: 'SHADOW',
    description: 'Intelligence and fast raids.',
    buildOrder: ['power-plant', 'resource-extractor', 'barracks', 'war-factory', 'airfield'],
    unitWeights: { 'recon-vehicle': 4, 'at-soldier': 2, 'recon-drone': 1, 'attack-helicopter': 2 },
    aggression: 0.8,
    defenses: 1,
    researchOrder: ['advanced-optics', 'improved-munitions', 'composite-armor', 'efficient-extraction'],
  },
  warlord: {
    name: 'WARLORD',
    description: 'Balanced army, large-scale attacks.',
    buildOrder: [
      'power-plant',
      'resource-extractor',
      'barracks',
      'war-factory',
      'power-plant',
      'resource-extractor',
      'research-center',
      'airfield',
    ],
    unitWeights: {
      rifleman: 2,
      'at-soldier': 2,
      apc: 1,
      'main-battle-tank': 3,
      'heavy-tank': 2,
      'mobile-artillery': 1,
      'attack-helicopter': 1,
      bomber: 1,
    },
    aggression: 1.3,
    defenses: 2,
    researchOrder: ['efficient-extraction', 'improved-munitions', 'composite-armor', 'advanced-optics'],
  },
};
