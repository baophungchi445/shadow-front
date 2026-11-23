import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { getMap, mapIsPlayable } from '@shadow-front/game-data';
import { World } from './world';

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

/** Shore site for a 3×3 yard closest to player 0's HQ. */
function shoreSite(w: World) {
  const hq = w.playerBuildings(0)[0];
  let best: { tx: number; ty: number; d: number } | null = null;
  for (let ty = 0; ty < w.map.height - 2; ty++)
    for (let tx = 0; tx < w.map.width - 2; tx++) {
      if (w.placementError(0, 'naval-yard', tx, ty, true)) continue;
      const d = Math.hypot(tx + 1.5 - hq.x, ty + 1.5 - hq.y);
      if (!best || d < best.d) best = { tx, ty, d };
    }
  return best!;
}

/** Number of tiles of the largest 4-connected water body. */
function waterBodies(tiles: string[], W: number): number[] {
  const seen = new Uint8Array(tiles.length);
  const sizes: number[] = [];
  tiles.forEach((t, i) => {
    if (t !== 'water' || seen[i]) return;
    let n = 0;
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const c = st.pop()!;
      n++;
      for (const j of [c + 1, c - 1, c + W, c - W]) {
        if (j < 0 || j >= tiles.length || seen[j] || tiles[j] !== 'water') continue;
        if (Math.abs((j % W) - (c % W)) > 1) continue;
        seen[j] = 1;
        st.push(j);
      }
    }
    sizes.push(n);
  });
  return sizes.sort((a, b) => b - a);
}

describe('naval (v0.13)', () => {
  it('Coastal Front has one open sea that reaches every base, and is playable on land', () => {
    const m = getMap('coastal-front');
    expect(mapIsPlayable(m)).toBe(true);
    const bodies = waterBodies(m.tiles, m.width);
    expect(bodies[0]).toBeGreaterThan(500);
    for (const s of m.spawns) {
      let best = Infinity;
      m.tiles.forEach((t, i) => {
        if (t === 'water') best = Math.min(best, Math.hypot((i % m.width) - s.tx, Math.floor(i / m.width) - s.ty));
      });
      expect(best).toBeLessThan(14);
    }
  });

  it('Strait Crossing: one strait linking every base by sea, land armies cross only at the isthmuses (v0.14)', () => {
    const m = getMap('strait-crossing');
    expect(mapIsPlayable(m)).toBe(true);
    const bodies = waterBodies(m.tiles, m.width);
    expect(bodies[0]).toBeGreaterThan(300);
    expect(bodies.slice(1).every((n) => n < 10)).toBe(true);
    for (const s of m.spawns) {
      let best = Infinity;
      m.tiles.forEach((t, i) => {
        if (t === 'water') best = Math.min(best, Math.hypot((i % m.width) - s.tx, Math.floor(i / m.width) - s.ty));
      });
      expect(best).toBeLessThan(14);
    }
    // The middle columns are cut by water; the edge columns are not.
    const col = (x: number) => Array.from({ length: m.height }, (_, y) => m.tiles[y * m.width + x]);
    expect(col(32).includes('water')).toBe(true);
    expect(col(2).includes('water')).toBe(false);
    expect(col(61).includes('water')).toBe(false);
  });

  it('a Naval Yard must touch water and faces the sea', () => {
    const w = new World(config);
    w.updateFog();
    const hq = w.playerBuildings(0)[0];
    expect(w.placementError(0, 'naval-yard', hq.tx + 4, hq.ty, true)).toBe('Must be built on the shore');
    const site = shoreSite(w);
    expect(site.d).toBeLessThan(16);
    const f = w.shoreFacing(site.tx, site.ty, 3, 3);
    const edge = [
      [site.tx + 1, site.ty + 3],
      [site.tx + 3, site.ty + 1],
      [site.tx + 1, site.ty - 1],
      [site.tx - 1, site.ty + 1],
    ][f];
    // The chosen front edge has water along it.
    const along = [-1, 0, 1].some((k) =>
      f % 2 === 0 ? w.grid.tile(edge[0] + k, edge[1]) === 'water' : w.grid.tile(edge[0], edge[1] + k) === 'water',
    );
    expect(along).toBe(true);
  });

  it('ships launch into the water, sail on water only and stop at the coast when sent inland', () => {
    const w = new World(config);
    w.updateFog();
    const site = shoreSite(w);
    const yard = w.createBuilding(0, 'naval-yard', site.tx, site.ty, true, w.shoreFacing(site.tx, site.ty, 3, 3));
    w.createBuilding(0, 'power-plant', w.playerBuildings(0)[0].tx + 4, w.playerBuildings(0)[0].ty, true);
    expect(w.issue({ type: 'produce', player: 0, producer: yard.id, unit: 'patrol-boat' }).ok).toBe(true);
    let boat = undefined as ReturnType<World['playerUnits']>[number] | undefined;
    for (let i = 0; i < 400 && !boat; i++) {
      w.step();
      boat = w.playerUnits(0).find((u) => u.type === 'patrol-boat');
    }
    expect(boat).toBeDefined();
    expect(boat!.naval).toBe(true);
    expect(w.grid.tile(Math.floor(boat!.x), Math.floor(boat!.y))).toBe('water');
    // Order it to the enemy HQ (on land): it sails as close as the water allows and never leaves it.
    const enemy = w.playerBuildings(1)[0];
    w.issue({ type: 'move', player: 0, units: [boat!.id], x: enemy.x, y: enemy.y, attackMove: false });
    let dry = 0;
    for (let i = 0; i < 20 * 60; i++) {
      w.step();
      if (w.grid.tile(Math.floor(boat!.x), Math.floor(boat!.y)) !== 'water') dry++;
    }
    expect(dry).toBe(0);
    expect(Math.hypot(boat!.x - enemy.x, boat!.y - enemy.y)).toBeLessThan(16);
  });

  it('ships cannot take strategic points; land units cannot board the sea', () => {
    const w = new World(config);
    const hq = w.playerBuildings(0)[0];
    const tank = w.createUnit(0, 'main-battle-tank', hq.x + 3, hq.y + 3);
    let water = { x: 0, y: 0 };
    w.map.tiles.some((t, i) => t === 'water' && ((water = { x: (i % w.map.width) + 0.5, y: Math.floor(i / w.map.width) + 0.5 }), true));
    w.issue({ type: 'move', player: 0, units: [tank.id], x: water.x, y: water.y, attackMove: false });
    for (let i = 0; i < 20 * 40; i++) w.step();
    expect(w.grid.tile(Math.floor(tank.x), Math.floor(tank.y))).not.toBe('water');
  });

  it('a destroyer shells a coastal building from the sea', () => {
    const w = new World(config);
    const enemyHq = w.playerBuildings(1)[0];
    // Closest water tile to the enemy HQ.
    const t = w.water.nearestWalkable(Math.floor(enemyHq.x), Math.floor(enemyHq.y))!;
    const ship = w.createUnit(0, 'destroyer', t.x + 0.5, t.y + 0.5);
    expect(Math.hypot(ship.x - enemyHq.x, ship.y - enemyHq.y)).toBeLessThan(13);
    const hp0 = enemyHq.hp;
    w.updateFog();
    w.issue({ type: 'attack', player: 0, units: [ship.id], target: enemyHq.id });
    for (let i = 0; i < 20 * 20; i++) w.step();
    expect(enemyHq.hp).toBeLessThan(hp0);
    expect(w.grid.tile(Math.floor(ship.x), Math.floor(ship.y))).toBe('water');
  });

  it('a match on a random map with the sea option gets the coastal variant (v0.16)', () => {
    const w = new World({ ...config, mapId: 'random', mapSeed: 7, mapSea: true });
    expect(w.map.name).toMatch(/Coast/);
    expect(w.map.tiles.filter((t) => t === 'water').length).toBeGreaterThan(300);
    const dry = new World({ ...config, mapId: 'random', mapSeed: 7 });
    expect(dry.map.name).not.toMatch(/Coast/);
  });
});

