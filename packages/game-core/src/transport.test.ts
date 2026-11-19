import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
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

describe('transports', () => {
  it('infantry board an APC, ride along and unload next to it', () => {
    const w = new World(config());
    // Open ground next to the western base (Desert Storm has a rock ridge around (18..27, 14..23)).
    const apc = w.createUnit(0, 'apc', 12.5, 11.5);
    const inf = [0, 1, 2].map((i) => w.createUnit(0, 'rifleman', 14.5 + i * 0.5, 11.5));
    const tank = w.createUnit(0, 'main-battle-tank', 13.5, 13.5);
    expect(
      w.issue({ type: 'load', player: 0, units: [...inf, tank].map((u) => u.id), carrier: apc.id }).ok,
    ).toBe(true);
    expect(tank.order.type).not.toBe('board'); // only infantry
    run(w, 20 * 4);
    expect(apc.passengers).toHaveLength(3);
    for (const u of inf) expect(w.get(u.id)).toBeUndefined();
    // Passengers still count toward the population cap.
    const onMap = w.playerUnits(0).reduce((s, u) => s + (u.type === 'rifleman' ? 1 : 0), 0);
    expect(onMap).toBe(3); // the 3 starting riflemen; the 3 passengers are not on the map

    w.issue({ type: 'move', player: 0, units: [apc.id], x: 16.5, y: 15.5 });
    run(w, 20 * 10);
    expect(w.issue({ type: 'unload', player: 0, carrier: apc.id }).ok).toBe(true);
    expect(apc.passengers).toHaveLength(0);
    for (const u of inf) {
      expect(w.get(u.id)).toBe(u);
      expect(Math.hypot(u.x - apc.x, u.y - apc.y)).toBeLessThan(3);
    }
  });

  it('respects capacity and dies with the passengers', () => {
    const w = new World(config());
    const apc = w.createUnit(0, 'apc', 12.5, 11.5);
    const inf = Array.from({ length: 7 }, (_, i) =>
      w.createUnit(0, 'rifleman', 13.5 + (i % 3) * 0.4, 12 + i * 0.3),
    );
    w.issue({ type: 'load', player: 0, units: inf.map((u) => u.id), carrier: apc.id });
    run(w, 20 * 5);
    expect(apc.passengers).toHaveLength(5);
    expect(w.issue({ type: 'load', player: 0, units: [inf[6].id], carrier: apc.id })).toEqual({
      ok: false,
      reason: 'Transport is full',
    });
    const lost = w.players[0].stats.unitsLost;
    w.destroy(apc);
    expect(w.players[0].stats.unitsLost).toBe(lost + 6);
  });

  it('the transport helicopter cannot unload over water', () => {
    const w = new World(config());
    const heli = w.createUnit(0, 'transport-helicopter', 14.5, 30.5); // Desert Storm oasis
    heli.passengers.push(w.createUnit(0, 'rifleman', 14.5, 30.5));
    w.entities.delete(heli.passengers[0].id);
    expect(w.map.tiles[30 * 64 + 14]).toBe('water');
    expect(w.issue({ type: 'unload', player: 0, carrier: heli.id })).toEqual({
      ok: false,
      reason: 'No open ground below to unload',
    });
    heli.x = 12.5;
    heli.y = 11.5;
    expect(w.issue({ type: 'unload', player: 0, carrier: heli.id }).ok).toBe(true);
  });
});

describe('bunker', () => {
  it('is silent when empty, fires harder with more occupants, ejects them when destroyed', () => {
    const w = new World(config());
    const bunker = w.createBuilding(0, 'bunker', 30, 30, true);
    const enemy = w.createUnit(1, 'heavy-tank', 35, 31);
    enemy.order = { type: 'hold' };
    enemy.hp = enemy.maxHp = 1e6; // a punching bag
    run(w, 20 * 3);
    expect(enemy.hp).toBe(1e6);

    const inf = [0, 1, 2, 3].map((i) => w.createUnit(0, 'rifleman', 29 + i * 0.4, 29));
    w.issue({ type: 'load', player: 0, units: inf.map((u) => u.id), carrier: bunker.id });
    run(w, 20 * 3);
    expect(bunker.passengers).toHaveLength(4);
    const hp0 = enemy.hp;
    run(w, 20 * 5);
    const dmg4 = hp0 - enemy.hp;
    expect(dmg4).toBeGreaterThan(0);

    w.destroy(bunker);
    for (const u of inf) {
      expect(u.dead).toBe(false);
      expect(w.get(u.id)).toBe(u);
    }
  });

  it('only infantry may garrison; selling releases occupants', () => {
    const w = new World(config());
    const bunker = w.createBuilding(0, 'bunker', 30, 30, true);
    const tank = w.createUnit(0, 'main-battle-tank', 29, 29);
    expect(w.issue({ type: 'load', player: 0, units: [tank.id], carrier: bunker.id }).ok).toBe(false);
    const u = w.createUnit(0, 'rifleman', 29, 29);
    w.issue({ type: 'load', player: 0, units: [u.id], carrier: bunker.id });
    run(w, 20 * 3);
    expect(bunker.passengers).toHaveLength(1);
    expect(w.issue({ type: 'sell', player: 0, building: bunker.id }).ok).toBe(true);
    expect(w.get(u.id)).toBe(u);
  });
});
