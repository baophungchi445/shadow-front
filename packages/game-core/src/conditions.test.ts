import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE, UNITS } from '@shadow-front/game-data';
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

describe('burning and suppression (v0.9)', () => {
  it('incendiary hits keep burning a target for the weapon duration', () => {
    const w = new World(config());
    const target = w.playerBuildings(1)[0];
    const weapon = UNITS['missile-system'].weapon!;
    w.applyHitEffects(target, weapon, 0, 0);
    expect(target.burn).toMatchObject({ dps: weapon.burn!.dps, owner: 0 });
    const hp = target.hp;
    run(w, 20 * weapon.burn!.seconds + 5);
    expect(hp - target.hp).toBeCloseTo(weapon.burn!.dps * weapon.burn!.seconds, 0);
    expect(target.burn).toBeNull();
  });

  it('aircraft do not catch fire; re-ignition refreshes rather than stacks', () => {
    const w = new World(config());
    const heli = w.createUnit(1, 'attack-helicopter', 30.5, 30.5);
    w.applyHitEffects(heli, UNITS['missile-system'].weapon!, 0, 0);
    expect(heli.burn).toBeNull();
    const inf = w.createUnit(1, 'rifleman', 30.5, 31.5);
    w.applyHitEffects(inf, UNITS['rocket-launcher'].weapon!, 0, 0);
    w.applyHitEffects(inf, UNITS['rocket-launcher'].weapon!, 0, 0);
    expect(inf.burn!.ticks).toBe(UNITS['rocket-launcher'].weapon!.burn!.seconds * 20);
  });

  it('suppressed infantry move and fire slower, then recover', () => {
    const w = new World(config());
    const a = w.createUnit(0, 'rifleman', 12.5, 11.5);
    const b = w.createUnit(0, 'rifleman', 12.5, 13.5);
    const bullet = UNITS.rifleman.weapon!;
    w.applyHitEffects(a, bullet, 60, 1);
    expect(w.isSuppressed(a)).toBe(true);
    expect(w.isSuppressed(b)).toBe(false);
    // Rockets do not suppress; vehicles are never suppressed.
    w.applyHitEffects(b, UNITS['at-soldier'].weapon!, 60, 1);
    expect(b.suppression).toBe(0);
    const tank = w.createUnit(0, 'main-battle-tank', 14.5, 11.5);
    w.applyHitEffects(tank, bullet, 60, 1);
    expect(tank.suppression).toBe(0);

    w.issue({ type: 'move', player: 0, units: [a.id, b.id], x: 12.5, y: 30.5 });
    const ya = a.y;
    const yb = b.y;
    run(w, 20);
    expect(a.y - ya).toBeLessThan((b.y - yb) * 0.75);
    // Suppression wears off.
    run(w, Math.ceil(60 / BALANCE.suppressionDecay));
    expect(w.isSuppressed(a)).toBe(false);
  });

  it('the Long-range Missile System outranges every other ground weapon but cannot fire up close', () => {
    const ms = UNITS['missile-system'];
    const others = Object.values(UNITS).filter((u) => u.id !== ms.id && u.weapon && u.category !== 'air');
    for (const u of others) expect(ms.weapon!.range).toBeGreaterThan(u.weapon!.range);
    expect(ms.weapon!.minRange).toBeGreaterThanOrEqual(5);
    expect(ms.requires).toContain('radar-station');
  });
});
