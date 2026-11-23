import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { World } from './world';
import type { Unit } from './types';

const config: MatchConfig = {
  mapId: 'coastal-front',
  mission: 'annihilation',
  startingCredits: 10000,
  seed: 3,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'human', name: 'P2', faction: 'eastern', team: 1 },
  ],
};

/** A water tile right next to land (≤ 1 tile) closest to (x, y), and the land tile beside it. */
function beach(w: World, x: number, y: number) {
  let best: { sea: { x: number; y: number }; land: { x: number; y: number }; d: number } | null = null;
  for (let ty = 1; ty < w.map.height - 1; ty++)
    for (let tx = 1; tx < w.map.width - 1; tx++) {
      if (w.grid.tile(tx, ty) !== 'water') continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!w.grid.walkable(tx + dx, ty + dy)) continue;
        const d = Math.hypot(tx - x, ty - y);
        if (!best || d < best.d)
          best = { sea: { x: tx + 0.5, y: ty + 0.5 }, land: { x: tx + dx + 0.5, y: ty + dy + 0.5 }, d };
      }
    }
  return best!;
}

function run(w: World, ticks: number) {
  for (let i = 0; i < ticks; i++) w.step();
}

describe('landing craft (v0.14)', () => {
  it('seats: infantry take 1, vehicles 3; aircraft and ships never board', () => {
    const w = new World(config);
    const hq = w.playerBuildings(0)[0];
    const b = beach(w, hq.x, hq.y);
    const craft = w.createUnit(0, 'landing-craft', b.sea.x, b.sea.y);
    const tank = w.createUnit(0, 'main-battle-tank', b.land.x, b.land.y);
    const rifle = w.createUnit(0, 'rifleman', b.land.x, b.land.y);
    const heli = w.createUnit(0, 'attack-helicopter', b.land.x, b.land.y);
    const boat = w.createUnit(0, 'patrol-boat', b.sea.x, b.sea.y);
    expect(w.canCarry(craft, tank)).toBe(true);
    expect(w.canCarry(craft, rifle)).toBe(true);
    expect(w.canCarry(craft, heli)).toBe(false);
    expect(w.canCarry(craft, boat)).toBe(false);
    expect(w.seatsOf(tank)).toBe(3);
    expect(w.seatsOf(rifle)).toBe(1);
    // An APC still takes infantry only.
    const apc = w.createUnit(0, 'apc', hq.x + 3, hq.y + 3);
    expect(w.canCarry(apc, tank)).toBe(false);
    expect(w.issue({ type: 'load', player: 0, units: [tank.id], carrier: apc.id })).toEqual({
      ok: false,
      reason: 'Only infantry can get in',
    });
  });

  it('loads a tank and infantry from the beach, crosses the sea and lands them on another shore', () => {
    const w = new World(config);
    const hq = w.playerBuildings(0)[0];
    const b = beach(w, hq.x, hq.y);
    const craft = w.createUnit(0, 'landing-craft', b.sea.x, b.sea.y);
    const tank = w.createUnit(0, 'main-battle-tank', b.land.x, b.land.y);
    const t2 = w.createUnit(0, 'main-battle-tank', b.land.x, b.land.y);
    const inf = [0, 1, 2].map(() => w.createUnit(0, 'rifleman', b.land.x, b.land.y));
    // 3 + 1 + 1 + 1 seats fit; the second tank does not.
    const res = w.issue({
      type: 'load',
      player: 0,
      units: [tank.id, ...inf.map((u) => u.id), t2.id],
      carrier: craft.id,
    });
    expect(res.ok).toBe(true);
    expect(t2.order.type).not.toBe('board');
    run(w, 20 * 15);
    expect(craft.passengers.map((p) => p.type).sort()).toEqual([
      'main-battle-tank',
      'rifleman',
      'rifleman',
      'rifleman',
    ]);
    expect(w.seatsUsed(craft)).toBe(6);
    // Out at sea there is no beach to land on.
    const centre = w.water.nearestWalkable(32, 32)!;
    craft.x = craft.prevX = centre.x + 0.5;
    craft.y = craft.prevY = centre.y + 0.5;
    expect(w.issue({ type: 'unload', player: 0, carrier: craft.id })).toEqual({
      ok: false,
      reason: 'Move closer to the shore to unload',
    });
    // Sail across to the empty north-east bay (out of range of the enemy HQ) and land.
    const ne = w.map.spawns[2];
    const far = beach(w, ne.tx, ne.ty);
    w.issue({ type: 'move', player: 0, units: [craft.id], x: far.sea.x, y: far.sea.y, attackMove: false });
    run(w, 20 * 60);
    expect(Math.hypot(craft.x - far.sea.x, craft.y - far.sea.y)).toBeLessThan(1.5);
    expect(w.issue({ type: 'unload', player: 0, carrier: craft.id })).toEqual({ ok: true });
    const landed = [tank, ...inf] as Unit[];
    for (const u of landed) {
      expect(w.get(u.id)).toBe(u);
      expect(w.grid.walkable(Math.floor(u.x), Math.floor(u.y))).toBe(true);
      expect(Math.hypot(u.x - craft.x, u.y - craft.y)).toBeLessThan(4);
    }
  });

  it('passengers go down with a sunk craft', () => {
    const w = new World(config);
    const hq = w.playerBuildings(0)[0];
    const b = beach(w, hq.x, hq.y);
    const craft = w.createUnit(0, 'landing-craft', b.sea.x, b.sea.y);
    const tank = w.createUnit(0, 'main-battle-tank', b.land.x, b.land.y);
    expect(w.board(tank, craft)).toBe(true);
    w.destroy(craft);
    expect(tank.dead).toBe(true);
  });
});
