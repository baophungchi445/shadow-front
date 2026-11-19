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
    ]);
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
});
