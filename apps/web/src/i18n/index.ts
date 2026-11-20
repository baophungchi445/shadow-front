import { useCallback } from 'react';
import { useApp } from '../stores/appStore';
import { VI, VI_PATTERNS } from './vi';

/**
 * UI language. English strings are the translation keys: a missing translation simply shows the English text.
 * Game data names (units, buildings, factions, maps, campaign briefings) stay in English.
 */
export type Language = 'en' | 'vi';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
];

export type Params = Record<string, string | number>;

function fill(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translates a fixed UI string (with optional `{name}` placeholders). */
export function translate(lang: Language, s: string, params?: Params): string {
  if (lang === 'vi') return fill(VI[s] ?? s, params);
  return fill(s, params);
}

/**
 * Translates a runtime message (toasts, command failures from the simulation): exact phrases first, then
 * patterns with captured names / numbers. Unknown messages stay in English.
 */
export function translateMessage(lang: Language, s: string): string {
  if (lang !== 'vi') return s;
  const exact = VI[s];
  if (exact) return exact;
  for (const [re, out] of VI_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    // Captured names (units, buildings, technologies, lists "A, B") are translated too.
    return out.replace(/\$(\d)/g, (_, i: string) =>
      (m[Number(i)] ?? '')
        .split(', ')
        .map((part) => VI[part] ?? part)
        .join(', '),
    );
  }
  return s;
}

/** React hook: `t('Play')`, `t('Level {n}', { n: 3 })`, `t.msg(runtimeMessage)`. */
export function useT() {
  const lang = useApp((st) => st.settings.language);
  const t = useCallback((s: string, params?: Params) => translate(lang, s, params), [lang]);
  return Object.assign(t, { msg: (s: string) => translateMessage(lang, s), lang });
}
