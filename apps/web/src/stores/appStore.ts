import { create } from 'zustand';
import { FACTIONS, UNITS } from '@shadow-front/game-data';
import type { MatchConfig } from '@shadow-front/shared-types';
import type { MatchResult } from '../game/GameController';
import type { Formation } from '@shadow-front/shared-types';
import { DEFAULT_KEYS, sanitizeKeys, type HotkeyAction } from '../game/keybinds';
import { FORMATIONS } from '../game/formations';
import { GRAPHICS_QUALITIES, type GraphicsQuality } from '../game/render/quality';
import {
  CAMPAIGN,
  applyMatch,
  newProfile,
  sanitizeProfile,
  type Achievement,
  type Profile,
} from '@shadow-front/game-core';
import type { Language } from '../i18n';
import {
  NO_HABITS,
  rememberedStyles,
  sanitizeHabits,
  updateHabits,
  type Habits,
} from '@shadow-front/game-ai';

export type Screen =
  | 'menu'
  | 'skirmish'
  | 'campaign'
  | 'profile'
  | 'army'
  | 'settings'
  | 'multiplayer'
  | 'editor'
  | 'game'
  | 'results';

export interface Settings {
  edgeScroll: boolean;
  scrollSpeed: number;
  showFps: boolean;
  /** Sound effects volume 0..1. */
  volume: number;
  /** Background music volume 0..1. */
  musicVolume: number;
  /** Rebindable hotkeys (KeyboardEvent.code). */
  keybinds: Record<HotkeyAction, string>;
  /** Effects detail: low = few particles, no scorch marks, no anti-aliasing (slow machines). */
  graphicsQuality: GraphicsQuality;
  /** Mouse-wheel zoom step multiplier (0.5 – 2). */
  zoomSpeed: number;
  /** Middle-drag panning multiplier (0.5 – 2). */
  panSensitivity: number;
  /** Formation used for group move orders. */
  formation: Formation;
  /** UI language. */
  language: Language;
  /** v0.17.2: Hard / Insane AI remembers the player's habits between skirmishes. */
  aiMemory: boolean;
}

const SETTINGS_KEY = 'shadow-front.settings';

function loadSettings(): Settings {
  const defaults: Settings = {
    edgeScroll: true,
    scrollSpeed: 1,
    showFps: false,
    volume: 0.6,
    musicVolume: 0.35,
    keybinds: { ...DEFAULT_KEYS },
    graphicsQuality: 'high',
    zoomSpeed: 1,
    panSensitivity: 1,
    formation: 'spread',
    language: 'en',
    aiMemory: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Partial<Settings> & { performanceMode?: boolean };
    // v0.7 stored a "performance mode" checkbox: it maps to low quality.
    const quality = GRAPHICS_QUALITIES.includes(stored.graphicsQuality as GraphicsQuality)
      ? (stored.graphicsQuality as GraphicsQuality)
      : stored.performanceMode
        ? 'low'
        : defaults.graphicsQuality;
    const clamp = (v: unknown, d: number) => (typeof v === 'number' && v >= 0.5 && v <= 2 ? v : d);
    delete stored.performanceMode;
    return {
      ...defaults,
      ...stored,
      graphicsQuality: quality,
      zoomSpeed: clamp(stored.zoomSpeed, 1),
      panSensitivity: clamp(stored.panSensitivity, 1),
      language: stored.language === 'vi' ? 'vi' : 'en',
      aiMemory: stored.aiMemory !== false,
      keybinds: sanitizeKeys(stored.keybinds),
      formation: FORMATIONS.includes(stored.formation as Formation)
        ? (stored.formation as Formation)
        : 'spread',
    };
  } catch {
    return defaults;
  }
}

const CAMPAIGN_KEY = 'shadow-front.campaign';
const HABITS_KEY = 'shadow-front.habits';

/** v0.17.2: the player's play-style habits as the AI remembers them (per browser). */
export function loadHabits(): Habits {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? sanitizeHabits(JSON.parse(raw)) : { ...NO_HABITS };
  } catch {
    return { ...NO_HABITS };
  }
}

function saveHabits(h: Habits): void {
  try {
    localStorage.setItem(HABITS_KEY, JSON.stringify(h));
  } catch {
    // Storage unavailable — the memory only lasts for this session.
  }
}
const PROFILE_KEY = 'shadow-front.profile';

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : newProfile();
  } catch {
    return newProfile();
  }
}

function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable — progress only lasts for this session.
  }
}

/** What the last match added to the profile (shown on the results screen). */
export interface LastProgress {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: Pick<Achievement, 'id' | 'title' | 'description'>[];
  /** Daily / weekly challenges completed by the match. */
  challenges: { title: string; reward: number; period: 'daily' | 'weekly' }[];
  newTitles: string[];
  /** Mastery of the faction played (faction display name). */
  mastery: { faction: string; xp: number; levelBefore: number; levelAfter: number };
  /** Unit types whose mastery level went up (unit display name). */
  unitLevelUps: { name: string; level: number }[];
}

/** Completed campaign mission ids (per browser). */
function loadCampaign(): string[] {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface AppState {
  screen: Screen;
  match: MatchConfig | null;
  result: MatchResult | null;
  settings: Settings;
  completedMissions: string[];
  profile: Profile;
  /** v0.17.2: the player's habits as the AI remembers them. */
  habits: Habits;
  lastProgress: LastProgress | null;
  updateProfile: (patch: Partial<Pick<Profile, 'nickname' | 'emblem' | 'title' | 'avatar'>>) => void;
  resetProfile: () => void;
  /** v0.17.2: clears the remembered habits. */
  forgetHabits: () => void;
  go: (screen: Screen) => void;
  startMatch: (match: MatchConfig) => void;
  finishMatch: (result: MatchResult) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

function saveCampaign(ids: string[]): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable — progress only lasts for this session.
  }
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'menu',
  match: null,
  result: null,
  settings: loadSettings(),
  completedMissions: loadCampaign(),
  profile: loadProfile(),
  habits: loadHabits(),
  lastProgress: null,
  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch };
    saveProfile(profile);
    set({ profile });
  },
  resetProfile: () => {
    const profile = newProfile(get().profile.nickname);
    saveProfile(profile);
    saveHabits({ ...NO_HABITS });
    set({ profile, habits: { ...NO_HABITS } });
  },
  forgetHabits: () => {
    saveHabits({ ...NO_HABITS });
    set({ habits: { ...NO_HABITS } });
  },
  go: (screen) => set({ screen }),
  startMatch: (match) => {
    // v0.17.2: skirmishes carry the remembered habits (campaign missions are scripted and stay as designed).
    const remembered = rememberedStyles(get().habits);
    const withMemory: MatchConfig =
      get().settings.aiMemory && !match.campaignMission && remembered.length
        ? { ...match, aiMemory: remembered }
        : { ...match, aiMemory: undefined };
    set({ match: withMemory, result: null, screen: 'game' });
  },
  finishMatch: (result) => {
    let completedMissions = get().completedMissions;
    if (result.victory && result.campaignMission && !completedMissions.includes(result.campaignMission)) {
      completedMissions = [...completedMissions, result.campaignMission];
      saveCampaign(completedMissions);
    }
    const campaignComplete = CAMPAIGN.every((m) => completedMissions.includes(m.id));
    const progress = applyMatch(get().profile, { ...result.summary, campaignComplete }, Date.now());
    saveProfile(progress.profile);
    let habits = get().habits;
    if (result.detectedStyles && !result.campaignMission) {
      habits = updateHabits(habits, result.detectedStyles);
      saveHabits(habits);
    }
    set({
      habits,
      completedMissions,
      profile: progress.profile,
      lastProgress: {
        xpGained: progress.xpGained,
        levelBefore: progress.levelBefore,
        levelAfter: progress.levelAfter,
        unlocked: progress.unlocked.map(({ id, title, description }) => ({ id, title, description })),
        challenges: progress.completed.map(({ title, reward, period }) => ({ title, reward, period })),
        newTitles: progress.newTitles.map((t) => t.name),
        mastery: { ...progress.mastery, faction: FACTIONS[progress.mastery.faction].name },
        unitLevelUps: (progress.unitLevelUps ?? []).map((u) => ({
          name: UNITS[u.type].name,
          level: u.levelAfter,
        })),
      },
      result,
      screen: 'results',
    });
  },
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode) — settings still apply for this session.
    }
    set({ settings });
  },
}));
