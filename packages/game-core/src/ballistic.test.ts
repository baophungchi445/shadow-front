import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE } from '@shadow-front/game-data';
import { World } from './world';
import { leadPoint } from './systems/combat';

const config: MatchConfig = {
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 5000,
  seed: 9,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'human', name: 'P2', faction: 'eastern', team: 1 },
  ],
};

/** An open stretch of ground well away from both bases. */
function openSpot(w: World): { x: number; y: number } {
  for (let y = 20; y < w.map.height - 20; y++)
    for (let x = 10; x < w.map.width - 14; x++) {
      let ok = true;
      for (let j = -3; j <= 14 && ok; j++)
        for (let i = 0; i <= 12 && ok; i++) if (!w.grid.walkable(x + i, y + j)) ok = false;
      if (ok) return { x: x + 0.5, y: y + 0.5 };
    }
  throw new Error('no open ground');
}

describe('ballistic artillery (v0.11)', () => {
  it('leads a moving unit by its velocity over the flight time; static targets are aimed at directly', () => {
    const w = new World(config);
    const tank = w.createUnit(1, 'main-battle-tank', 30, 30);
    expect(leadPoint({ x: 20, y: 30 }, tank, 0.5)).toEqual({ x: 30, y: 30 });
    tank.moving = true;
    tank.prevY = 29.9; // moving +0.1 tile / tick along y
    const p = leadPoint({ x: 20, y: 30 }, tank, 0.5);
    expect(p.x).toBe(30);
    // 10 tiles at 0.5 tile / tick = 20 ticks of flight → about 2 tiles ahead.
    expect(p.y).toBeGreaterThan(31.9);
    expect(p.y).toBeLessThan(32.3);
  });

  it('shells arc (apex ∝ distance), bombs do not, and land inside the scatter radius', () => {
    const w = new World(config);
    const o = openSpot(w);
    const arty = w.createUnit(0, 'mobile-artillery', o.x, o.y);
    const target = w.createUnit(1, 'heavy-tank', o.x + 10, o.y);
    w.fog.reveal(0, target.x, target.y, 3);
    w.issue({ type: 'attack', player: 0, units: [arty.id], target: target.id });
    let shot = null;
    for (let i = 0; i < 200 && !shot; i++) {
      w.step();
      shot = w.projectiles.find((p) => p.sourceId === arty.id) ?? null;
    }
    expect(shot).not.toBeNull();
    const dist = Math.hypot(shot!.tx - shot!.startX, shot!.ty - shot!.startY);
    expect(shot!.apex).toBeCloseTo(
      Math.hypot(target.x - arty.x, target.y - arty.y) * BALANCE.ballisticApexRatio,
      0,
    );
    const spread = BALANCE.artilleryScatterBase + dist * BALANCE.artilleryScatterPerTile;
    expect(Math.abs(shot!.tx - target.x)).toBeLessThanOrEqual(spread + 1e-6);
    expect(Math.abs(shot!.ty - target.y)).toBeLessThanOrEqual(spread + 1e-6);

    const bomber = w.createUnit(0, 'bomber', target.x - 1, target.y);
    w.issue({ type: 'attack', player: 0, units: [bomber.id], target: target.id });
    let bomb = null;
    for (let i = 0; i < 200 && !bomb; i++) {
      w.step();
      bomb = w.projectiles.find((p) => p.sourceId === bomber.id) ?? null;
    }
    expect(bomb?.apex).toBe(0);
  });

  it('hits a tank driving across its line of fire', () => {
    const w = new World(config);
    const o = openSpot(w);
    const arty = w.createUnit(0, 'mobile-artillery', o.x, o.y + 6);
    const tank = w.createUnit(1, 'main-battle-tank', o.x + 10, o.y - 2);
    w.createUnit(0, 'recon-drone', o.x + 8, o.y + 6); // spotter: keeps the tank in sight
    w.updateFog();
    w.issue({ type: 'move', player: 1, units: [tank.id], x: o.x + 10, y: o.y + 14 });
    w.issue({ type: 'attack', player: 0, units: [arty.id], target: tank.id });
    const misses: number[] = [];
    const tracked = new Set<number>();
    for (let i = 0; i < 400; i++) {
      w.step();
      for (const p of w.projectiles)
        if (
          p.sourceId === arty.id &&
          p.targetId === tank.id &&
          !tracked.has(p.id) &&
          Math.hypot(p.tx - p.x, p.ty - p.y) < 0.4
        ) {
          tracked.add(p.id);
          misses.push(Math.hypot(p.tx - tank.x, p.ty - tank.y));
        }
      if (tank.dead || !tank.moving) break;
    }
    expect(misses.length).toBeGreaterThan(0);
    // Without leading, the shell would land ~2 tiles behind the tank; with it, within the splash radius.
    for (const m of misses) expect(m).toBeLessThan(1.5 + 0.8);
  });
});
