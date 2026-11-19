import type { MapDef, MapId, MapSpawn, TileKind } from '@shadow-front/shared-types';
import { mulberry32 } from './rng';
import { parseTiledMap, type TiledMap } from './tiled';
import riverCrossingJson from './maps/river-crossing.json';

/**
 * Maps come from two sources that produce the same `MapDef`:
 * - deterministic layout scripts (Desert Storm, Urban Conflict, below);
 * - Tiled JSON files in `./maps/` imported with `parseTiledMap` (River Crossing).
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

const cache = new Map<MapId, MapDef>();
const builders: Record<MapId, () => MapDef> = {
  'desert-storm': buildDesertStorm,
  'urban-conflict': buildUrbanConflict,
  'river-crossing': () => parseTiledMap(riverCrossingJson as TiledMap, 'river-crossing'),
};

export function getMap(id: MapId): MapDef {
  let m = cache.get(id);
  if (!m) {
    m = builders[id]();
    cache.set(id, m);
  }
  return m;
}

export const MAP_IDS = Object.keys(builders) as MapId[];

export const TILE_BLOCKED: Record<TileKind, boolean> = {
  sand: false,
  grass: false,
  road: false,
  concrete: false,
  ore: false,
  rock: true,
  water: true,
  urban: true,
};
