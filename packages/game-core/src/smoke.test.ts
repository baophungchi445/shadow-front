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

describe('smoke grenades and critical hits (v0.10)', () => {
  it('a rifleman throws smoke within range; it has a cooldown and fades away', () => {
    const w = new World(config());
    const r = w.createUnit(0, 'rifleman', 12.5, 11.5);
    const tank = w.createUnit(0, 'main-battle-tank', 13.5, 11.5);
    expect(w.issue({ type: 'smoke', player: 0, units: [tank.id], x: 14, y: 12 }).ok).toBe(false);
    const far = w.issue({ type: 'smoke', player: 0, units: [r.id], x: 12.5 + BALANCE.smokeRange + 2, y: 11.5 });
    expect(far.ok).toBe(false);
    expect(w.issue({ type: 'smoke', player: 0, units: [r.id, tank.id], x: 15, y: 12 }).ok).toBe(true);
    expect(w.smokes).toHaveLength(1);
    expect(w.issue({ type: 'smoke', player: 0, units: [r.id], x: 15, y: 13 })).toEqual({
      ok: false,
      reason: 'Smoke grenade not ready',
    });
    run(w, BALANCE.smokeTicks + 25);
    expect(w.smokes).toHaveLength(0);
    run(w, BALANCE.smokeCooldown - BALANCE.smokeTicks);
    expect(w.issue({ type: 'smoke', player: 0, units: [r.id], x: 15, y: 13 }).ok).toBe(true);
  });

  it('units in smoke are hidden from enemies unless one is right next to them', () => {
    const w = new World(config());
    const hidden = w.createUnit(0, 'rifleman', 30.5, 30.5);
    const watcher = w.createUnit(1, 'recon-vehicle', 30.5, 34.5);
    watcher.order = { type: 'hold' };
    run(w, 6);
    expect(w.isVisibleTo(1, hidden)).toBe(true);
    w.smokes.push({ x: 30.5, y: 30.5, radius: BALANCE.smokeRadius, until: w.tick + 400 });
    run(w, 2);
    expect(w.isVisibleTo(1, hidden)).toBe(false);
    expect(w.visibleEnemies(1)).not.toContain(hidden);
    // The owner still sees its own unit; an enemy walking up to it spots it.
    expect(w.isVisibleTo(0, hidden)).toBe(true);
    watcher.x = watcher.prevX = 31.5;
    watcher.y = watcher.prevY = 31.5;
    run(w, 1);
    expect(w.isVisibleTo(1, hidden)).toBe(true);
  });

  it('critical hits happen at about the configured rate', () => {
    const w = new World(config());
    let crits = 0;
    let shots = 0;
    const a = w.createUnit(0, 'rifleman', 30.5, 30.5);
    // A wall does not shoot back.
    const target = w.createBuilding(1, 'wall', 32, 30, true);
    a.order = { type: 'hold' };
    for (let i = 0; i < 20 * 300; i++) {
      target.hp = target.maxHp;
      w.step();
      for (const e of w.drainEvents()) {
        if (e.type === 'shot' && e.from === a.id) shots++;
        if (e.type === 'crit') crits++;
      }
    }
    expect(shots).toBeGreaterThan(150);
    const rate = crits / shots;
    expect(rate).toBeGreaterThan(BALANCE.critChance * 0.4);
    expect(rate).toBeLessThan(BALANCE.critChance * 2.5);
  });
});
