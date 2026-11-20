import {
  CUSTOM_MAP_MAX,
  CUSTOM_MAP_MIN,
  TILE_KINDS,
  type StoredMap,
} from '@shadow-front/game-data';

const MAPS_KEY = 'shadow-front.maps';
export const MAX_CUSTOM_MAPS = 20;

function valid(m: unknown): m is StoredMap {
  if (!m || typeof m !== 'object') return false;
  const r = m as StoredMap;
  return (
    typeof r.name === 'string' &&
    Number.isInteger(r.width) &&
    Number.isInteger(r.height) &&
    r.width >= CUSTOM_MAP_MIN &&
    r.height >= CUSTOM_MAP_MIN &&
    r.width <= CUSTOM_MAP_MAX &&
    r.height <= CUSTOM_MAP_MAX &&
    typeof r.tiles === 'string' &&
    r.tiles.length === r.width * r.height &&
    [...r.tiles].every((c) => Number(c) < TILE_KINDS.length) &&
    Array.isArray(r.spawns) &&
    r.spawns.every((s) => Number.isInteger(s?.tx) && Number.isInteger(s?.ty)) &&
    Array.isArray(r.points) &&
    r.points.every((p) => Number.isInteger(p?.x) && Number.isInteger(p?.y) && typeof p?.name === 'string')
  );
}

/** Player-made maps saved in this browser (damaged entries are skipped). */
export function loadCustomMaps(): StoredMap[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MAPS_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(valid).slice(0, MAX_CUSTOM_MAPS) : [];
  } catch {
    return [];
  }
}

export function saveCustomMaps(maps: StoredMap[]): boolean {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps.slice(0, MAX_CUSTOM_MAPS)));
    return true;
  } catch {
    return false;
  }
}

/** Saves (or replaces by name) one map; returns the new list. */
export function upsertCustomMap(map: StoredMap): StoredMap[] {
  const list = loadCustomMaps().filter((m) => m.name !== map.name);
  const next = [map, ...list].slice(0, MAX_CUSTOM_MAPS);
  saveCustomMaps(next);
  return next;
}

export function deleteCustomMap(name: string): StoredMap[] {
  const next = loadCustomMaps().filter((m) => m.name !== name);
  saveCustomMaps(next);
  return next;
}
