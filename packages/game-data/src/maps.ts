import type { MapDef, MapId, MapSpawn, TileKind } from '@shadow-front/shared-types';
import { mulberry32 } from './rng';
import { parseTiledMap, type TiledMap } from './tiled';
import riverCrossingJson from './maps/river-crossing.json';
import highlandPassJson from './maps/highland-pass.json';
import snowfieldJson from './maps/snowfield.json';
import forestWarfareJson from './maps/forest-warfare.json';
import islandConflictJson from './maps/island-conflict.json';
import industrialZoneJson from './maps/industrial-zone.json';

/**
 * Maps come from two sources that produce the same `MapDef`:
 * - deterministic layout scripts (Desert Storm, Urban Conflict, below);
 * - Tiled JSON files in `./maps/` imported with `parseTiledMap` (River Crossing, Highland Pass).
 */
class MapBuilder {
  readonly tiles: TileKind[];
  constructor(
    readonly width: number,
    readonly height: number,
    base: TileKind,
  ) {
    this.tiles = new Array<TileKind>(width * height).fill(base);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  set(x: number, y: number, kind: TileKind): void {
    if (this.inside(x, y)) this.tiles[y * this.width + x] = kind;
  }
  get(x: number, y: number): TileKind | undefined {
    return this.inside(x, y) ? this.tiles[y * this.width + x] : undefined;
  }
  rect(x: number, y: number, w: number, h: number, kind: TileKind): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, kind);
  }
  /** Noisy disc. */
  blob(cx: number, cy: number, r: number, kind: TileKind, rnd: () => number, roughness = 0.35): void {
    const R = Math.ceil(r + 1);
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const d = Math.hypot(i, j);
        if (d <= r + (rnd() - 0.5) * roughness * 2) this.set(cx + i, cy + j, kind);
      }
  }
  /** Thick line (Bresenham-ish sampling). */
  line(x0: number, y0: number, x1: number, y1: number, kind: TileKind, thickness = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      const half = Math.floor(thickness / 2);
      this.rect(x - half, y - half, thickness, thickness, kind);
    }
  }
  /** High ground (v0.12): turns open ground (not ore, roads, concrete or obstacles) inside a noisy disc into hill. */
  hill(cx: number, cy: number, r: number, rnd: () => number): void {
    const R = Math.ceil(r + 1);
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const k = this.get(cx + i, cy + j);
        if (!k || TILE_BLOCKED[k] || k === 'ore' || k === 'road' || k === 'concrete') continue;
        if (Math.hypot(i, j) <= r + (rnd() - 0.5) * 0.6) this.set(cx + i, cy + j, 'hill');
      }
  }
  clearCircle(cx: number, cy: number, r: number, kind: TileKind): void {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) this.set(cx + i, cy + j, kind);
  }
}

const SIZE = 64;
const SPAWNS: MapSpawn[] = [
  { tx: 6, ty: 6 },
  { tx: 55, ty: 55 },
  { tx: 55, ty: 6 },
  { tx: 6, ty: 55 },
];
const spawnCenter = (s: MapSpawn) => ({ x: s.tx + 1, y: s.ty + 1 });

function buildDesertStorm(): MapDef {
  const rnd = mulberry32(1337);
  const b = new MapBuilder(SIZE, SIZE, 'sand');

  // Rock ridges with gaps (high ground / chokepoints).
  b.line(18, 14, 27, 23, 'rock', 2);
  b.line(36, 40, 45, 49, 'rock', 2);
  b.line(40, 14, 46, 20, 'rock', 2);
  b.line(17, 43, 23, 49, 'rock', 2);
  b.line(28, 30, 30, 34, 'rock', 1);
  b.line(34, 29, 36, 33, 'rock', 1);
  for (let k = 0; k < 16; k++) {
    b.blob(Math.floor(rnd() * SIZE), Math.floor(rnd() * SIZE), 1 + rnd() * 1.5, 'rock', rnd);
  }
  // Oasis.
  b.blob(14, 30, 2.2, 'water', rnd, 0.2);
  b.blob(50, 34, 2.2, 'water', rnd, 0.2);
  b.blob(14, 30, 3.4, 'grass', rnd, 0.2);
  b.blob(14, 30, 2.2, 'water', rnd, 0.2);
  b.blob(50, 34, 3.4, 'grass', rnd, 0.2);
  b.blob(50, 34, 2.2, 'water', rnd, 0.2);

  // Base zones.
  for (const s of SPAWNS) {
    const c = spawnCenter(s);
    b.clearCircle(c.x, c.y, 9, 'sand');
  }
  // Supply roads from every base to the centre.
  for (const s of SPAWNS) {
    const c = spawnCenter(s);
    b.line(c.x, c.y, 32, 32, 'road', 2);
  }
  // Concrete pads under HQs.
  for (const s of SPAWNS) b.rect(s.tx - 1, s.ty - 1, 5, 5, 'concrete');
  // High ground overlooking the centre (v0.12), mirrored.
  const hills = mulberry32(4242);
  b.hill(23, 31, 2.6, hills);
  b.hill(41, 33, 2.6, hills);

  // Ore: one field next to each base, contested fields in the middle and edges.
  const homeOre = [
    { x: 15, y: 9 },
    { x: 48, y: 54 },
    { x: 48, y: 9 },
    { x: 15, y: 54 },
  ];
  for (const o of homeOre) b.blob(o.x, o.y, 2.2, 'ore', rnd, 0.25);
  b.blob(32, 32, 2.6, 'ore', rnd, 0.25);
  b.blob(32, 8, 2, 'ore', rnd, 0.25);
  b.blob(32, 56, 2, 'ore', rnd, 0.25);
  b.blob(8, 32, 2, 'ore', rnd, 0.25);
  b.blob(56, 32, 2, 'ore', rnd, 0.25);

  return {
    id: 'desert-storm',
    name: 'Desert Storm',
    description: 'Open desert with rocky ridges and rich ore fields. Tank battles and territorial control.',
    width: SIZE,
    height: SIZE,
    tiles: b.tiles,
    oreAmount: 1200,
    spawns: SPAWNS,
    strategicPoints: [
      { x: 32, y: 32, name: 'Central Field' },
      { x: 32, y: 8, name: 'North Ridge' },
      { x: 32, y: 56, name: 'South Ridge' },
    ],
  };
}

function buildUrbanConflict(): MapDef {
  const rnd = mulberry32(4242);
  const b = new MapBuilder(SIZE, SIZE, 'concrete');
  const STEP = 8;

  // Street grid: 2-tile roads every 8 tiles; city blocks in between.
  for (let k = 0; k < SIZE; k += STEP) {
    b.rect(k, 0, 2, SIZE, 'road');
    b.rect(0, k, SIZE, 2, 'road');
  }
  for (let by = 0; by < SIZE / STEP; by++) {
    for (let bx = 0; bx < SIZE / STEP; bx++) {
      const x = bx * STEP + 2;
      const y = by * STEP + 2;
      const r = rnd();
      if (r < 0.6) {
        // High-rise / industrial buildings with an alley.
        b.rect(x, y, 6, 6, 'urban');
        if (rnd() < 0.5) b.rect(x + 2 + Math.floor(rnd() * 2), y, 1, 6, 'concrete');
        else b.rect(x, y + 2 + Math.floor(rnd() * 2), 6, 1, 'concrete');
      } else if (r < 0.78) {
        b.rect(x, y, 6, 6, 'grass');
        b.set(x + 1, y + 1, 'rock');
        b.set(x + 4, y + 3, 'rock');
      } else {
        b.rect(x + 1, y + 1, 2, 2, 'urban');
      }
    }
  }
  for (const s of SPAWNS) {
    const c = spawnCenter(s);
    b.clearCircle(c.x, c.y, 9, 'concrete');
  }
  // Industrial ore lots.
  const ore = [
    { x: 15, y: 10 },
    { x: 48, y: 53 },
    { x: 48, y: 10 },
    { x: 15, y: 53 },
    { x: 32, y: 32 },
    { x: 24, y: 40 },
    { x: 40, y: 24 },
  ];
  for (const o of ore) b.blob(o.x, o.y, 1.8, 'ore', rnd, 0.2);
  // Canal segments with road bridges.
  b.line(0, 30, 22, 30, 'water', 2);
  b.line(42, 33, 63, 33, 'water', 2);
  b.rect(8, 29, 2, 3, 'road');
  b.rect(16, 29, 2, 3, 'road');
  b.rect(48, 32, 2, 3, 'road');
  b.rect(56, 32, 2, 3, 'road');

  return {
    id: 'urban-conflict',
    name: 'Urban Conflict',
    description:
      'Dense modern city with narrow streets, parks and industrial ore lots. Infantry and ambushes.',
    width: SIZE,
    height: SIZE,
    tiles: b.tiles,
    oreAmount: 1500,
    spawns: SPAWNS,
    strategicPoints: [
      { x: 32, y: 32, name: 'City Center' },
      { x: 24, y: 40, name: 'Industrial South' },
      { x: 40, y: 24, name: 'Industrial North' },
    ],
  };
}

// ------------------------------------------------------------------ random maps

const THEMES: { base: TileKind; patch: TileKind; block: TileKind; name: string }[] = [
  { base: 'sand', patch: 'grass', block: 'rock', name: 'Dunes' },
  { base: 'grass', patch: 'sand', block: 'rock', name: 'Valley' },
  { base: 'concrete', patch: 'grass', block: 'urban', name: 'Outskirts' },
];

/** Ground connectivity: every spawn and strategic point reachable from spawn 0, and ore near every base. */
export function mapIsPlayable(m: MapDef): boolean {
  const seen = new Uint8Array(m.width * m.height);
  const start = m.spawns[0];
  const q = [start.ty * m.width + start.tx];
  seen[q[0]] = 1;
  while (q.length) {
    const cur = q.pop()!;
    const x = cur % m.width;
    const y = (cur / m.width) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      const ni = ny * m.width + nx;
      if (seen[ni] || TILE_BLOCKED[m.tiles[ni]]) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  const reach = (x: number, y: number) => seen[y * m.width + x] === 1;
  if (!m.spawns.every((s) => reach(s.tx, s.ty)) || !m.strategicPoints.every((p) => reach(p.x, p.y)))
    return false;
  return m.spawns.every((s) => {
    let ore = 0;
    for (let j = -12; j <= 12; j++)
      for (let i = -12; i <= 12; i++) if (m.tiles[(s.ty + j) * m.width + s.tx + i] === 'ore') ore++;
    return ore > 4;
  });
}

function randomCandidate(seed: number): MapDef {
  const rnd = mulberry32(seed);
  const theme = THEMES[Math.floor(rnd() * THEMES.length)];
  const b = new MapBuilder(SIZE, SIZE, theme.base);
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

  // Features are drawn on the northern half; the southern half is its 180° rotation (fair for every spawn pair).
  for (let k = 0; k < 6; k++) b.blob(ri(0, 63), ri(0, 31), 2 + rnd() * 3, theme.patch, rnd, 0.6);
  for (let k = 0, n = ri(8, 16); k < n; k++)
    b.blob(ri(2, 61), ri(10, 31), 0.8 + rnd() * 1.7, theme.block, rnd, 0.4);
  for (let k = 0, n = ri(0, 2); k < n; k++)
    b.blob(ri(14, 50), ri(14, 30), 1.5 + rnd() * 1.5, 'water', rnd, 0.3);
  for (let k = 0, n = ri(1, 3); k < n; k++) {
    const x = ri(14, 50);
    const y = ri(12, 28);
    b.line(x, y, x + ri(-6, 6), y + ri(3, 7), theme.block, 2);
  }
  for (const s of SPAWNS.slice(0, 1).concat(SPAWNS[2])) b.clearCircle(s.tx + 1, s.ty + 1, 9, theme.base);
  b.line(7, 7, 31, 31, 'road', 2);
  b.line(56, 7, 32, 31, 'road', 2);
  // Ore: one home field per northern base (mirrored to the southern ones) and contested fields.
  b.blob(15, 9, 2.2, 'ore', rnd, 0.25);
  b.blob(48, 9, 2.2, 'ore', rnd, 0.25);
  for (let k = 0, n = ri(2, 3); k < n; k++)
    b.blob(ri(8, 56), ri(16, 28), 1.6 + rnd() * 0.6, 'ore', rnd, 0.25);
  for (const s of SPAWNS) b.rect(s.tx - 1, s.ty - 1, 5, 5, 'concrete');
  // High ground (v0.12): its own random stream so older seeds keep their layout otherwise.
  const hr = mulberry32(seed ^ 0x5f3759df);
  for (let k = 0, n = 1 + Math.floor(hr() * 2); k < n; k++)
    b.hill(14 + Math.floor(hr() * 37), 16 + Math.floor(hr() * 12), 1.8 + hr() * 1.2, hr);

  for (let y = SIZE / 2; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) b.tiles[y * SIZE + x] = b.tiles[(SIZE - 1 - y) * SIZE + (SIZE - 1 - x)];

  // Strategic points: the centre plus a mirrored pair, each on cleared ground.
  const px = ri(12, 51);
  const py = ri(14, 22);
  const points = [
    { x: 31, y: 31, name: 'Centre' },
    { x: px, y: py, name: 'North Outpost' },
    { x: SIZE - 1 - px, y: SIZE - 1 - py, name: 'South Outpost' },
  ];
  for (const p of points) {
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++)
        if (TILE_BLOCKED[b.get(p.x + i, p.y + j) ?? 'sand']) b.set(p.x + i, p.y + j, theme.base);
  }
  return {
    id: 'random',
    name: `Random ${theme.name} #${seed % 10000}`,
    description: `Randomly generated ${theme.name.toLowerCase()} battlefield (seed ${seed}). Mirrored for fairness.`,
    width: SIZE,
    height: SIZE,
    tiles: b.tiles,
    oreAmount: 1300,
    spawns: SPAWNS,
    strategicPoints: points,
  };
}

/** Deterministic random map for `seed`; candidates that fail `mapIsPlayable` are re-rolled. */
export function generateRandomMap(seed: number): MapDef {
  const s0 = Math.abs(Math.floor(seed)) || 1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const m = randomCandidate(s0 + attempt * 7919);
    if (mapIsPlayable(m)) return { ...m, name: `Random ${m.name.split(' ')[1]} #${s0 % 10000}` };
  }
  return getMap('desert-storm');
}

const randomCache = new Map<number, MapDef>();

const cache = new Map<MapId, MapDef>();
const builders: Record<Exclude<MapId, 'custom'>, () => MapDef> = {
  random: () => generateRandomMap(1),
  'desert-storm': buildDesertStorm,
  'urban-conflict': buildUrbanConflict,
  'river-crossing': () => parseTiledMap(riverCrossingJson as TiledMap, 'river-crossing'),
  'highland-pass': () => parseTiledMap(highlandPassJson as TiledMap, 'highland-pass'),
  snowfield: () => parseTiledMap(snowfieldJson as TiledMap, 'snowfield'),
  'forest-warfare': () => parseTiledMap(forestWarfareJson as TiledMap, 'forest-warfare'),
  'island-conflict': () => parseTiledMap(islandConflictJson as TiledMap, 'island-conflict'),
  'industrial-zone': () => parseTiledMap(industrialZoneJson as TiledMap, 'industrial-zone'),
};

/** Map by id. For `random`, `mapSeed` selects the generated map. */
export function getMap(id: MapId, mapSeed?: number): MapDef {
  if (id === 'custom') throw new Error('Custom maps are passed in MatchConfig.customMap');
  if (id === 'random' && mapSeed !== undefined) {
    let r = randomCache.get(mapSeed);
    if (!r) {
      r = generateRandomMap(mapSeed);
      randomCache.set(mapSeed, r);
    }
    return r;
  }
  let m = cache.get(id);
  if (!m) {
    m = builders[id]();
    cache.set(id, m);
  }
  return m;
}

export const MAP_IDS = Object.keys(builders) as Exclude<MapId, 'custom'>[];

export const TILE_BLOCKED: Record<TileKind, boolean> = {
  sand: false,
  grass: false,
  road: false,
  concrete: false,
  ore: false,
  rock: true,
  water: true,
  urban: true,
  snow: false,
  forest: true,
  hill: false,
};
