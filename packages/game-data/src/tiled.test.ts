import { describe, expect, it } from 'vitest';
import { parseTiledMap, TiledImportError, type TiledMap } from './tiled';
import { generateRandomMap, getMap, mapIsPlayable } from './maps';

/** 4×4 map: sand everywhere, water at (1,1), flipped rock gid at (2,2). */
function tiny(): TiledMap {
  const data = new Array(16).fill(1);
  data[5] = 3;
  data[10] = 2 | 0x80000000; // horizontally flipped rock
  return {
    orientation: 'orthogonal',
    width: 4,
    height: 4,
    tilewidth: 32,
    tileheight: 32,
    properties: [
      { name: 'name', type: 'string', value: 'Tiny' },
      { name: 'oreAmount', type: 'int', value: 500 },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 't',
        tiles: [
          { id: 0, properties: [{ name: 'kind', value: 'sand' }] },
          { id: 1, properties: [{ name: 'kind', value: 'rock' }] },
          { id: 2, properties: [{ name: 'kind', value: 'water' }] },
        ],
      },
    ],
    layers: [
      { type: 'tilelayer', name: 'terrain', data },
      {
        type: 'objectgroup',
        name: 'spawns',
        objects: [
          { x: 40, y: 40, properties: [{ name: 'index', value: 1 }] },
          { x: 5, y: 5, properties: [{ name: 'index', value: 0 }] },
        ],
      },
      { type: 'objectgroup', name: 'points', objects: [{ name: 'Hill', x: 100, y: 70 }] },
    ],
  };
}

describe('Tiled importer', () => {
  it('converts tiles, flip flags, spawns (ordered by index), points and properties', () => {
    const m = parseTiledMap(tiny(), 'desert-storm');
    expect(m.name).toBe('Tiny');
    expect(m.oreAmount).toBe(500);
    expect(m.tiles[0]).toBe('sand');
    expect(m.tiles[5]).toBe('water');
    expect(m.tiles[10]).toBe('rock');
    expect(m.spawns).toEqual([
      { tx: 0, ty: 0 },
      { tx: 1, ty: 1 },
    ]);
    expect(m.strategicPoints).toEqual([{ x: 3, y: 2, name: 'Hill' }]);
  });

  it('reports authoring mistakes with clear messages', () => {
    const cases: [(m: TiledMap) => void, RegExp][] = [
      [(m) => (m.orientation = 'isometric'), /orthogonal/],
      [(m) => (m.layers[0].name = 'ground'), /missing tile layer "terrain"/],
      [(m) => (m.layers[0].data = 'eJzt...'), /CSV/],
      [(m) => (m.layers[0].data as number[]).pop(), /expected 16/],
      [(m) => ((m.layers[0].data as number[])[3] = 9), /gid 9 without a "kind"/],
      [
        (m) => (m.tilesets[0].tiles![0].properties = [{ name: 'kind', value: 'lava' }]),
        /unknown kind "lava"/,
      ],
      [(m) => (m.tilesets[0].source = 'terrain.tsx'), /external tileset/],
      [(m) => m.layers.splice(2, 1), /missing object layer "points"/],
      [(m) => m.layers[1].objects!.pop(), /at least 2 spawns/],
    ];
    for (const [mutate, msg] of cases) {
      const m = tiny();
      mutate(m);
      expect(() => parseTiledMap(m, 'desert-storm')).toThrow(TiledImportError);
      expect(() => parseTiledMap(m, 'desert-storm')).toThrow(msg);
    }
  });

  it('imports River Crossing: 64×64, 4 spawns, 3 bridges, 180° symmetric', () => {
    const m = getMap('river-crossing');
    expect(m.name).toBe('River Crossing');
    expect(m.width * m.height).toBe(64 * 64);
    expect(m.spawns).toHaveLength(4);
    expect(m.strategicPoints.map((p) => p.name)).toEqual(['West Bridge', 'Central Bridge', 'East Bridge']);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) expect(m.tiles[y * 64 + x]).toBe(m.tiles[(63 - y) * 64 + (63 - x)]);
    expect(m.tiles.filter((t) => t === 'water').length).toBeGreaterThan(120);
  });

  it('imports Highland Pass: walled plateau with four open passes, 180° symmetric', () => {
    const m = getMap('highland-pass');
    expect(m.name).toBe('Highland Pass');
    expect(m.strategicPoints.map((p) => p.name)).toEqual(['North Pass', 'Town Square', 'South Pass']);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) expect(m.tiles[y * 64 + x]).toBe(m.tiles[(63 - y) * 64 + (63 - x)]);
    // The plateau wall is rock; each pass (N, S, W, E at radius 14) is walkable.
    expect(m.tiles[31 * 64 + 31 - 14]).not.toBe('rock');
    expect(m.tiles[(31 - 14) * 64 + 31]).not.toBe('rock');
    expect(m.tiles[(31 - 10) * 64 + 31 - 10]).toBe('rock');
    expect(m.tiles.filter((t) => t === 'ore').length).toBeGreaterThan(40);
  });
});

describe('random maps', () => {
  it('are deterministic per seed, differ between seeds and are always playable', () => {
    expect(generateRandomMap(42).tiles).toEqual(generateRandomMap(42).tiles);
    expect(generateRandomMap(42).tiles).not.toEqual(generateRandomMap(43).tiles);
    for (let seed = 1; seed <= 40; seed++) {
      const m = generateRandomMap(seed * 101);
      expect(m.id).toBe('random');
      expect(mapIsPlayable(m)).toBe(true);
      expect(m.strategicPoints).toHaveLength(3);
    }
    expect(getMap('random', 7)).toBe(getMap('random', 7)); // cached
  });
});
