/** Rebindable in-game hotkeys (KeyboardEvent.code values). */
export type HotkeyAction =
  | 'attackMove'
  | 'patrol'
  | 'unload'
  | 'stop'
  | 'hold'
  | 'retreat'
  | 'selectArmy'
  | 'formation'
  | 'smoke'
  | 'alert'
  | 'pause';

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  'attackMove',
  'patrol',
  'stop',
  'hold',
  'retreat',
  'selectArmy',
  'formation',
  'smoke',
  'unload',
  'alert',
  'pause',
];

export const DEFAULT_KEYS: Record<HotkeyAction, string> = {
  attackMove: 'KeyF',
  patrol: 'KeyT',
  unload: 'KeyU',
  stop: 'KeyX',
  hold: 'KeyG',
  retreat: 'KeyR',
  selectArmy: 'KeyQ',
  formation: 'KeyB',
  smoke: 'KeyZ',
  alert: 'Space',
  pause: 'KeyP',
};

export const ACTION_LABELS: Record<HotkeyAction, string> = {
  attackMove: 'Attack-move (then click)',
  patrol: 'Patrol (then click)',
  unload: 'Unload transports / bunkers, deploy MCV',
  stop: 'Stop',
  hold: 'Hold position',
  retreat: 'Retreat',
  selectArmy: 'Select whole army',
  formation: 'Next formation (spread / line / column / wedge)',
  smoke: 'Smoke grenade (then click)',
  alert: 'Jump to latest alert, then base',
  pause: 'Pause menu (F10 always works)',
};

/** Keys with a fixed meaning that cannot be assigned to an action. */
export const RESERVED_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Escape',
  'Minus',
  'Equal',
  'NumpadAdd',
  'NumpadSubtract',
  'F10',
  'Tab',
  ...Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`),
]);

/** Human-readable label for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

/** Returns the action bound to `code`, if any. */
export function actionFor(binds: Record<HotkeyAction, string>, code: string): HotkeyAction | null {
  return HOTKEY_ACTIONS.find((a) => binds[a] === code) ?? null;
}

/**
 * Assigns `code` to `action`. If another action already uses the key, the two swap keys so every action
 * keeps a binding. Reserved keys are rejected (returns null).
 */
export function rebind(
  binds: Record<HotkeyAction, string>,
  action: HotkeyAction,
  code: string,
): Record<HotkeyAction, string> | null {
  if (RESERVED_KEYS.has(code)) return null;
  const next = { ...binds };
  const other = actionFor(binds, code);
  if (other && other !== action) next[other] = binds[action];
  next[action] = code;
  return next;
}

/** Fills missing / invalid entries of stored bindings with defaults. */
export function sanitizeKeys(raw: unknown): Record<HotkeyAction, string> {
  const out = { ...DEFAULT_KEYS };
  if (raw && typeof raw === 'object')
    for (const a of HOTKEY_ACTIONS) {
      const v = (raw as Record<string, unknown>)[a];
      if (typeof v === 'string' && v && !RESERVED_KEYS.has(v)) out[a] = v;
    }
  return out;
}
