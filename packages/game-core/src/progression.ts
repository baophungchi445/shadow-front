import type { Difficulty, FactionId, MapId, MissionType, UnitTypeId } from '@shadow-front/shared-types';
import { FACTIONS, UNITS } from '@shadow-front/game-data';

/** Units of one type: produced and enemies destroyed by them. */
export interface UnitRecord {
  built: number;
  kills: number;
}

/** Facts about one finished match from the local player's point of view. */
export interface MatchSummary {
  victory: boolean;
  mission: MissionType;
  mapId: MapId;
  mapName: string;
  faction: FactionId;
  durationSec: number;
  kills: number;
  unitsBuilt: number;
  unitsLost: number;
  creditsEarned: number;
  /** Hardest enemy AI difficulty in the match (null when there was none, e.g. survival). */
  enemyDifficulty: Difficulty | null;
  /** Survival: waves that entered / total. */
  waves: { reached: number; total: number } | null;
  campaignMission: string | null;
  /** True when every campaign mission is complete after this match. */
  campaignComplete: boolean;
  /** A unit of ours reached the Heroic rank during the match. */
  heroic: boolean;
  /** Per unit type (v0.11, optional for older callers). */
  units?: Partial<Record<UnitTypeId, UnitRecord>>;
}

export interface HistoryEntry {
  /** Epoch milliseconds. */
  at: number;
  victory: boolean;
  mission: MissionType;
  mapName: string;
  faction: FactionId;
  durationSec: number;
  kills: number;
  xp: number;
}

export interface ProfileStats {
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  unitsBuilt: number;
  unitsLost: number;
  creditsEarned: number;
  playTimeSec: number;
  /** Victories per faction. */
  factionWins: Partial<Record<FactionId, number>>;
}

export interface Profile {
  version: 1;
  nickname: string;
  /** Emblem: faction whose colour/name is shown with the profile. */
  emblem: FactionId;
  xp: number;
  stats: ProfileStats;
  /** Newest first, at most HISTORY_LIMIT entries. */
  history: HistoryEntry[];
  /** Achievement id → epoch ms when unlocked. */
  achievements: Record<string, number>;
  /** Displayed title id (see TITLES). */
  title: string;
  /** Daily / weekly challenge progress for the current period. */
  challenges: ChallengeState;
  /** Faction mastery: XP earned while playing each faction. */
  mastery: Partial<Record<FactionId, number>>;
  /** Unit mastery (v0.11): lifetime units produced / kills per unit type. */
  unitMastery: Partial<Record<UnitTypeId, UnitRecord>>;
  /** Avatar (v0.12): glyph drawn on a coloured badge. */
  avatar: { icon: AvatarIcon; color: number };
}

/** Avatar glyphs and badge colours offered in the Profile (v0.12). */
export const AVATAR_ICONS = [
  'star',
  'shield',
  'chevrons',
  'crosshair',
  'lightning',
  'tank',
  'skull',
  'eagle',
] as const;
export type AvatarIcon = (typeof AVATAR_ICONS)[number];
export const AVATAR_COLORS = [
  0x5a7a3a, 0x3f6ea8, 0xa8443a, 0xc49a2c, 0x6d4fa0, 0x2f8a83, 0x8a8b86, 0x2a2d33,
] as const;

// ------------------------------------------------------------------ faction mastery

/** Cumulative faction XP needed for mastery levels 1..10. */
export const MASTERY_THRESHOLDS = [300, 800, 1500, 2400, 3500, 5000, 7000, 9500, 12500, 16000];
export const MASTERY_MAX = MASTERY_THRESHOLDS.length;

/** Mastery level (0..10) and progress toward the next level for a faction's XP. */
export function masteryInfo(xp: number): { level: number; into: number; needed: number } {
  let level = 0;
  while (level < MASTERY_MAX && xp >= MASTERY_THRESHOLDS[level]) level++;
  if (level >= MASTERY_MAX) return { level, into: 1, needed: 1 };
  const base = level === 0 ? 0 : MASTERY_THRESHOLDS[level - 1];
  return { level, into: xp - base, needed: MASTERY_THRESHOLDS[level] - base };
}

/** Highest mastery level over all factions. */
export function bestMastery(p: Profile): number {
  return Math.max(0, ...Object.values(p.mastery).map((x) => masteryInfo(x ?? 0).level));
}

export interface ChallengeState {
  /** UTC day key 'YYYY-MM-DD' the daily progress belongs to. */
  day: string;
  /** UTC ISO week key 'YYYY-Www' the weekly progress belongs to. */
  week: string;
  /** Challenge id → progress. */
  progress: Record<string, number>;
  /** Challenge ids already completed (and rewarded) in the current period. */
  done: string[];
}

// ------------------------------------------------------------------ challenges

export interface Challenge {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  goal: number;
  /** XP reward when completed. */
  reward: number;
  /** Progress contributed by one match. */
  gain: (s: MatchSummary) => number;
}

const won = (s: MatchSummary) => (s.victory ? 1 : 0);

export const CHALLENGES: Challenge[] = [
  { id: 'd-win', period: 'daily', title: 'Win a match', goal: 1, reward: 150, gain: won },
  {
    id: 'd-kills',
    period: 'daily',
    title: 'Destroy 30 enemies',
    goal: 30,
    reward: 150,
    gain: (s) => s.kills,
  },
  {
    id: 'd-build',
    period: 'daily',
    title: 'Build 25 units',
    goal: 25,
    reward: 120,
    gain: (s) => s.unitsBuilt,
  },
  {
    id: 'd-play',
    period: 'daily',
    title: 'Play 20 minutes',
    goal: 20,
    reward: 120,
    gain: (s) => Math.floor(s.durationSec / 60),
  },
  {
    id: 'd-points',
    period: 'daily',
    title: 'Win a Domination or Capture the Flag match',
    goal: 1,
    reward: 200,
    gain: (s) => (s.victory && (s.mission === 'domination' || s.mission === 'ctf') ? 1 : 0),
  },
  {
    id: 'd-survival',
    period: 'daily',
    title: 'Survive 5 Survival waves',
    goal: 5,
    reward: 150,
    gain: (s) =>
      s.mission === 'survival' && s.waves ? Math.max(0, s.waves.reached - (s.victory ? 0 : 1)) : 0,
  },
  { id: 'w-wins', period: 'weekly', title: 'Win 5 matches', goal: 5, reward: 600, gain: won },
  {
    id: 'w-kills',
    period: 'weekly',
    title: 'Destroy 300 enemies',
    goal: 300,
    reward: 600,
    gain: (s) => s.kills,
  },
  {
    id: 'w-hard',
    period: 'weekly',
    title: 'Beat a Hard or Insane AI',
    goal: 1,
    reward: 800,
    gain: (s) => (s.victory && (s.enemyDifficulty === 'hard' || s.enemyDifficulty === 'insane') ? 1 : 0),
  },
  {
    id: 'w-play',
    period: 'weekly',
    title: 'Play 2 hours',
    goal: 120,
    reward: 500,
    gain: (s) => Math.floor(s.durationSec / 60),
  },
  {
    id: 'w-factions',
    period: 'weekly',
    title: 'Win with 3 different factions',
    goal: 3,
    reward: 700,
    // Counted specially in applyMatch (distinct factions); this is only a fallback.
    gain: () => 0,
  },
];

/** UTC day key. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** UTC ISO-8601 week key, e.g. '2026-W47'. */
export function weekKey(now: number): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  // The ISO week belongs to the year of its Thursday.
  const thursday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.ceil(((thursday - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The 3 challenges of a period, chosen deterministically from the period key. */
export function activeChallenges(period: 'daily' | 'weekly', key: string): Challenge[] {
  const pool = CHALLENGES.filter((c) => c.period === period);
  let h = hashString(`${period}:${key}`);
  const picked: Challenge[] = [];
  const rest = [...pool];
  while (picked.length < 3 && rest.length) {
    picked.push(rest.splice(h % rest.length, 1)[0]);
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  }
  return picked;
}

/** Challenge state for `now`, resetting daily / weekly progress when the period changed. */
export function currentChallenges(state: ChallengeState, now: number): ChallengeState {
  const day = dayKey(now);
  const week = weekKey(now);
  const keep = (id: string) =>
    CHALLENGES.find((c) => c.id === id)?.period === 'daily' ? state.day === day : state.week === week;
  return {
    day,
    week,
    progress: Object.fromEntries(Object.entries(state.progress).filter(([id]) => keep(id))),
    done: state.done.filter(keep),
  };
}

// ------------------------------------------------------------------ titles

// ------------------------------------------------------------------ unit mastery (v0.11)

/** Mastery points: 1 per unit produced, 2 per enemy destroyed. Cumulative points for levels 1..5. */
export const UNIT_MASTERY_THRESHOLDS = [10, 30, 75, 150, 300];
export const UNIT_MASTERY_MAX = UNIT_MASTERY_THRESHOLDS.length;

export function unitMasteryPoints(r: UnitRecord | undefined): number {
  return r ? r.built + 2 * r.kills : 0;
}

/** Unit mastery level (0..5) and progress toward the next level. */
export function unitMasteryInfo(r: UnitRecord | undefined): {
  level: number;
  points: number;
  into: number;
  needed: number;
} {
  const points = unitMasteryPoints(r);
  let level = 0;
  while (level < UNIT_MASTERY_MAX && points >= UNIT_MASTERY_THRESHOLDS[level]) level++;
  if (level >= UNIT_MASTERY_MAX) return { level, points, into: 1, needed: 1 };
  const base = level === 0 ? 0 : UNIT_MASTERY_THRESHOLDS[level - 1];
  return { level, points, into: points - base, needed: UNIT_MASTERY_THRESHOLDS[level] - base };
}

/** Highest unit mastery level over all unit types. */
export function bestUnitMastery(p: Profile): number {
  return Math.max(0, ...Object.values(p.unitMastery).map((r) => unitMasteryInfo(r).level));
}

export interface Title {
  id: string;
  name: string;
  requirement: string;
  unlocked: (p: Profile) => boolean;
}

export const TITLES: Title[] = [
  { id: 'recruit', name: 'Recruit', requirement: 'Default', unlocked: () => true },
  {
    id: 'lieutenant',
    name: 'Lieutenant',
    requirement: 'Reach level 5',
    unlocked: (p) => levelInfo(p.xp).level >= 5,
  },
  {
    id: 'captain',
    name: 'Captain',
    requirement: 'Reach level 10',
    unlocked: (p) => levelInfo(p.xp).level >= 10,
  },
  { id: 'major', name: 'Major', requirement: 'Reach level 20', unlocked: (p) => levelInfo(p.xp).level >= 20 },
  {
    id: 'colonel',
    name: 'Colonel',
    requirement: 'Reach level 35',
    unlocked: (p) => levelInfo(p.xp).level >= 35,
  },
  {
    id: 'general',
    name: 'General',
    requirement: 'Reach level 50',
    unlocked: (p) => levelInfo(p.xp).level >= 50,
  },
  {
    id: 'hero',
    name: 'Hero of the Front',
    requirement: 'Achievement: Hero of the Front',
    unlocked: (p) => 'heroic' in p.achievements,
  },
  {
    id: 'survivor',
    name: 'Survivor',
    requirement: 'Achievement: Last Stand',
    unlocked: (p) => 'last-stand' in p.achievements,
  },
  {
    id: 'strategist',
    name: 'Strategist',
    requirement: 'Achievement: Campaign Complete',
    unlocked: (p) => 'campaign' in p.achievements,
  },
  {
    id: 'warmaster',
    name: 'Warmaster',
    requirement: 'Achievement: Master of Arms',
    unlocked: (p) => 'all-factions' in p.achievements,
  },
  {
    id: 'specialist',
    name: 'Specialist',
    requirement: 'Faction mastery 5',
    unlocked: (p) => bestMastery(p) >= 5,
  },
  {
    id: 'grandmaster',
    name: 'Grandmaster',
    requirement: 'Faction mastery 10',
    unlocked: (p) => bestMastery(p) >= MASTERY_MAX,
  },
  {
    id: 'weapons-expert',
    name: 'Weapons Expert',
    requirement: 'Unit mastery 5',
    unlocked: (p) => bestUnitMastery(p) >= UNIT_MASTERY_MAX,
  },
];

export function titleName(p: Profile): string {
  const t = TITLES.find((x) => x.id === p.title);
  return t && t.unlocked(p) ? t.name : 'Recruit';
}

export const HISTORY_LIMIT = 20;

export function newProfile(nickname = 'Commander'): Profile {
  return {
    version: 1,
    nickname,
    emblem: 'western',
    xp: 0,
    stats: {
      matches: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      unitsBuilt: 0,
      unitsLost: 0,
      creditsEarned: 0,
      playTimeSec: 0,
      factionWins: {},
    },
    history: [],
    achievements: {},
    title: 'recruit',
    challenges: { day: '', week: '', progress: {}, done: [] },
    mastery: {},
    unitMastery: {},
    avatar: { icon: 'star', color: AVATAR_COLORS[0] },
  };
}

const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 1, normal: 1.25, hard: 1.6, insane: 2 };

/** XP for one match: participation + victory bonus + combat + time, scaled by enemy difficulty. */
export function xpForMatch(s: MatchSummary): number {
  const minutes = Math.min(60, s.durationSec / 60);
  const base = 100 + (s.victory ? 250 : 0) + s.kills * 3 + s.unitsBuilt + minutes * 10;
  const mul = s.enemyDifficulty ? DIFFICULTY_XP[s.enemyDifficulty] : 1;
  return Math.round(base * mul);
}

/** Level n → n+1 costs 500 + 250·(n−1) XP. */
export function levelInfo(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  for (;;) {
    const needed = 500 + 250 * (level - 1);
    if (rest < needed) return { level, into: rest, needed };
    rest -= needed;
    level++;
  }
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Evaluated after the match has been added to the profile. */
  check: (p: Profile, s: MatchSummary) => boolean;
}

const DIFF_RANK: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2, insane: 3 };
const atLeast = (s: MatchSummary, d: Difficulty) =>
  s.enemyDifficulty !== null && DIFF_RANK[s.enemyDifficulty] >= DIFF_RANK[d];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    title: 'First Blood',
    description: 'Destroy your first enemy.',
    check: (p) => p.stats.kills >= 1,
  },
  {
    id: 'first-victory',
    title: 'First Victory',
    description: 'Win a match.',
    check: (p) => p.stats.wins >= 1,
  },
  {
    id: 'veteran-commander',
    title: 'Veteran Commander',
    description: 'Win 10 matches.',
    check: (p) => p.stats.wins >= 10,
  },
  {
    id: 'hard-target',
    title: 'Hard Target',
    description: 'Win against a Hard AI.',
    check: (_p, s) => s.victory && atLeast(s, 'hard'),
  },
  {
    id: 'insane-victory',
    title: 'Beyond Insane',
    description: 'Win against an Insane AI.',
    check: (_p, s) => s.victory && atLeast(s, 'insane'),
  },
  {
    id: 'blitz',
    title: 'Blitzkrieg',
    description: 'Win a skirmish in under 10 minutes.',
    check: (_p, s) => s.victory && s.durationSec < 600 && !s.campaignMission && s.mission !== 'survival',
  },
  {
    id: 'last-stand',
    title: 'Last Stand',
    description: 'Survive 10 or more Survival waves.',
    check: (_p, s) => s.victory && s.mission === 'survival' && (s.waves?.total ?? 0) >= 10,
  },
  {
    id: 'dominator',
    title: 'Dominator',
    description: 'Win a Domination match.',
    check: (_p, s) => s.victory && s.mission === 'domination',
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Win on a random map.',
    check: (_p, s) => s.victory && s.mapId === 'random',
  },
  {
    id: 'heroic',
    title: 'Hero of the Front',
    description: 'Promote a unit to Heroic rank.',
    check: (_p, s) => s.heroic,
  },
  {
    id: 'centurion',
    title: 'Centurion',
    description: 'Destroy 100 enemies in total.',
    check: (p) => p.stats.kills >= 100,
  },
  {
    id: 'campaign',
    title: 'Campaign Complete',
    description: 'Complete every campaign mission.',
    check: (_p, s) => s.campaignComplete,
  },
  {
    id: 'all-factions',
    title: 'Master of Arms',
    description: 'Win with all five factions.',
    check: (p) => Object.values(p.stats.factionWins).filter((n) => (n ?? 0) > 0).length >= 5,
  },
];

export interface MatchProgress {
  profile: Profile;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: Achievement[];
  /** Challenges completed by this match (their reward XP is included in xpGained). */
  completed: Challenge[];
  /** Titles that became available with this match. */
  newTitles: Title[];
  /** Mastery of the faction played: level before / after and XP gained. */
  mastery: { faction: FactionId; xp: number; levelBefore: number; levelAfter: number };
  /** Unit types whose mastery level went up in this match. */
  unitLevelUps: { type: UnitTypeId; levelBefore: number; levelAfter: number }[];
}

/** Returns the profile updated with one match (the input is not modified). */
export function applyMatch(prev: Profile, s: MatchSummary, now: number): MatchProgress {
  const matchXp = xpForMatch(s);
  // Daily / weekly challenges.
  const ch = currentChallenges(prev.challenges, now);
  const active = [...activeChallenges('daily', ch.day), ...activeChallenges('weekly', ch.week)];
  const progress = { ...ch.progress };
  const completed: Challenge[] = [];
  const recentFactions = new Set(
    [{ at: now, victory: s.victory, faction: s.faction }, ...prev.history]
      .filter((h) => h.victory && weekKey(h.at) === ch.week)
      .map((h) => h.faction),
  );
  for (const c of active) {
    if (ch.done.includes(c.id)) continue;
    progress[c.id] = c.id === 'w-factions' ? recentFactions.size : (progress[c.id] ?? 0) + c.gain(s);
    if (progress[c.id] >= c.goal) completed.push(c);
  }
  const xpGained = matchXp + completed.reduce((sum, c) => sum + c.reward, 0);
  const st = prev.stats;
  const factionWins = { ...st.factionWins };
  if (s.victory) factionWins[s.faction] = (factionWins[s.faction] ?? 0) + 1;
  const profile: Profile = {
    ...prev,
    xp: prev.xp + xpGained,
    stats: {
      matches: st.matches + 1,
      wins: st.wins + (s.victory ? 1 : 0),
      losses: st.losses + (s.victory ? 0 : 1),
      kills: st.kills + s.kills,
      unitsBuilt: st.unitsBuilt + s.unitsBuilt,
      unitsLost: st.unitsLost + s.unitsLost,
      creditsEarned: st.creditsEarned + Math.round(s.creditsEarned),
      playTimeSec: st.playTimeSec + s.durationSec,
      factionWins,
    },
    history: [
      {
        at: now,
        victory: s.victory,
        mission: s.mission,
        mapName: s.mapName,
        faction: s.faction,
        durationSec: s.durationSec,
        kills: s.kills,
        xp: xpGained,
      },
      ...prev.history,
    ].slice(0, HISTORY_LIMIT),
    achievements: { ...prev.achievements },
    challenges: { ...ch, progress, done: [...ch.done, ...completed.map((c) => c.id)] },
    // Mastery grows with the match XP (challenge rewards are not faction-specific).
    mastery: { ...prev.mastery, [s.faction]: (prev.mastery[s.faction] ?? 0) + matchXp },
    unitMastery: { ...prev.unitMastery },
  };
  const unitLevelUps: MatchProgress['unitLevelUps'] = [];
  for (const [type, r] of Object.entries(s.units ?? {}) as [UnitTypeId, UnitRecord][]) {
    if (!(type in UNITS) || !r) continue;
    const before = prev.unitMastery[type];
    const after = { built: (before?.built ?? 0) + r.built, kills: (before?.kills ?? 0) + r.kills };
    profile.unitMastery[type] = after;
    const lb = unitMasteryInfo(before).level;
    const la = unitMasteryInfo(after).level;
    if (la > lb) unitLevelUps.push({ type, levelBefore: lb, levelAfter: la });
  }
  const unlocked = ACHIEVEMENTS.filter((a) => !(a.id in profile.achievements) && a.check(profile, s));
  for (const a of unlocked) profile.achievements[a.id] = now;
  const newTitles = TITLES.filter((t) => t.unlocked(profile) && !t.unlocked(prev));
  return {
    profile,
    xpGained,
    levelBefore: levelInfo(prev.xp).level,
    levelAfter: levelInfo(profile.xp).level,
    unlocked,
    completed,
    newTitles,
    mastery: {
      faction: s.faction,
      xp: matchXp,
      levelBefore: masteryInfo(prev.mastery[s.faction] ?? 0).level,
      levelAfter: masteryInfo(profile.mastery[s.faction] ?? 0).level,
    },
    unitLevelUps,
  };
}

/** Accepts unknown stored data; returns a valid profile (fresh one when the data is unusable). */
export function sanitizeProfile(raw: unknown): Profile {
  const fresh = newProfile();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<Profile>;
  if (r.version !== 1 || typeof r.xp !== 'number' || !r.stats || typeof r.stats !== 'object') return fresh;
  return {
    ...fresh,
    ...r,
    nickname:
      typeof r.nickname === 'string' && r.nickname.trim() ? r.nickname.trim().slice(0, 20) : fresh.nickname,
    stats: { ...fresh.stats, ...r.stats, factionWins: { ...(r.stats.factionWins ?? {}) } },
    history: Array.isArray(r.history) ? r.history.slice(0, HISTORY_LIMIT) : [],
    achievements: r.achievements && typeof r.achievements === 'object' ? { ...r.achievements } : {},
    title: typeof r.title === 'string' ? r.title : 'recruit',
    challenges:
      r.challenges && typeof r.challenges === 'object' && Array.isArray(r.challenges.done)
        ? { ...fresh.challenges, ...r.challenges, progress: { ...(r.challenges.progress ?? {}) } }
        : fresh.challenges,
    mastery: sanitizeMastery(r.mastery, Array.isArray(r.history) ? r.history : []),
    unitMastery: sanitizeUnitMastery(r.unitMastery),
    avatar:
      r.avatar &&
      typeof r.avatar === 'object' &&
      (AVATAR_ICONS as readonly string[]).includes(r.avatar.icon) &&
      (AVATAR_COLORS as readonly number[]).includes(r.avatar.color)
        ? { icon: r.avatar.icon, color: r.avatar.color }
        : fresh.avatar,
  };
}

/** Valid unit mastery map (unknown units / bad numbers dropped; missing before v0.11). */
function sanitizeUnitMastery(raw: unknown): Partial<Record<UnitTypeId, UnitRecord>> {
  const out: Partial<Record<UnitTypeId, UnitRecord>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in UNITS) || !v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    if (ok(r.built) && ok(r.kills)) out[k as UnitTypeId] = { built: r.built, kills: r.kills };
  }
  return out;
}

/** Valid mastery map; profiles from before v0.8 get it rebuilt from their match history. */
function sanitizeMastery(raw: unknown, history: HistoryEntry[]): Partial<Record<FactionId, number>> {
  const out: Partial<Record<FactionId, number>> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>))
      if (k in FACTIONS && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k as FactionId] = v;
    return out;
  }
  for (const h of history)
    if (h && h.faction in FACTIONS && typeof h.xp === 'number') out[h.faction] = (out[h.faction] ?? 0) + h.xp;
  return out;
}
