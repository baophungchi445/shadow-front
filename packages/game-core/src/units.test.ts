import { describe, expect, it } from 'vitest';
import type { FactionId, MatchConfig } from '@shadow-front/shared-types';
import { FACTION_IDS, UNITS, UNIT_IDS, availableTo } from '@shadow-front/game-data';
import { World } from './world';

const config = (faction: FactionId = 'western'): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 50000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction, team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

describe('faction-specific units', () => {
  it('every faction has exactly one signature unit', () => {
    for (const f of FACTION_IDS) expect(UNIT_IDS.filter((u) => UNITS[u].faction === f)).toHaveLength(1);
  });

  it('only the owning faction can produce its signature unit', () => {
    const w = new World(config('western'));
    const hq = w.playerBuildings(0)[0];
    const rax = w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
    w.createBuilding(0, 'war-factory', hq.tx + 5, hq.ty + 4, true);
    expect(w.issue({ type: 'produce', player: 0, producer: rax.id, unit: 'ranger' }).ok).toBe(true);
    const wf = w.playerBuildings(0).find((b) => b.type === 'war-factory')!;
    expect(w.issue({ type: 'produce', player: 0, producer: wf.id, unit: 'light-tank' })).toEqual({
      ok: false,
      reason: 'Light Tank is not available to your faction',
    });
    expect(availableTo('light-tank', 'desert')).toBe(true);
    expect(availableTo('rifleman', 'iron')).toBe(true);
  });
});

describe('support units', () => {
  it('medics heal infantry but not vehicles', () => {
    const w = new World(config());
    const medic = w.createUnit(0, 'medic', 30, 30);
    const soldier = w.createUnit(0, 'rifleman', 31, 30);
    const tank = w.createUnit(0, 'main-battle-tank', 30, 31);
    soldier.hp = 40;
    tank.hp = 100;
    run(w, 20 * 3);
    expect(soldier.hp).toBeGreaterThan(40 + 8 * 2.5);
    expect(tank.hp).toBe(100);
    expect(medic.def.weapon).toBeNull();
  });

  it('engineers repair vehicles and buildings, never enemies', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const eng = w.createUnit(0, 'engineer', hq.x + 2.5, hq.y);
    hq.hp = hq.maxHp / 2;
    const half = hq.hp;
    const enemyTank = w.createUnit(1, 'main-battle-tank', hq.x + 3, hq.y + 1);
    enemyTank.hp = 50;
    enemyTank.order = { type: 'hold' };
    run(w, 20 * 2);
    expect(hq.hp).toBeGreaterThan(half);
    expect(enemyTank.dead || enemyTank.hp <= 50).toBe(true);
    expect(eng.def.support?.heals).toBe('mechanical');
  });
});

describe('sniper', () => {
  it('outranges riflemen and kills them in two shots', () => {
    expect(UNITS.sniper.weapon!.range).toBeGreaterThan(UNITS.rifleman.weapon!.range + 3);
    expect(UNITS.sniper.weapon!.damage * 2).toBeGreaterThanOrEqual(UNITS.rifleman.hp);
    expect(UNITS.sniper.weapon!.canTargetAir).toBe(false);
  });
});

describe('v0.6 buildings', () => {
  it('walls block ground movement, radar sees far, missile launchers ignore aircraft', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const wall = w.createBuilding(0, 'wall', hq.tx + 4, hq.ty, true);
    expect(w.grid.walkable(wall.tx, wall.ty)).toBe(false);
    w.createBuilding(0, 'barracks', hq.tx, hq.ty + 8, true);
    expect(w.issue({ type: 'build', player: 0, building: 'wall', tx: hq.tx + 5, ty: hq.ty }).ok).toBe(true);

    const radar = w.createBuilding(0, 'radar-station', hq.tx, hq.ty + 4, true);
    expect(radar.vision).toBeGreaterThanOrEqual(20);
    w.updateFog();
    expect(w.fog.isVisible(0, radar.x + 18, radar.y)).toBe(true);

    // Far from both bases so only the launcher can shoot.
    const ml = w.createBuilding(0, 'missile-launcher', 30, 40, true);
    const heli = w.createUnit(1, 'attack-helicopter', ml.x + 5, ml.y);
    heli.order = { type: 'hold' };
    const tank = w.createUnit(1, 'main-battle-tank', ml.x + 10, ml.y);
    tank.order = { type: 'hold' };
    const heliHp = heli.hp;
    for (let i = 0; i < 20 * 6; i++) {
      w.step();
      heli.x = heli.prevX = ml.x + 5;
      tank.x = tank.prevX = ml.x + 10;
    }
    expect(heli.hp).toBe(heliHp);
    expect(tank.hp).toBeLessThan(tank.maxHp);
  });
});
