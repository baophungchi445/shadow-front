import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE, RESEARCH, UNITS } from '@shadow-front/game-data';
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

describe('strategic control points', () => {
  it('are captured by ground units, pay income and grant vision', () => {
    const w = new World(config());
    const pt = w.points[0];
    expect(pt.team).toBeNull();
    for (let i = 0; i < 3; i++) w.createUnit(0, 'rifleman', pt.x + i * 0.4, pt.y);
    // 3 units capture 3× faster than one.
    run(w, Math.ceil(BALANCE.pointCaptureTicks / 3) + 20);
    expect(pt.team).toBe(w.players[0].team);
    expect(pt.player).toBe(0);
    expect(w.fog.isVisible(w.players[0].team, pt.x + 5, pt.y)).toBe(true);
    const c0 = w.players[0].credits;
    run(w, 20);
    // HQ trickle (4/s) + point (6/s) for 1 s.
    expect(w.players[0].credits - c0).toBeCloseTo(4 + BALANCE.pointIncome, 0);
  });

  it('must be neutralised before an enemy can take it, and freezes when contested', () => {
    const w = new World(config());
    const pt = w.points[0];
    pt.team = 0;
    pt.player = 0;
    const enemy = w.createUnit(1, 'main-battle-tank', pt.x, pt.y);
    run(w, BALANCE.pointCaptureTicks + 20);
    expect(pt.team).toBeNull(); // neutralised first
    run(w, BALANCE.pointCaptureTicks + 20);
    expect(pt.team).toBe(1);
    // Contested: a defender arrives, progress freezes.
    w.destroy(enemy);
    w.createUnit(1, 'rifleman', pt.x + 1, pt.y);
    w.createUnit(0, 'rifleman', pt.x - 1, pt.y);
    run(w, 30);
    expect(pt.contested).toBe(true);
    expect(pt.team).toBe(1);
  });

  it('air units cannot capture', () => {
    const w = new World(config());
    const pt = w.points[0];
    w.createUnit(0, 'recon-drone', pt.x, pt.y);
    run(w, BALANCE.pointCaptureTicks * 2);
    expect(pt.team).toBeNull();
  });
});

describe('research', () => {
  function withLab() {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const lab = w.createBuilding(0, 'research-center', hq.tx + 4, hq.ty, true);
    w.createBuilding(0, 'power-plant', hq.tx, hq.ty + 4, true);
    w.step();
    return { w, lab };
  }

  it('costs credits, takes time and upgrades existing and new vehicles', () => {
    const { w, lab } = withLab();
    const tank = w.createUnit(0, 'main-battle-tank', 20, 20);
    const inf = w.createUnit(0, 'rifleman', 21, 20);
    const c0 = w.players[0].credits;
    expect(w.issue({ type: 'research', player: 0, building: lab.id, research: 'composite-armor' })).toEqual({
      ok: true,
    });
    expect(w.players[0].credits).toBe(c0 - RESEARCH['composite-armor'].cost);
    expect(w.issue({ type: 'research', player: 0, building: lab.id, research: 'advanced-optics' }).ok).toBe(
      false,
    );
    run(w, RESEARCH['composite-armor'].time + 2);
    expect(w.hasResearch(0, 'composite-armor')).toBe(true);
    expect(tank.maxHp).toBe(Math.round(UNITS['main-battle-tank'].hp * 1.05 * 1.2));
    expect(inf.maxHp).toBe(Math.round(UNITS.rifleman.hp * 1.05));
    const fresh = w.createUnit(0, 'main-battle-tank', 22, 20);
    expect(fresh.maxHp).toBe(tank.maxHp);
    expect(w.issue({ type: 'research', player: 0, building: lab.id, research: 'composite-armor' }).ok).toBe(
      false,
    );
  });

  it('cancel refunds and munitions raise damage', () => {
    const { w, lab } = withLab();
    const c0 = w.players[0].credits;
    w.issue({ type: 'research', player: 0, building: lab.id, research: 'improved-munitions' });
    expect(w.issue({ type: 'cancelResearch', player: 0, building: lab.id }).ok).toBe(true);
    expect(w.players[0].credits).toBe(c0);
    expect(w.damageBonus(0)).toBe(1);
    w.completeResearch(0, 'improved-munitions');
    expect(w.damageBonus(0)).toBeCloseTo(1.15);
  });

  it('requires a completed Research Center', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    expect(w.issue({ type: 'research', player: 0, building: hq.id, research: 'advanced-optics' }).ok).toBe(
      false,
    );
  });
});

describe('repair', () => {
  it('restores HP over time for credits and stops when full', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    expect(w.issue({ type: 'repair', player: 0, building: hq.id, on: true }).ok).toBe(false); // not damaged
    hq.hp = hq.maxHp / 2;
    const c0 = w.players[0].credits;
    expect(w.issue({ type: 'repair', player: 0, building: hq.id, on: true }).ok).toBe(true);
    run(w, 100);
    expect(hq.hp).toBeCloseTo(hq.maxHp / 2 + (hq.maxHp / BALANCE.repairTicks) * 100, 0);
    const spent = c0 - w.players[0].credits + 100 * (4 / 20); // add back HQ income
    expect(spent).toBeCloseTo((hq.def.cost * BALANCE.repairCostRatio * 100) / BALANCE.repairTicks, 0);
    run(w, BALANCE.repairTicks);
    expect(hq.hp).toBe(hq.maxHp);
    expect(hq.repairing).toBe(false);
  });
});

describe('population cap', () => {
  it('blocks production over the cap (queued units count) and frees room when units die', () => {
    const w = new World({ ...config(), unitCap: 10 });
    const hq = w.playerBuildings(0)[0];
    const rax = w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
    // Starting army: 3 riflemen + AT soldier (1 each) + recon vehicle (2) = 6.
    expect(w.supplyUsed(0)).toBe(6);
    for (let i = 0; i < 4; i++)
      expect(w.issue({ type: 'produce', player: 0, producer: rax.id, unit: 'rifleman' }).ok).toBe(true);
    expect(w.supplyUsed(0)).toBe(10);
    const r = w.issue({ type: 'produce', player: 0, producer: rax.id, unit: 'rifleman' });
    expect(r).toEqual({ ok: false, reason: 'Unit limit reached (10)' });
    w.destroy(w.playerUnits(0)[0]);
    expect(w.issue({ type: 'produce', player: 0, producer: rax.id, unit: 'rifleman' }).ok).toBe(true);
  });

  it('is unlimited when not configured', () => {
    const w = new World(config());
    expect(w.unitCap).toBe(0);
    expect(w.overCap(0, 'heavy-tank')).toBe(false);
  });
});

describe('domination', () => {
  it('points score every second and the first team to the target wins', () => {
    const w = new World({ ...config(), mission: 'domination' });
    w.points[0].team = 0;
    w.points[0].player = 0;
    w.points[1].team = 0;
    w.points[1].player = 0;
    run(w, 20 * 10);
    expect(w.scores.get(0)).toBeGreaterThanOrEqual(19);
    expect(w.winningTeam).toBeNull();
    // Hold the points (keep re-asserting ownership against decay) until the target is reached.
    for (let i = 0; i < 20 * 1000 && w.winningTeam === null; i++) {
      w.points[0].team = 0;
      w.points[1].team = 0;
      w.step();
    }
    expect(w.winningTeam).toBe(0);
    expect(w.scores.get(0)).toBeGreaterThanOrEqual(BALANCE.dominationTarget);
  });

  it('random map matches use mapSeed', () => {
    const a = new World({ ...config(), mapId: 'random', mapSeed: 5 });
    const b = new World({ ...config(), mapId: 'random', mapSeed: 6 });
    expect(a.map.tiles).not.toEqual(b.map.tiles);
    expect(a.map.id).toBe('random');
  });
});
