import type { FactionDef, FactionId } from '@shadow-front/shared-types';

/**
 * MVP factions share the roster and differ by balanced +/- modifiers (master doc §2.2).
 * No faction may be strictly stronger: every bonus is paired with a drawback.
 */
export const FACTIONS: Record<FactionId, FactionDef> = {
  western: {
    id: 'western',
    name: 'Western Alliance',
    style: 'Balanced Warfare',
    color: 0x3d7bd9,
    modifiers: { unitHp: 1.05, buildingHp: 1, speed: 1, vehicleSpeed: 1, damage: {}, vision: 1, airCost: 1 },
  },
  eastern: {
    id: 'eastern',
    name: 'Eastern Legion',
    style: 'Heavy Firepower',
    color: 0xd23c3c,
    modifiers: {
      unitHp: 1,
      buildingHp: 1,
      speed: 1,
      vehicleSpeed: 0.9,
      damage: { armored: 1.15, artillery: 1.15 },
      vision: 1,
      airCost: 1.05,
    },
  },
  pacific: {
    id: 'pacific',
    name: 'Pacific Technology',
    style: 'Advanced Technology',
    color: 0x27b5a8,
    modifiers: {
      unitHp: 0.95,
      buildingHp: 1,
      speed: 1,
      vehicleSpeed: 1,
      damage: {},
      vision: 1.25,
      airCost: 0.9,
    },
  },
  desert: {
    id: 'desert',
    name: 'Desert Corps',
    style: 'Rapid Assault',
    color: 0xe0a030,
    modifiers: {
      unitHp: 0.9,
      buildingHp: 1,
      speed: 1.05,
      vehicleSpeed: 1.2,
      damage: {},
      vision: 1,
      airCost: 1,
    },
  },
  iron: {
    id: 'iron',
    name: 'Iron Republic',
    style: 'Defensive Warfare',
    color: 0x8a8f98,
    modifiers: {
      unitHp: 1,
      buildingHp: 1.3,
      speed: 0.95,
      vehicleSpeed: 0.95,
      damage: { defense: 1.2 },
      vision: 1,
      airCost: 1.05,
    },
  },
};

export const FACTION_IDS = Object.keys(FACTIONS) as FactionId[];

/** Distinct team colours used when two players pick the same faction. */
export const PLAYER_COLORS = [0x3d7bd9, 0xd23c3c, 0x27b5a8, 0xe0a030, 0x9b59d0, 0x5fbf4a, 0xe06fa8, 0xdddddd];
