import { describe, expect, it } from 'vitest';
import type { Formation, MatchConfig } from '@shadow-front/shared-types';
import { World } from './world';
import { formationOffsets } from './systems/movement';
import type { Unit } from './types';

const config = (): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 20000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

/** A mixed group (riflemen + tanks) on open ground west of the rock ridge, ordered east-south-east. */
function group(formation: Formation) {
  const w = new World(config());
  const units: Unit[] = [];
  for (let i = 0; i < 4; i++) units.push(w.createUnit(0, 'rifleman', 10.5 + i * 0.6, 12.5));
  for (let i = 0; i < 2; i++) units.push(w.createUnit(0, 'main-battle-tank', 10.5 + i, 13.5));
  w.updateFog();
  const ok = w.issue({ type: 'move', player: 0, units: units.map((u) => u.id), x: 10.5, y: 30.5, formation });
  return { w, units, ok: ok.ok };
}

describe('formations', () => {
  it('lays out line, column and wedge slots with the requested shape', () => {
    const line = formationOffsets('line', 6, 1);
    expect(new Set(line.map((o) => o.x)).size).toBe(1); // a single rank
    expect(Math.max(...line.map((o) => o.y)) - Math.min(...line.map((o) => o.y))).toBeCloseTo(5);
    const twoRows = formationOffsets('line', 10, 1);
    expect(new Set(twoRows.map((o) => o.x)).size).toBe(2);

    const col = formationOffsets('column', 6, 1);
    expect(new Set(col.map((o) => o.x)).size).toBe(3); // 3 ranks of 2
    expect(Math.max(...col.map((o) => Math.abs(o.y)))).toBeCloseTo(0.5);

    const wedge = formationOffsets('wedge', 5, 1);
    expect(wedge[0]).toEqual({ x: 0, y: 0 });
    for (const o of wedge.slice(1)) expect(o.x).toBeLessThan(0); // everyone behind the tip
    expect(wedge[1].y).toBeCloseTo(-wedge[2].y);
  });

  it('formation moves share the slowest unit speed and spread across the travel direction', () => {
    const { w, units, ok } = group('line');
    expect(ok).toBe(true);
    const slowest = Math.min(...units.map((u) => u.speed));
    for (const u of units) {
      expect(u.order.type).toBe('move');
      if (u.order.type === 'move') expect(u.order.speed).toBeCloseTo(slowest);
    }
    // Destinations of a line facing roughly south (+y): spread mostly along x.
    const goals = units.map((u) => (u.order.type === 'move' ? { x: u.order.x, y: u.order.y } : { x: 0, y: 0 }));
    const xs = goals.map((g) => g.x);
    const ys = goals.map((g) => g.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    // Distinct destination tiles.
    expect(new Set(goals.map((g) => `${Math.floor(g.x)},${Math.floor(g.y)}`)).size).toBe(units.length);
    // Riflemen are faster than tanks but keep pace with them.
    for (let i = 0; i < 20 * 6; i++) w.step();
    const inf = units.filter((u) => u.type === 'rifleman');
    const tanks = units.filter((u) => u.type === 'main-battle-tank');
    const avg = (l: Unit[]) => l.reduce((s, u) => s + u.y, 0) / l.length;
    expect(Math.abs(avg(inf) - avg(tanks))).toBeLessThan(2.5);
  });

  it('tanks take the front of a wedge; spread keeps the old behaviour (no speed cap)', () => {
    const { units } = group('wedge');
    // Project destinations onto the travel direction: the most forward slot belongs to a tank.
    const cx = units.reduce((s, u) => s + u.x, 0) / units.length;
    const cy = units.reduce((s, u) => s + u.y, 0) / units.length;
    const dx = 10.5 - cx;
    const dy = 30.5 - cy;
    const ahead = (u: Unit) => (u.order.type === 'move' ? u.order.x * dx + u.order.y * dy : -Infinity);
    const front = [...units].sort((a, b) => ahead(b) - ahead(a))[0];
    expect(front.type).toBe('main-battle-tank');
    const spread = group('spread');
    for (const u of spread.units) if (u.order.type === 'move') expect(u.order.speed).toBeUndefined();
  });
});
