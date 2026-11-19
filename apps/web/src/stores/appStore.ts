import { create } from 'zustand';
import type { MatchConfig } from '@shadow-front/shared-types';
import type { MatchResult } from '../game/GameController';
import { DEFAULT_KEYS, sanitizeKeys, type HotkeyAction } from '../game/keybinds';
import {
  CAMPAIGN,
  applyMatch,
  newProfile,
  sanitizeProfile,
  type Achievement,
  type Profile,
} from '@shadow-front/game-core';

export type Screen =
  'menu' | 'skirmish' | 'campaign' | 'profile' | 'army' | 'settings' | 'multiplayer' | 'game' | 'results';

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
  /** Fewer particles and no scorch marks (for slow machines). */
  performanceMode: boolean;
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
    performanceMode: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Partial<Settings>;
    return { ...defaults, ...stored, keybinds: sanitizeKeys(stored.keybinds) };
  } catch {
    return defaults;
  }
}

const CAMPAIGN_KEY = 'shadow-front.campaign';
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
  lastProgress: LastProgress | null;
  updateProfile: (patch: Partial<Pick<Profile, 'nickname' | 'emblem' | 'title'>>) => void;
  resetProfile: () => void;
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
  lastProgress: null,
  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch };
    saveProfile(profile);
    set({ profile });
  },
  resetProfile: () => {
    const profile = newProfile(get().profile.nickname);
    saveProfile(profile);
    set({ profile });
  },
  go: (screen) => set({ screen }),
  startMatch: (match) => set({ match, result: null, screen: 'game' }),
  finishMatch: (result) => {
    let completedMissions = get().completedMissions;
    if (result.victory && result.campaignMission && !completedMissions.includes(result.campaignMission)) {
      completedMissions = [...completedMissions, result.campaignMission];
      saveCampaign(completedMissions);
    }
    const campaignComplete = CAMPAIGN.every((m) => completedMissions.includes(m.id));
    const progress = applyMatch(get().profile, { ...result.summary, campaignComplete }, Date.now());
    saveProfile(progress.profile);
    set({
      completedMissions,
      profile: progress.profile,
      lastProgress: {
        xpGained: progress.xpGained,
        levelBefore: progress.levelBefore,
        levelAfter: progress.levelAfter,
        unlocked: progress.unlocked.map(({ id, title, description }) => ({ id, title, description })),
        challenges: progress.completed.map(({ title, reward, period }) => ({ title, reward, period })),
        newTitles: progress.newTitles.map((t) => t.name),
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
