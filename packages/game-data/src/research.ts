import type { FactionId, ResearchDef, ResearchId } from '@shadow-front/shared-types';

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
  // ------------------------------------------------ faction technologies (v0.7)
  'combat-medkits': {
    id: 'combat-medkits',
    name: 'Combat Medkits',
    cost: 1000,
    time: 500,
    description: 'Western Alliance: infantry gain +25% max HP.',
    faction: 'western',
  },
  'reactive-armor': {
    id: 'reactive-armor',
    name: 'Reactive Armor',
    cost: 1400,
    time: 600,
    description: 'Eastern Legion: heavy-armored units take 15% less damage.',
    faction: 'eastern',
  },
  'nano-repair': {
    id: 'nano-repair',
    name: 'Nano Repair',
    cost: 1400,
    time: 600,
    description: 'Pacific Technology: vehicles and aircraft regenerate 0.5% HP per second.',
    faction: 'pacific',
  },
  'turbo-engines': {
    id: 'turbo-engines',
    name: 'Turbo Engines',
    cost: 1000,
    time: 500,
    description: 'Desert Corps: vehicles and artillery move 15% faster.',
    faction: 'desert',
  },
  'fortified-structures': {
    id: 'fortified-structures',
    name: 'Fortified Structures',
    cost: 1200,
    time: 550,
    description: 'Iron Republic: all buildings gain +25% max HP.',
    faction: 'iron',
  },
};

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

/** Numeric effect of each technology (multipliers). */
export const RESEARCH_EFFECTS = {
  vehicleHp: 1.2,
  damage: 1.15,
  vision: 1.25,
  extraction: 1.3,
  infantryHp: 1.25,
  reactiveArmor: 0.85,
  /** Fraction of max HP regenerated per second. */
  nanoRepair: 0.005,
  vehicleSpeed: 1.15,
  buildingHp: 1.25,
} as const;

/** True when a commander of `faction` may research `id`. */
export function researchAvailableTo(id: ResearchId, faction: FactionId): boolean {
  const f = RESEARCH[id].faction;
  return !f || f === faction;
}
