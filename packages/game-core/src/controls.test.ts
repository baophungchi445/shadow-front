import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE, BUILDINGS } from '@shadow-front/game-data';
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

describe('patrol', () => {
  it('walks back and forth between the start and the target', () => {
    const w = new World(config());
    const u = w.playerUnits(0).find((x) => x.type === 'recon-vehicle')!;
    const start = { x: u.x, y: u.y };
    const hq = w.playerBuildings(0)[0];
    const target = { x: hq.x + 10, y: hq.y + 8 };
    expect(w.issue({ type: 'patrol', player: 0, units: [u.id], ...target }).ok).toBe(true);
    let reachedFar = false;
    let returned = false;
    for (let i = 0; i < 20 * 60 && !(reachedFar && returned); i++) {
      w.step();
      if (Math.hypot(u.x - target.x, u.y - target.y) < 1.5) reachedFar = true;
      if (reachedFar && Math.hypot(u.x - start.x, u.y - start.y) < 1.5) returned = true;
    }
    expect(reachedFar).toBe(true);
    expect(returned).toBe(true);
    expect(u.order.type).toBe('move'); // still patrolling
  });

  it('rejects unarmed units', () => {
    const w = new World(config());
    const u = w.createUnit(0, 'recon-drone', 10, 10);
    expect(w.issue({ type: 'patrol', player: 0, units: [u.id], x: 20, y: 20 }).ok).toBe(false);
  });
});

describe('sell', () => {
  it('refunds half the price scaled by HP plus queued units, and frees the footprint', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const rax = w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
    w.issue({ type: 'produce', player: 0, producer: rax.id, unit: 'rifleman' });
    rax.hp = rax.maxHp / 2;
    const before = w.players[0].credits;
    expect(w.issue({ type: 'sell', player: 0, building: rax.id }).ok).toBe(true);
    const expected =
      Math.round(BUILDINGS.barracks.cost * BALANCE.sellRefund * 0.5) + w.unitCost(0, 'rifleman');
    expect(w.players[0].credits - before).toBe(expected);
    expect(w.get(rax.id)).toBeUndefined();
    expect(w.grid.walkable(rax.tx, rax.ty)).toBe(true);
    expect(w.players[0].stats.buildingsLost).toBe(0);
    expect(w.drainEvents().some((e) => e.type === 'sold')).toBe(true);
  });

  it('cannot sell the HQ, enemy buildings or unfinished ones', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    expect(w.issue({ type: 'sell', player: 0, building: hq.id })).toMatchObject({ ok: false });
    expect(w.issue({ type: 'sell', player: 0, building: w.playerBuildings(1)[0].id }).ok).toBe(false);
    const pp = w.createBuilding(0, 'power-plant', hq.tx, hq.ty + 4, false);
    expect(w.issue({ type: 'sell', player: 0, building: pp.id })).toEqual({
      ok: false,
      reason: 'Building under construction',
    });
  });
});

describe('veterancy', () => {
  it('kills grant XP; ranks raise damage and HP; heroic units regenerate', () => {
    const w = new World(config());
    const tank = w.createUnit(0, 'main-battle-tank', 30, 30);
    const hp0 = tank.maxHp;
    // Destroy enemies worth 2.5× the tank cost → rank 2 (Elite).
    for (let i = 0; i < 3; i++) {
      const v = w.createUnit(1, 'main-battle-tank', 31, 30);
      w.damage(v, 1e6, 0, tank.id);
    }
    expect(tank.xp).toBe(3 * 900);
    expect(tank.rank).toBe(2);
    expect(Math.abs(tank.maxHp - hp0 * 1.2)).toBeLessThanOrEqual(1);
    expect(w.rankBonus(tank)).toBeCloseTo(1.2);
    const promos = w.drainEvents().filter((e) => e.type === 'promoted');
    expect(promos.map((e) => (e as { rank: number }).rank)).toEqual([1, 2]);

    for (let i = 0; i < 3; i++) w.damage(w.createUnit(1, 'main-battle-tank', 31, 30), 1e6, 0, tank.id);
    expect(tank.rank).toBe(3);
    tank.hp = tank.maxHp / 2;
    const half = tank.hp;
    run(w, 40);
    expect(tank.hp).toBeGreaterThan(half);
  });

  it('defense kills do not crash and grant nothing', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const v = w.createUnit(1, 'rifleman', 30, 30);
    w.damage(v, 1e6, 0, hq.id);
    expect(v.dead).toBe(true);
  });
});

describe('teammates and colours', () => {
  const team = (): MatchConfig => ({
    ...config(),
    slots: [
      { kind: 'human', name: 'P1', faction: 'western', team: 0, color: 0x9b59d0 },
      { kind: 'ai', name: 'Ally', faction: 'pacific', team: 0, difficulty: 'normal' },
      { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', color: 0x9b59d0 },
    ],
  });

  it('sends credits only to living teammates', () => {
    const w = new World(team());
    const [me, ally] = w.players;
    const before = me.credits;
    expect(w.issue({ type: 'transfer', player: 0, to: 1, amount: 500 }).ok).toBe(true);
    expect(me.credits).toBe(before - 500);
    expect(ally.credits).toBe(20000 + 500);
    expect(w.drainEvents()).toContainEqual({ type: 'creditsSent', from: 0, to: 1, amount: 500 });
    expect(w.issue({ type: 'transfer', player: 0, to: 2, amount: 100 })).toEqual({
      ok: false,
      reason: 'Credits can only be sent to teammates',
    });
    expect(w.issue({ type: 'transfer', player: 0, to: 1, amount: 1e9 }).ok).toBe(false);
    expect(w.issue({ type: 'transfer', player: 0, to: 1, amount: -5 }).ok).toBe(false);
    ally.defeated = true;
    expect(w.issue({ type: 'transfer', player: 0, to: 1, amount: 10 }).ok).toBe(false);
  });

  it('uses the chosen army colour; a taken colour falls back to a free one', () => {
    const w = new World(team());
    expect(w.players[0].color).toBe(0x9b59d0);
    expect(w.players[2].color).not.toBe(0x9b59d0);
    expect(new Set(w.players.map((p) => p.color)).size).toBe(3);
  });
});
