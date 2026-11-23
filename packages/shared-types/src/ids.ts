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
  | 'recon-drone'
  // v0.6 support / specialist infantry
  | 'sniper'
  | 'medic'
  | 'engineer'
  // v0.6 faction-specific units
  | 'ranger'
  | 'rocket-launcher'
  | 'gunship'
  | 'light-tank'
  | 'ifv'
  // v0.7
  | 'transport-helicopter'
  // v0.8
  | 'fighter-jet'
  | 'bomber'
  | 'mcv'
  // v0.9
  | 'missile-system'
  // v0.13 naval
  | 'patrol-boat'
  | 'destroyer'
  // v0.14
  | 'landing-craft'
  // v0.15
  | 'submarine';

export type BuildingTypeId =
  | 'headquarters'
  | 'power-plant'
  | 'resource-extractor'
  | 'barracks'
  | 'war-factory'
  | 'airfield'
  | 'research-center'
  | 'defense-turret'
  | 'sam-site'
  // v0.6
  | 'radar-station'
  | 'wall'
  | 'missile-launcher'
  // v0.7
  | 'bunker'
  // v0.10 faction buildings
  | 'field-hospital'
  | 'howitzer'
  | 'repair-bay'
  | 'oil-derrick'
  | 'bastion'
  // v0.13 naval
  | 'naval-yard';

export type ResearchId =
  | 'composite-armor'
  | 'improved-munitions'
  | 'advanced-optics'
  | 'efficient-extraction'
  // v0.7 faction technologies
  | 'combat-medkits'
  | 'reactive-armor'
  | 'nano-repair'
  | 'turbo-engines'
  | 'fortified-structures';

/** `random` maps are generated from `MatchConfig.mapSeed`. */
export type MapId =
  | 'desert-storm'
  | 'urban-conflict'
  | 'river-crossing'
  | 'highland-pass'
  | 'snowfield'
  | 'forest-warfare'
  | 'island-conflict'
  | 'industrial-zone'
  | 'coastal-front'
  | 'strait-crossing'
  | 'random'
  /** Player-made map passed in MatchConfig.customMap. */
  | 'custom';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'insane';
export type Personality = 'rush' | 'fortress' | 'eagle' | 'shadow' | 'warlord';
/**
 * v0.17: a tactical change an AI commander made after learning from the match.
 * - patience: its attack failed badly → it gathers a bigger army before the next one
 * - switch-target: two attacks failed at the same place → it strikes elsewhere
 * - press: its attack succeeded → it attacks again sooner
 * - anti-rush / siege / anti-air / anti-naval: answers to the opponent's play style
 */
export type AiTactic = 'patience' | 'switch-target' | 'press' | 'anti-rush' | 'siege' | 'anti-air' | 'anti-naval';
/** v0.17: an opponent's play style as an AI commander reads it. */
export type PlayStyle = 'rush' | 'turtle' | 'air' | 'naval';
/**
 * annihilation / decapitation: skirmish victory conditions.
 * survival: hold out against escalating enemy waves (offline only).
 * tutorial: guided objectives against a passive AI (offline only).
 * domination: strategic points score over time; the first team to the target score wins.
 * ctf: capture the flag — bring the enemy flag to your own flag stand; first to the target captures wins.
 */
export type MissionType = 'annihilation' | 'decapitation' | 'survival' | 'tutorial' | 'domination' | 'ctf';
