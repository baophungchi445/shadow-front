import { describe, expect, it } from 'vitest';
import type { TileKind } from '@shadow-front/shared-types';
import {
  TILE_KINDS,
  blankMap,
  customMapErrors,
  navalInfo,
  decodeTiles,
  encodeTiles,
  toMapDef,
  type StoredMap,
} from './customMap';
import { getMap } from './maps';

/** A simple playable 48×48 duel map: two spawns in opposite corners, ore next to each, one central point. */
function duel(): StoredMap {
  const m = blankMap('Duel', 48);
  const tiles = decodeTiles(m.tiles);
  const set = (x: number, y: number, k: TileKind) => (tiles[y * 48 + x] = k);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      set(10 + i, 4 + j, 'ore');
      set(35 + i, 41 + j, 'ore');
    }
  return {
    ...m,
    tiles: encodeTiles(tiles),
    spawns: [
      { tx: 4, ty: 4 },
      { tx: 41, ty: 41 },
    ],
    points: [{ x: 24, y: 24, name: 'Center' }],
  };
}

describe('custom maps', () => {
  it('encodes every tile kind losslessly', () => {
    expect(decodeTiles(encodeTiles(TILE_KINDS))).toEqual(TILE_KINDS);
    expect(decodeTiles('x')).toEqual(['sand']); // damaged data falls back to sand
  });

  it('accepts a simple playable map', () => {
    const def = toMapDef(duel());
    expect(def.id).toBe('custom');
    expect(customMapErrors(def)).toEqual([]);
  });

  it('rejects missing spawns, bad spawn ground, blocked points and unreachable bases', () => {
    const one = toMapDef({ ...duel(), spawns: [{ tx: 4, ty: 4 }] });
    expect(customMapErrors(one)).toContain('Place at least 2 spawns');

    const onRock = duel();
    const t = decodeTiles(onRock.tiles);
    t[5 * 48 + 5] = 'rock';
    expect(customMapErrors(toMapDef({ ...onRock, tiles: encodeTiles(t) }))[0]).toMatch(/Spawn 1 needs a free 3×3/);

    const close = toMapDef({ ...duel(), spawns: [{ tx: 4, ty: 4 }, { tx: 8, ty: 6 }] });
    expect(customMapErrors(close)).toContain('Spawns 1 and 2 are too close');

    const wall = duel();
    const w = decodeTiles(wall.tiles);
    for (let y = 0; y < 48; y++) w[y * 48 + 24] = 'water'; // river with no crossing
    const errs = customMapErrors(toMapDef({ ...wall, tiles: encodeTiles(w), points: [] }));
    expect(errs[0]).toMatch(/reachable on foot/);

    const pt = toMapDef({ ...duel(), points: [{ x: 24, y: 24, name: 'P' }], tiles: duel().tiles.replace(/^(.{1176})./, '$13') });
    expect(customMapErrors(pt)).toContain('Strategic point 1 must be on open ground');
  });

  it('rejects wrong sizes and damaged data', () => {
    expect(customMapErrors(toMapDef(blankMap('tiny', 16)))[0]).toMatch(/between/);
    expect(customMapErrors({ ...toMapDef(duel()), tiles: [] })).toEqual(['Map data is damaged']);
  });

  it('harbour check: sea maps offer a Naval Yard at every spawn, dry maps and puddles do not (v0.15)', () => {
    for (const id of ['coastal-front', 'strait-crossing'] as const) {
      const n = navalInfo(getMap(id));
      expect(n.largestSea).toBeGreaterThanOrEqual(300);
      expect(n.harbours).toEqual([true, true, true, true]);
    }
    expect(navalInfo(getMap('highland-pass'))).toEqual({ largestSea: 0, harbours: [false, false, false, false] });
    // Desert Storm's oases are water, but far too small to be a sea.
    const d = navalInfo(getMap('desert-storm'));
    expect(d.largestSea).toBeGreaterThan(0);
    expect(d.harbours.some(Boolean)).toBe(false);
  });

  it('random maps with a sea: playable, open sea with a harbour at every spawn, no point in the water (v0.16)', () => {
    let fallbacks = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const m = getMap('random', seed, true);
      if (m.id !== 'random') {
        fallbacks++;
        continue;
      }
      expect(m.name).toMatch(/ Coast #/);
      const n = navalInfo(m);
      expect(n.largestSea).toBeGreaterThanOrEqual(300);
      expect(n.harbours).toEqual([true, true, true, true]);
      expect(m.strategicPoints.map((p) => p.name)).not.toContain('Centre');
      // The same seed without the sea is a different (dry-centred) map with the usual centre point.
      expect(getMap('random', seed).strategicPoints[0].name).toBe('Centre');
    }
    expect(fallbacks).toBe(0);
  });
});

