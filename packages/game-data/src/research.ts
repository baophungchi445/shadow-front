import type { ResearchDef, ResearchId } from '@shadow-front/shared-types';

/** Technologies researched at the Research Center. Effects are applied by game-core (see RESEARCH_EFFECTS). */
export const RESEARCH: Record<ResearchId, ResearchDef> = {
  'composite-armor': {
    id: 'composite-armor',
    name: 'Composite Armor',
    cost: 1200,
    time: 600,
    description: 'Vehicles and artillery gain +20% max HP.',
  },
  'improved-munitions': {
    id: 'improved-munitions',
    name: 'Improved Munitions',
    cost: 1500,
    time: 700,
    description: 'All units and defenses deal +15% damage.',
  },
  'advanced-optics': {
    id: 'advanced-optics',
    name: 'Advanced Optics',
    cost: 800,
    time: 400,
    description: 'Units gain +25% vision radius.',
  },
  'efficient-extraction': {
    id: 'efficient-extraction',
    name: 'Efficient Extraction',
    cost: 1000,
    time: 500,
    description: 'Resource Extractors produce +30% credits.',
  },
};

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

/** Numeric effect of each technology (multipliers). */
export const RESEARCH_EFFECTS = {
  vehicleHp: 1.2,
  damage: 1.15,
  vision: 1.25,
  extraction: 1.3,
} as const;
