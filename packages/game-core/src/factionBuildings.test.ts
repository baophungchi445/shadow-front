import { describe, expect, it } from 'vitest';
import type { FactionId, MatchConfig } from '@shadow-front/shared-types';
import { BUILDABLE, BUILDINGS, FACTION_IDS, factionBuilding } from '@shadow-front/game-data';
import { World } from './world';

const config = (faction: FactionId): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 20000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction, team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

/** Places prerequisites + power next to the HQ so faction buildings can be built. */
function base(w: World) {
  const hq = w.playerBuildings(0)[0];
  w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
  w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty + 3, true);
  w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
  w.createBuilding(0, 'war-factory', hq.tx + 7, hq.ty, true);
  run(w, 1);
  return hq;
}

describe('faction buildings (v0.10)', () => {
  it('every faction has exactly one own building, buildable only by that faction', () => {
    for (const f of FACTION_IDS) {
      const own = BUILDABLE.filter((b) => BUILDINGS[b].faction === f);
      expect(own).toHaveLength(1);
      expect(factionBuilding(f)).toBe(own[0]);
    }
    const w = new World(config('western'));
    const hq = base(w);
    expect(w.issue({ type: 'build', player: 0, building: 'bastion', tx: hq.tx + 1, ty: hq.ty + 8 }).ok).toBe(false);
    expect(w.issue({ type: 'build', player: 0, building: 'field-hospital', tx: hq.tx + 1, ty: hq.ty + 8 }).ok).toBe(true);
  });

  it('a Field Hospital heals all wounded infantry around it, not vehicles', () => {
    const w = new World(config('western'));
    const hq = base(w);
    const h = w.createBuilding(0, 'field-hospital', hq.tx + 1, hq.ty + 8, true);
    const a = w.createUnit(0, 'rifleman', h.x + 2, h.y);
    const b = w.createUnit(0, 'rifleman', h.x - 2, h.y + 1);
    const tank = w.createUnit(0, 'main-battle-tank', h.x, h.y + 2.5);
    for (const u of [a, b, tank]) u.hp = u.maxHp / 2;
    run(w, 20 * 5);
    expect(a.hp).toBeGreaterThan(a.maxHp / 2 + 15);
    expect(b.hp).toBeGreaterThan(b.maxHp / 2 + 15);
    expect(tank.hp).toBe(tank.maxHp / 2);
  });

  it('a Repair Bay repairs vehicles and buildings', () => {
    const w = new World(config('pacific'));
    const hq = base(w);
    const bay = w.createBuilding(0, 'repair-bay', hq.tx + 1, hq.ty + 8, true);
    const tank = w.createUnit(0, 'main-battle-tank', bay.x + 2, bay.y);
    tank.hp = 100;
    run(w, 20 * 5);
    expect(tank.hp).toBeGreaterThan(150);
  });

  it('an Oil Derrick earns credits without ore', () => {
    const w = new World(config('desert'));
    const hq = base(w);
    const before = w.players[0].stats.creditsEarned;
    run(w, 20 * 10);
    const baseline = w.players[0].stats.creditsEarned - before;
    const d = w.createBuilding(0, 'oil-derrick', hq.tx + 1, hq.ty + 8, true);
    expect(d.oreTiles).toEqual([]);
    const mid = w.players[0].stats.creditsEarned;
    run(w, 20 * 10);
    expect(w.players[0].stats.creditsEarned - mid).toBeCloseTo(baseline + 40, 0);
  });

  it('a Howitzer shells enemies 10 tiles away', () => {
    const w = new World(config('eastern'));
    const hq = base(w);
    const how = w.createBuilding(0, 'howitzer', hq.tx + 1, hq.ty + 8, true);
    const far = w.createUnit(1, 'main-battle-tank', how.x + 10, how.y);
    far.order = { type: 'hold' };
    const fogBefore = far.hp;
    // Reveal the target (the howitzer itself only sees 7 tiles).
    w.createUnit(0, 'recon-drone', far.x - 1, far.y);
    w.updateFog();
    run(w, 20 * 15);
    expect(far.dead || far.hp < fogBefore).toBe(true);
  });
});
