import { create } from 'zustand';
import type { HudSnapshot } from '../game/hudModel';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'alert';
}

interface HudState {
  hud: HudSnapshot | null;
  toasts: Toast[];
  menuOpen: boolean;
  setHud: (hud: HudSnapshot) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dropToast: (id: number) => void;
  setMenuOpen: (open: boolean) => void;
  reset: () => void;
}

let nextToast = 1;

/** HUD state is pushed from the GameController at ~10 Hz (never every frame). */
export const useHud = create<HudState>((set, get) => ({
  hud: null,
  toasts: [],
  menuOpen: false,
  setHud: (hud) => set({ hud }),
  pushToast: (t) => {
    const recent = get().toasts;
    // De-duplicate identical messages that are already on screen.
    if (recent.some((r) => r.text === t.text)) return;
    const toast = { ...t, id: nextToast++ };
    set({ toasts: [...recent.slice(-3), toast] });
    setTimeout(() => get().dropToast(toast.id), t.tone === 'alert' ? 4000 : 2600);
  },
  dropToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  reset: () => set({ hud: null, toasts: [], menuOpen: false }),
}));
