import { describe, expect, it } from 'vitest';
import type { MatchConfig, TileKind } from '@shadow-front/shared-types';
import { blankMap, decodeTiles, encodeTiles, toMapDef } from '@shadow-front/game-data';
import { World } from './world';

function duelMap() {
  const m = blankMap('Duel', 48);
  const tiles = decodeTiles(m.tiles);
  const set = (x: number, y: number, k: TileKind) => (tiles[y * 48 + x] = k);
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      set(10 + i, 4 + j, 'ore');
      set(35 + i, 41 + j, 'ore');
    }
  for (let x = 16; x < 32; x++) set(x, 24, 'rock');
  return toMapDef({
    ...m,
    tiles: encodeTiles(tiles),
    spawns: [
      { tx: 4, ty: 4 },
      { tx: 41, ty: 41 },
    ],
    points: [{ x: 24, y: 20, name: 'North Gate' }],
  });
}

const config = (customMap = duelMap()): MatchConfig => ({
  mapId: 'custom',
  customMap,
  mission: 'annihilation',
  startingCredits: 5000,
  seed: 2,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

describe('custom map matches', () => {
  it('starts on a player-made map: bases on the spawns, points from the map', () => {
    const w = new World(config());
    expect(w.map.name).toBe('Duel');
    const hq = w.playerBuildings(1)[0];
    expect([hq.tx, hq.ty]).toEqual([41, 41]);
    expect(w.points.map((p) => p.name)).toEqual(['North Gate']);
    for (let i = 0; i < 200; i++) w.step();
    expect(w.winningTeam).toBeNull();
  });

  it('refuses a missing or unplayable custom map', () => {
    expect(() => new World({ ...config(), customMap: undefined })).toThrow(/missing/);
    const bad = duelMap();
    bad.spawns = [bad.spawns[0]];
    expect(() => new World(config(bad))).toThrow(/not playable/);
  });
});
