import type { MapDef, TileKind } from '@shadow-front/shared-types';
import { TILE_BLOCKED, mapIsPlayable } from './maps';

/** Tile kinds in a fixed order: the index is the character code used to store a custom map compactly. */
export const TILE_KINDS: TileKind[] = [
  'sand',
  'grass',
  'road',
  'rock',
  'water',
  'urban',
  'ore',
  'concrete',
  'snow',
  'forest',
  'hill',
];

export const CUSTOM_MAP_SIZES = [48, 64, 80] as const;
export const CUSTOM_MAP_MIN = 32;
export const CUSTOM_MAP_MAX = 96;
export const CUSTOM_ORE_AMOUNT = 1300;

/** Storage character for a TILE_KINDS index: digits 0–9, then letters a, b, … (old maps only use digits). */
function tileChar(i: number): string {
  return i < 10 ? String(i) : String.fromCharCode(97 + i - 10);
}

function tileIndex(c: string): number {
  if (c >= '0' && c <= '9') return Number(c);
  const i = c.charCodeAt(0) - 97 + 10;
  return i >= 10 && i < TILE_KINDS.length ? i : 0;
}

/** Stored form of a player-made map (localStorage). */
export interface StoredMap {
  name: string;
  width: number;
  height: number;
  /** One character per tile: TILE_KINDS index as a digit (then a letter from index 10). */
  tiles: string;
  spawns: { tx: number; ty: number }[];
  points: { x: number; y: number; name: string }[];
}

export function encodeTiles(tiles: TileKind[]): string {
  return tiles.map((t) => tileChar(Math.max(0, TILE_KINDS.indexOf(t)))).join('');
}

export function decodeTiles(s: string): TileKind[] {
  return [...s].map((c) => TILE_KINDS[tileIndex(c)] ?? 'sand');
}

/** A blank map: open sand with a ring of rock at the edge. */
export function blankMap(name: string, size: number): StoredMap {
  const tiles: TileKind[] = new Array<TileKind>(size * size).fill('sand');
  return { name, width: size, height: size, tiles: encodeTiles(tiles), spawns: [], points: [] };
}

/** Turns a stored map into a playable MapDef (no validation; see `customMapErrors`). */
export function toMapDef(m: StoredMap): MapDef {
  return {
    id: 'custom',
    name: m.name.trim() || 'Custom map',
    description: `Custom map · ${m.spawns.length} spawns · ${m.points.length} strategic points`,
    width: m.width,
    height: m.height,
    tiles: decodeTiles(m.tiles),
    oreAmount: CUSTOM_ORE_AMOUNT,
    spawns: m.spawns.map((s) => ({ tx: s.tx, ty: s.ty })),
    strategicPoints: m.points.map((p) => ({ ...p })),
  };
}

/**
 * Reasons a map cannot be played (empty = playable): size, 2–4 spawns each with a free 3×3 HQ footprint not overlapping
 * another spawn, strategic points on open ground, every base and point reachable on foot, ore near every base.
 */
export function customMapErrors(m: MapDef): string[] {
  const errors: string[] = [];
  const { width: w, height: h } = m;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < CUSTOM_MAP_MIN ||
    h < CUSTOM_MAP_MIN ||
    w > CUSTOM_MAP_MAX ||
    h > CUSTOM_MAP_MAX
  )
    return [`Map size must be between ${CUSTOM_MAP_MIN} and ${CUSTOM_MAP_MAX} tiles`];
  if (m.tiles.length !== w * h) return ['Map data is damaged'];
  if (m.spawns.length < 2) errors.push('Place at least 2 spawns');
  if (m.spawns.length > 4) errors.push('At most 4 spawns');
  const tile = (x: number, y: number) => m.tiles[y * w + x];
  m.spawns.forEach((s, i) => {
    let ok = s.tx >= 1 && s.ty >= 1 && s.tx + 3 <= w - 1 && s.ty + 3 <= h - 1;
    for (let y = s.ty; ok && y < s.ty + 3; y++)
      for (let x = s.tx; ok && x < s.tx + 3; x++) ok = !TILE_BLOCKED[tile(x, y)] && tile(x, y) !== 'ore';
    if (!ok) errors.push(`Spawn ${i + 1} needs a free 3×3 area of open ground (no ore, not at the edge)`);
    m.spawns.forEach((o, j) => {
      if (j > i && Math.abs(o.tx - s.tx) < 8 && Math.abs(o.ty - s.ty) < 8)
        errors.push(`Spawns ${i + 1} and ${j + 1} are too close`);
    });
  });
  m.strategicPoints.forEach((p, i) => {
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h || TILE_BLOCKED[tile(p.x, p.y)])
      errors.push(`Strategic point ${i + 1} must be on open ground`);
  });
  if (m.strategicPoints.length > 8) errors.push('At most 8 strategic points');
  if (!errors.length && !mapIsPlayable(m))
    errors.push(
      'Every base and point must be reachable on foot, with ore (5+ tiles) within 12 tiles of each base',
    );
  return errors;
}
