/** Numeric entity id, unique inside one World. */
export type EntityId = number;
/** Player slot index inside a match (0..9). */
export type PlayerId = number;
/** Alliance index. Players with the same team share vision and never fight. */
export type TeamId = number;

export type FactionId = 'western' | 'eastern' | 'pacific' | 'desert' | 'iron';

export type UnitTypeId =
  | 'rifleman'
  | 'at-soldier'
  | 'recon-vehicle'
  | 'apc'
  | 'main-battle-tank'
  | 'heavy-tank'
  | 'mobile-artillery'
  | 'attack-helicopter'
  | 'recon-drone';

export type BuildingTypeId =
  | 'headquarters'
  | 'power-plant'
  | 'resource-extractor'
  | 'barracks'
  | 'war-factory'
  | 'airfield'
  | 'research-center'
  | 'defense-turret'
  | 'sam-site';

export type ResearchId =
  'composite-armor' | 'improved-munitions' | 'advanced-optics' | 'efficient-extraction';

export type MapId = 'desert-storm' | 'urban-conflict' | 'river-crossing';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';
export type Personality = 'rush' | 'fortress' | 'eagle' | 'shadow' | 'warlord';
/**
 * annihilation / decapitation: skirmish victory conditions.
 * survival: hold out against escalating enemy waves (offline only).
 * tutorial: guided objectives against a passive AI (offline only).
 */
export type MissionType = 'annihilation' | 'decapitation' | 'survival' | 'tutorial';
