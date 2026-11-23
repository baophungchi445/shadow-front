import { describe, expect, it } from 'vitest';
import { World } from './world';
import { CAMPAIGN, getMission, missionTracker, missionUnlocked } from './missions';

describe('campaign', () => {
  it('every mission builds a valid world', () => {
    for (const m of CAMPAIGN) {
      const cfg = m.config('Tester', 3);
      expect(cfg.campaignMission).toBe(m.id);
      const w = new World(cfg);
      expect(w.players[0].name).toBe('Tester');
      expect(m.objectives.length).toBeGreaterThan(0);
    }
  });

  it('unlocks missions in order', () => {
    expect(missionUnlocked('boot-camp', [])).toBe(true);
    expect(missionUnlocked('hold-the-river', [])).toBe(false);
    expect(missionUnlocked('hold-the-river', ['boot-camp'])).toBe(true);
    expect(missionUnlocked('iron-fist', ['boot-camp'])).toBe(false);
    expect(missionUnlocked('nope', ['boot-camp'])).toBe(false);
    expect(missionUnlocked('highland-siege', ['boot-camp', 'hold-the-river', 'iron-fist'])).toBe(true);
    expect(CAMPAIGN.map((m) => m.config('x', 1).mapId)).toEqual([
      'desert-storm',
      'river-crossing',
      'urban-conflict',
      'highland-pass',
      'strait-crossing',
    ]);
    expect(missionUnlocked('tidewater', ['boot-camp', 'hold-the-river', 'iron-fist'])).toBe(false);
    expect(missionUnlocked('tidewater', ['boot-camp', 'hold-the-river', 'iron-fist', 'highland-siege'])).toBe(true);
  });

  it('unordered objectives complete independently and stay complete', () => {
    const m = getMission('hold-the-river')!;
    const w = new World(m.config('T', 1));
    const t = missionTracker(m);
    const ui = { selectedOwnUnits: 0 };
    const bridge = w.points.find((p) => p.name === 'Central Bridge')!;
    bridge.team = 0;
    expect(t.update(w, 0, ui).map((o) => o.id)).toEqual(['bridge']);
    bridge.team = null; // lost again: the objective stays done
    const hq = w.playerBuildings(0)[0];
    w.createBuilding(0, 'defense-turret', hq.tx + 4, hq.ty + 4, true);
    expect(t.update(w, 0, ui).map((o) => o.id)).toEqual(['turret']);
    expect(t.done).toEqual([true, true, false]);
    expect(t.finished).toBe(false);
  });

  it('Iron Fist is won only when both enemy HQs fall', () => {
    const m = getMission('iron-fist')!;
    const w = new World(m.config('T', 1));
    const t = missionTracker(m);
    const ui = { selectedOwnUnits: 0 };
    const hqOf = (pid: number) => w.playerBuildings(pid).find((b) => b.type === 'headquarters')!;
    w.destroy(hqOf(2));
    for (let i = 0; i < 40; i++) w.step();
    expect(t.update(w, 0, ui).map((o) => o.id)).not.toContain('hqs');
    expect(w.winningTeam).toBeNull();
    w.destroy(hqOf(3));
    for (let i = 0; i < 40; i++) w.step();
    expect(t.update(w, 0, ui).map((o) => o.id)).toContain('hqs');
    expect(w.winningTeam).toBe(0);
  });

  it('Tidewater: Naval Yard, 3 sunk enemy ships and the South Shore are tracked (v0.16)', () => {
    const m = getMission('tidewater')!;
    const w = new World(m.config('T', 1));
    const t = missionTracker(m);
    const ui = { selectedOwnUnits: 0 };
    // The player starts on the north shore, the enemy on the south shore.
    expect(w.playerBuildings(0)[0].y).toBeLessThan(32);
    expect(w.playerBuildings(1)[0].y).toBeGreaterThan(32);
    expect(t.update(w, 0, ui)).toEqual([]);
    const hq = w.playerBuildings(0)[0];
    w.createBuilding(0, 'naval-yard', hq.tx + 4, hq.ty, true);
    expect(t.update(w, 0, ui).map((o) => o.id)).toEqual(['yard']);
    // Two sunk ships and a dead tank do not count; the third ship does.
    for (const type of ['patrol-boat', 'destroyer', 'main-battle-tank'] as const)
      w.destroy(w.createUnit(1, type, 32.5, 32.5));
    expect(t.update(w, 0, ui)).toEqual([]);
    w.destroy(w.createUnit(1, 'submarine', 32.5, 32.5));
    expect(t.update(w, 0, ui).map((o) => o.id)).toEqual(['sink']);
    w.points.find((p) => p.name === 'South Shore')!.team = 0;
    expect(t.update(w, 0, ui).map((o) => o.id)).toEqual(['beach']);
    expect(t.done).toEqual([true, true, true, false]);
  });
});

