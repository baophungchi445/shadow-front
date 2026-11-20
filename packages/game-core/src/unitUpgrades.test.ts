import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { UNIT_UPGRADE, unitUpgradeCost } from '@shadow-front/game-data';
import { World } from './world';

const config: MatchConfig = {
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 20000,
  seed: 3,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
};

const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

function setup() {
  const w = new World(config);
  const hq = w.playerBuildings(0)[0];
  w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
  const barracks = w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
  return { w, hq, barracks };
}

describe('unit upgrades', () => {
  it('cost scales with the unit price and has a floor', () => {
    expect(unitUpgradeCost('rifleman')).toBe(UNIT_UPGRADE.minCost);
    expect(unitUpgradeCost('main-battle-tank')).toBeGreaterThan(unitUpgradeCost('rifleman'));
    expect(unitUpgradeCost('main-battle-tank') % 50).toBe(0);
  });

  it('upgrades existing and new units of that type only, after the upgrade time', () => {
    const { w, hq, barracks } = setup();
    const rifle = w.playerUnits(0).find((u) => u.type === 'rifleman')!;
    const other = w.createUnit(0, 'at-soldier', hq.x + 5, hq.y + 5);
    const passenger = w.createUnit(0, 'rifleman', hq.x + 6, hq.y + 6);
    const apc = w.createUnit(0, 'apc', hq.x + 6, hq.y + 7);
    w.board(passenger, apc);
    const hp0 = rifle.maxHp;
    const enemyHp0 = w.createUnit(1, 'rifleman', 40, 41).maxHp;
    const dmg0 = rifle.damageMul;
    const credits = w.players[0].credits;
    expect(w.issue({ type: 'upgradeUnit', player: 0, building: barracks.id, unit: 'rifleman' }).ok).toBe(
      true,
    );
    expect(w.players[0].credits).toBe(credits - unitUpgradeCost('rifleman'));
    run(w, UNIT_UPGRADE.time - 5);
    expect(w.hasUnitUpgrade(0, 'rifleman')).toBe(false);
    run(w, 10);
    expect(w.hasUnitUpgrade(0, 'rifleman')).toBe(true);
    expect(rifle.maxHp).toBe(Math.round(hp0 * UNIT_UPGRADE.hp));
    expect(rifle.damageMul).toBeCloseTo(dmg0 * UNIT_UPGRADE.damage);
    expect(passenger.maxHp).toBe(Math.round(hp0 * UNIT_UPGRADE.hp));
    expect(other.damageMul).toBe(1);
    const fresh = w.createUnit(0, 'rifleman', hq.x + 4, hq.y + 6);
    expect(fresh.maxHp).toBe(rifle.maxHp);
    expect(fresh.damageMul).toBeCloseTo(rifle.damageMul);
    // The enemy is not affected.
    expect(w.createUnit(1, 'rifleman', 40, 40).maxHp).toBe(enemyHp0);
  });

  it('refuses wrong building, other faction, duplicates; cancel refunds', () => {
    const { w, hq, barracks } = setup();
    const factory = w.createBuilding(0, 'war-factory', hq.tx + 8, hq.ty + 4, true);
    expect(
      w.issue({ type: 'upgradeUnit', player: 0, building: barracks.id, unit: 'main-battle-tank' }).ok,
    ).toBe(false);
    expect(w.issue({ type: 'upgradeUnit', player: 0, building: barracks.id, unit: 'ranger' }).ok).toBe(true);
    expect(w.issue({ type: 'upgradeUnit', player: 0, building: barracks.id, unit: 'rifleman' })).toEqual({
      ok: false,
      reason: 'Upgrade in progress',
    });
    const credits = w.players[0].credits;
    expect(w.issue({ type: 'cancelUnitUpgrade', player: 0, building: barracks.id }).ok).toBe(true);
    expect(w.players[0].credits).toBe(credits + unitUpgradeCost('ranger'));
    expect(
      w.issue({ type: 'upgradeUnit', player: 0, building: factory.id, unit: 'main-battle-tank' }).ok,
    ).toBe(true);
    run(w, UNIT_UPGRADE.time + 5);
    expect(
      w.issue({ type: 'upgradeUnit', player: 0, building: factory.id, unit: 'main-battle-tank' }),
    ).toEqual({
      ok: false,
      reason: 'Already upgraded',
    });
  });
});
