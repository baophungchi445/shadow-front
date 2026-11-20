import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE } from '@shadow-front/game-data';
import { World } from './world';

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

const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

/** An open 3×3 spot far (> build radius) from player 0's base. */
function farSpot(w: World): { x: number; y: number } {
  const hq = w.playerBuildings(0)[0];
  for (let r = 14; r < 40; r++)
    for (let a = 0; a < 16; a++) {
      const x = Math.floor(hq.x + Math.cos((a / 16) * Math.PI * 2) * r) + 0.5;
      const y = Math.floor(hq.y + Math.sin((a / 16) * Math.PI * 2) * r) + 0.5;
      const tx = Math.round(x - 1.5);
      const ty = Math.round(y - 1.5);
      let open = true;
      for (let j = ty; j < ty + 3 && open; j++)
        for (let i = tx; i < tx + 3 && open; i++)
          open = w.grid.inBounds(i, j) && w.grid.walkable(i, j) && w.map.tiles[w.grid.index(i, j)] !== 'ore';
      if (open && Math.hypot(x - hq.x, y - hq.y) > BALANCE.buildRadius + 4) return { x, y };
    }
  throw new Error('no open spot');
}

describe('v0.8 units', () => {
  it('a Mobile Command Vehicle deploys into a Headquarters far from the base', () => {
    const w = new World(config());
    const spot = farSpot(w);
    const mcv = w.createUnit(0, 'mcv', spot.x, spot.y);
    w.updateFog();
    // A normal building may not be placed there…
    expect(w.placementError(0, 'headquarters', Math.round(spot.x - 1.5), Math.round(spot.y - 1.5))).toBe(
      'Too far from your base',
    );
    // …but the vehicle deploys.
    expect(w.issue({ type: 'deploy', player: 0, unit: mcv.id }).ok).toBe(true);
    expect(w.get(mcv.id)).toBeUndefined();
    const hqs = w.playerBuildings(0).filter((b) => b.type === 'headquarters');
    expect(hqs).toHaveLength(2);
    const fwd = hqs.find((b) => !b.complete)!;
    expect(Math.hypot(fwd.x - spot.x, fwd.y - spot.y)).toBeLessThan(1);
    expect(w.players[0].stats.unitsLost).toBe(0);
    // It cannot be cancelled for the HQ price, and it finishes unfolding on its own.
    expect(w.issue({ type: 'cancelBuild', player: 0, building: fwd.id }).ok).toBe(false);
    run(w, 600);
    expect(fwd.complete).toBe(true);
    // New buildings can now be placed around the forward base.
    expect(w.placementError(0, 'power-plant', fwd.tx + 4, fwd.ty)).not.toBe('Too far from your base');
  });

  it('only deployable vehicles deploy, and not onto blocked ground', () => {
    const w = new World(config());
    const tank = w.createUnit(0, 'main-battle-tank', 12.5, 11.5);
    expect(w.issue({ type: 'deploy', player: 0, unit: tank.id }).ok).toBe(false);
    const hq = w.playerBuildings(0)[0];
    // Right next to the existing HQ the footprint overlaps it.
    const mcv = w.createUnit(0, 'mcv', hq.x + 1.5, hq.y);
    const r = w.issue({ type: 'deploy', player: 0, unit: mcv.id });
    expect(r.ok).toBe(false);
    expect(w.get(mcv.id)).toBeDefined();
    // Enemy commanders cannot deploy our vehicle.
    expect(w.issue({ type: 'deploy', player: 1, unit: mcv.id }).ok).toBe(false);
  });

  it('a Fighter Jet shoots down helicopters but cannot attack ground targets', () => {
    const w = new World(config());
    const jet = w.createUnit(0, 'fighter-jet', 14.5, 11.5);
    const heli = w.createUnit(1, 'attack-helicopter', 17.5, 11.5);
    const tank = w.createUnit(1, 'main-battle-tank', 15.5, 12.5);
    w.updateFog();
    expect(w.issue({ type: 'attack', player: 0, units: [jet.id], target: tank.id }).ok).toBe(false);
    heli.order = { type: 'hold' };
    let aimedAtTank = false;
    for (let i = 0; i < 20 * 20; i++) {
      w.step();
      if (jet.targetId === tank.id) aimedAtTank = true;
    }
    expect(heli.dead).toBe(true);
    expect(aimedAtTank).toBe(false);
  });

  it('a Bomber flies over its target and destroys a building with splash damage', () => {
    const w = new World(config());
    const enemyHq = w.playerBuildings(1)[0];
    const bomber = w.createUnit(0, 'bomber', enemyHq.x - 6, enemyHq.y);
    w.updateFog();
    const before = enemyHq.hp;
    expect(w.issue({ type: 'attack', player: 0, units: [bomber.id], target: enemyHq.id }).ok).toBe(true);
    run(w, 20 * 10);
    expect(enemyHq.hp).toBeLessThan(before - 300);
  });
});
