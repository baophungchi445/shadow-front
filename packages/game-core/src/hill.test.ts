import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE, decodeTiles, encodeTiles, getMap } from '@shadow-front/game-data';
import { World } from './world';
import { inWeaponRange } from './combat';

const config: MatchConfig = {
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 5000,
  seed: 5,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'human', name: 'P2', faction: 'eastern', team: 1 },
  ],
};

/** First hill tile of the map, and a lower walkable tile `d` tiles west of it. */
function hillAndLow(w: World, d: number) {
  for (let y = 0; y < w.map.height; y++)
    for (let x = d; x < w.map.width; x++) {
      if (w.grid.tile(x, y) !== 'hill') continue;
      const lx = x - d;
      const k = w.grid.tile(lx, y);
      if (k && k !== 'hill' && w.grid.walkable(lx, y))
        return { hill: { x: x + 0.5, y: y + 0.5 }, low: { x: lx + 0.5, y: y + 0.5 } };
    }
  throw new Error('no hill');
}

describe('high ground (v0.12)', () => {
  it('hills are stored compactly and appear on Desert Storm and random maps', () => {
    expect(decodeTiles(encodeTiles(['sand', 'hill', 'forest']))).toEqual(['sand', 'hill', 'forest']);
    expect(encodeTiles(['hill'])).toHaveLength(1);
    expect(decodeTiles('0123')).toEqual(['sand', 'grass', 'road', 'rock']);
    expect(getMap('desert-storm').tiles.filter((t) => t === 'hill').length).toBeGreaterThan(10);
    expect(getMap('random', 77).tiles.some((t) => t === 'hill')).toBe(true);
  });

  it('a unit on a hill sees and shoots further', () => {
    const w = new World(config);
    const { hill, low } = hillAndLow(w, 5);
    const up = w.createUnit(0, 'main-battle-tank', hill.x, hill.y);
    const down = w.createUnit(0, 'main-battle-tank', low.x, low.y);
    expect(w.visionOf(up)).toBeCloseTo(w.visionOf(down) + BALANCE.hillVision);
    expect(w.rangeBonus(up)).toBe(BALANCE.hillRange);
    expect(w.rangeBonus(down)).toBe(0);
    const heli = w.createUnit(0, 'attack-helicopter', hill.x, hill.y);
    expect(w.onHill(heli)).toBe(false);
    const weapon = up.def.weapon!;
    const t = w.createUnit(1, 'rifleman', up.x, up.y + weapon.range + 0.6);
    expect(inWeaponRange(weapon, up.x, up.y, t)).toBe(false);
    expect(inWeaponRange(weapon, up.x, up.y, t, w.rangeBonus(up))).toBe(true);
  });

  it('direct fire from below misses a target on a hill about hillMissChance of the time', () => {
    const w = new World(config);
    const { hill, low } = hillAndLow(w, 4);
    const target = w.createUnit(1, 'heavy-tank', hill.x, hill.y);
    target.order = { type: 'hold' };
    target.def = { ...target.def, weapon: null };
    const shooters = [0, 1, 2].map(() => w.createUnit(0, 'at-soldier', low.x, low.y));
    for (const s of shooters) s.order = { type: 'hold' };
    const seen = new Set<number>();
    let shots = 0;
    let misses = 0;
    for (let i = 0; i < 20 * 120; i++) {
      target.hp = target.maxHp;
      w.step();
      for (const p of w.projectiles)
        if (!seen.has(p.id) && shooters.some((s) => s.id === p.sourceId)) {
          seen.add(p.id);
          shots++;
          if (!p.homing) misses++;
        }
    }
    expect(shots).toBeGreaterThan(60);
    expect(misses / shots).toBeGreaterThan(BALANCE.hillMissChance - 0.12);
    expect(misses / shots).toBeLessThan(BALANCE.hillMissChance + 0.12);
  });
});
