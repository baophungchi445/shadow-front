import { create } from 'zustand';
import type { MatchConfig } from '@shadow-front/shared-types';
import type { MatchResult } from '../game/GameController';

export type Screen = 'menu' | 'skirmish' | 'army' | 'settings' | 'multiplayer' | 'game' | 'results';

export interface Settings {
  edgeScroll: boolean;
  scrollSpeed: number;
  showFps: boolean;
  /** Master sound volume 0..1. */
  volume: number;
}

const SETTINGS_KEY = 'shadow-front.settings';

function loadSettings(): Settings {
  const defaults: Settings = { edgeScroll: true, scrollSpeed: 1, showFps: false, volume: 0.6 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) } : defaults;
  } catch {
    return defaults;
  }
}

interface AppState {
  screen: Screen;
  match: MatchConfig | null;
  result: MatchResult | null;
  settings: Settings;
  go: (screen: Screen) => void;
  startMatch: (match: MatchConfig) => void;
  finishMatch: (result: MatchResult) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'menu',
  match: null,
  result: null,
  settings: loadSettings(),
  go: (screen) => set({ screen }),
  startMatch: (match) => set({ match, result: null, screen: 'game' }),
  finishMatch: (result) => set({ result, screen: 'results' }),
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
