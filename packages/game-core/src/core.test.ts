import { describe, expect, it } from 'vitest';
import type { MatchConfig, MapDef } from '@shadow-front/shared-types';
import { BUILDINGS, UNITS } from '@shadow-front/game-data';
import { NavGrid } from './grid';
import { findPath } from './pathfinding';
import { screenToWorld, worldToScreen } from './iso';
import { computeDamage } from './combat';
import { World } from './world';
import type { Unit } from './types';

const config = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 10000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
  ...over,
});

function run(world: World, ticks: number) {
  for (let i = 0; i < ticks; i++) world.step();
}

function tinyMap(rows: string[]): MapDef {
  const tiles = rows
    .join('')
    .split('')
    .map((c) => (c === '#' ? 'rock' : 'sand'));
  return {
    id: 'desert-storm',
    name: 't',
    description: '',
    width: rows[0].length,
    height: rows.length,
    tiles: tiles as MapDef['tiles'],
    oreAmount: 0,
    spawns: [],
    strategicPoints: [],
  };
}

describe('iso projection', () => {
  it('round-trips world ↔ screen', () => {
    for (const [x, y] of [
      [0, 0],
      [3.5, 7.25],
      [63, 1],
    ]) {
      const s = worldToScreen(x, y);
      const w = screenToWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(x);
      expect(w.y).toBeCloseTo(y);
    }
  });
});

describe('A* pathfinding', () => {
  const grid = new NavGrid(
    tinyMap(['..........', '.######...', '......#...', '.####.#...', '......#...', '..........']),
  );

  it('finds a path around obstacles that never touches blocked tiles', () => {
    const path = findPath(grid, 0.5, 2.5, 7.5, 2.5)!;
    expect(path).not.toBeNull();
    const last = path[path.length - 1];
    expect(last).toEqual({ x: 7.5, y: 2.5 });
    // Walk each segment densely and check walkability.
    let px = 0.5;
    let py = 2.5;
    for (const p of path) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = px + (p.x - px) * t;
        const y = py + (p.y - py) * t;
        expect(grid.walkable(Math.floor(x), Math.floor(y))).toBe(true);
      }
      px = p.x;
      py = p.y;
    }
  });

  it('redirects to the nearest walkable tile when the goal is blocked', () => {
    const path = findPath(grid, 0.5, 0.5, 3.5, 1.5)!;
    const last = path[path.length - 1];
    expect(grid.walkable(Math.floor(last.x), Math.floor(last.y))).toBe(true);
  });

  it('respects building occupancy', () => {
    const g = new NavGrid(tinyMap(['.....', '.....', '.....']));
    g.setOccupied(2, 0, 1, 3, 99);
    expect(findPath(g, 0.5, 1.5, 4.5, 1.5)).not.toEqual(expect.arrayContaining([{ x: 4.5, y: 1.5 }]));
    expect(g.walkable(2, 1)).toBe(false);
  });
});

describe('combat math', () => {
  it('applies the counter table', () => {
    const w = new World(config());
    const tank = w.createUnit(0, 'main-battle-tank', 30, 30);
    const inf = w.createUnit(0, 'rifleman', 30, 31);
    const rifle = UNITS.rifleman.weapon!;
    const at = UNITS['at-soldier'].weapon!;
    expect(computeDamage(rifle, 1, inf)).toBeCloseTo(12);
    expect(computeDamage(rifle, 1, tank)).toBeCloseTo(12 * 0.15);
    expect(computeDamage(at, 1, tank)).toBeGreaterThan(computeDamage(at, 1, inf));
  });
});

describe('World', () => {
  it('starts each player with an HQ and units', () => {
    const w = new World(config());
    for (const p of w.players) {
      expect(w.playerBuildings(p.id).map((b) => b.type)).toEqual(['headquarters']);
      expect(w.playerUnits(p.id).length).toBeGreaterThan(0);
    }
  });

  it('validates placement, deducts credits and constructs buildings', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const credits = w.players[0].credits;
    // Barracks requires a Power Plant.
    expect(w.issue({ type: 'build', player: 0, building: 'barracks', tx: hq.tx + 4, ty: hq.ty }).ok).toBe(
      false,
    );
    const res = w.issue({ type: 'build', player: 0, building: 'power-plant', tx: hq.tx + 4, ty: hq.ty });
    expect(res).toEqual({ ok: true });
    expect(w.players[0].credits).toBe(credits - BUILDINGS['power-plant'].cost);
    // Overlapping placement is rejected.
    expect(w.issue({ type: 'build', player: 0, building: 'power-plant', tx: hq.tx + 4, ty: hq.ty }).ok).toBe(
      false,
    );
    run(w, BUILDINGS['power-plant'].buildTime + 2);
    const pp = w.playerBuildings(0).find((b) => b.type === 'power-plant')!;
    expect(pp.complete).toBe(true);
    expect(w.players[0].powerProduced).toBeGreaterThanOrEqual(100);
  });

  it('rejects placement far from the base', () => {
    const w = new World(config());
    expect(w.placementError(0, 'power-plant', 40, 40)).not.toBeNull();
  });

  it('produces units through the queue and refunds on cancel', () => {
    const w = new World(config());
    const p = w.players[0];
    const hq = w.playerBuildings(0)[0];
    const b = w.createBuilding(0, 'barracks', hq.tx + 4, hq.ty, true);
    w.createBuilding(0, 'power-plant', hq.tx, hq.ty + 4, true);
    const before = p.credits;
    expect(w.issue({ type: 'produce', player: 0, producer: b.id, unit: 'rifleman' }).ok).toBe(true);
    expect(w.issue({ type: 'produce', player: 0, producer: b.id, unit: 'main-battle-tank' }).ok).toBe(false);
    expect(w.issue({ type: 'produce', player: 0, producer: b.id, unit: 'at-soldier' }).ok).toBe(true);
    expect(w.issue({ type: 'cancel', player: 0, producer: b.id }).ok).toBe(true);
    expect(p.credits).toBe(before - UNITS.rifleman.cost);
    const count = w.playerUnits(0).length;
    run(w, UNITS.rifleman.buildTime + 2);
    expect(w.playerUnits(0).length).toBe(count + 1);
  });

  it('low power slows production', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const b = w.createBuilding(0, 'barracks', hq.tx + 4, hq.ty, true);
    w.createBuilding(0, 'research-center', hq.tx, hq.ty + 4, true);
    w.step();
    expect(w.isLowPower(0)).toBe(true);
    w.issue({ type: 'produce', player: 0, producer: b.id, unit: 'rifleman' });
    run(w, 10);
    expect(b.queueProgress).toBeCloseTo(5);
  });

  it('extractors drain finite ore into credits', () => {
    const w = new World(config());
    const p = w.players[0];
    // Find a valid extractor spot near the HQ.
    const hq = w.playerBuildings(0)[0];
    let spot: { tx: number; ty: number } | null = null;
    w.createBuilding(0, 'power-plant', hq.tx, hq.ty + 4, true);
    w.step();
    for (let ty = hq.ty - 6; ty < hq.ty + 10 && !spot; ty++)
      for (let tx = hq.tx - 6; tx < hq.tx + 12 && !spot; tx++)
        if (!w.placementError(0, 'resource-extractor', tx, ty)) spot = { tx, ty };
    expect(spot).not.toBeNull();
    const ex = w.createBuilding(0, 'resource-extractor', spot!.tx, spot!.ty, true);
    ex.oreTiles = w.oreTilesNear(ex.x, ex.y);
    const ore = ex.oreTiles.reduce((s, i) => s + w.oreRemaining[i], 0);
    const c0 = p.credits;
    run(w, 100);
    const c1 = p.credits;
    expect(c1 - c0).toBeGreaterThan(90); // 20/s extractor + 4/s HQ over 5 s
    expect(ex.oreTiles.reduce((s, i) => s + w.oreRemaining[i], 0)).toBeLessThan(ore);
  });

  it('units move along a path to the ordered destination', () => {
    const w = new World(config());
    const u = w.playerUnits(0).find((x) => x.type === 'recon-vehicle')!;
    w.issue({ type: 'move', player: 0, units: [u.id], x: 20.5, y: 12.5 });
    run(w, 400);
    expect(Math.hypot(u.x - 20.5, u.y - 12.5)).toBeLessThan(1.5);
    expect(u.order.type).toBe('idle');
  });

  it('rejects commands for units the player does not own', () => {
    const w = new World(config());
    const enemy = w.playerUnits(1)[0];
    expect(w.issue({ type: 'move', player: 0, units: [enemy.id], x: 10, y: 10 }).ok).toBe(false);
  });

  it('units automatically engage visible enemies and destroy them', () => {
    const w = new World(config());
    const tanks: Unit[] = [];
    for (let i = 0; i < 3; i++) tanks.push(w.createUnit(0, 'main-battle-tank', 30 + i * 0.8, 30));
    const victim = w.createUnit(1, 'recon-vehicle', 30, 34);
    w.updateFog();
    run(w, 300);
    expect(victim.dead).toBe(true);
    expect(w.players[0].stats.kills).toBeGreaterThan(0);
  });

  it('fog of war hides distant enemies', () => {
    const w = new World(config());
    const enemyHq = w.playerBuildings(1)[0];
    expect(w.isVisibleTo(w.players[0].team, enemyHq)).toBe(false);
    expect(w.visibleEnemies(w.players[0].team)).toHaveLength(0);
  });

  it('decapitation ends the match when the HQ falls', () => {
    const w = new World(config({ mission: 'decapitation' }));
    const enemyHq = w.playerBuildings(1)[0];
    w.destroy(enemyHq);
    run(w, 20);
    expect(w.players[1].defeated).toBe(true);
    expect(w.winningTeam).toBe(0);
  });
});
