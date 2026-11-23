import { describe, expect, it } from 'vitest';
import { World } from './world';
import { CAMPAIGN, CONVOY_HOLD_TICKS, CONVOY_SITE, getMission, missionTracker, missionUnlocked } from './missions';

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
      'snowfield',
      'forest-warfare',
    ]);
    const before = (id: string) => CAMPAIGN.slice(0, CAMPAIGN.findIndex((m) => m.id === id)).map((m) => m.id);
    expect(missionUnlocked('iron-convoy', before('tidewater'))).toBe(false);
    expect(missionUnlocked('iron-convoy', before('iron-convoy'))).toBe(true);
    expect(missionUnlocked('shadow-front', before('iron-convoy'))).toBe(false);
    expect(missionUnlocked('shadow-front', before('shadow-front'))).toBe(true);
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

  it('Iron Convoy: no base, a convoy and an ambush; escort → deploy → hold 5 min (clock restarts) → destroy (v0.17)', () => {
    const m = getMission('iron-convoy')!;
    const w = new World(m.config('Tester', 2));
    m.setup!(w, 0);
    expect(w.playerBuildings(0)).toEqual([]);
    const own = w.playerUnits(0).map((u) => u.type);
    expect(own).toContain('mcv');
    expect(own.filter((t) => t === 'main-battle-tank').length).toBe(2);
    expect(w.playerUnits(1).some((u) => Math.hypot(u.x - 20, u.y - 20) < 4)).toBe(true); // the ambush
    // With an armed escort the player is not defeated for having no buildings.
    w.step();
    expect(w.players[0].defeated).toBe(false);
    const t = missionTracker(m);
    const ui = { selectedOwnUnits: 0 };
    t.update(w, 0, ui);
    expect(t.index).toBe(0);
    // Drive the MCV to the crossroads and deploy it there.
    const mcv = w.playerUnits(0).find((u) => u.type === 'mcv')!;
    mcv.x = CONVOY_SITE.x;
    mcv.y = CONVOY_SITE.y;
    w.updateFog(); // it saw the way while driving there
    t.update(w, 0, ui);
    expect(t.index).toBe(1);
    const hq = w.deploy(mcv);
    expect(typeof hq).not.toBe('string');
    const base = hq as Exclude<typeof hq, string>;
    base.progress = 1;
    base.complete = true;
    base.hp = base.maxHp;
    t.update(w, 0, ui);
    expect(t.index).toBe(2);
    // Hold: 5 minutes from completion; losing the base restarts the clock.
    for (let i = 0; i < CONVOY_HOLD_TICKS - 100; i++) {
      w.tick++;
      t.update(w, 0, ui);
    }
    expect(t.index).toBe(2);
    w.removeBuilding(base);
    t.update(w, 0, ui);
    expect(w.missionMarks.has('hold:0')).toBe(false);
    const again = w.createBuilding(0, 'headquarters', base.tx, base.ty, true);
    expect(again.complete).toBe(true);
    t.update(w, 0, ui); // the clock starts now
    for (let i = 0; i < CONVOY_HOLD_TICKS - 1; i++) {
      w.tick++;
      t.update(w, 0, ui);
    }
    expect(t.index).toBe(2);
    w.tick++;
    t.update(w, 0, ui);
    expect(t.index).toBe(3);
    // Last: the Iron Guard falls.
    for (const e of [...w.playerBuildings(1), ...w.playerUnits(1)]) w.destroy(e);
    for (let i = 0; i < 40; i++) w.step();
    t.update(w, 0, ui);
    expect(t.finished).toBe(true);
  });

  it('Shadow Front: 2 vs 2 against Hard (adaptive) commanders; all points + both HQs (v0.17)', () => {
    const m = getMission('shadow-front')!;
    const cfg = m.config('Tester', 4);
    expect(cfg.mission).toBe('decapitation');
    expect(cfg.slots.filter((s) => s.team === 1).every((s) => s.difficulty === 'hard')).toBe(true);
    expect(cfg.slots.filter((s) => s.team === 0).length).toBe(2);
    const w = new World(cfg);
    const t = missionTracker(m);
    const ui = { selectedOwnUnits: 0 };
    for (const pt of w.points.slice(0, -1)) pt.team = 0;
    t.update(w, 0, ui);
    expect(t.done).toEqual([false, false]);
    w.points[w.points.length - 1].team = 0;
    t.update(w, 0, ui);
    expect(t.done).toEqual([true, false]);
    // Points lost again: the objective stays done; one HQ is not enough.
    for (const pt of w.points) pt.team = 1;
    w.destroy(w.playerBuildings(2).find((b) => b.type === 'headquarters')!);
    for (let i = 0; i < 40; i++) w.step();
    t.update(w, 0, ui);
    expect(t.done).toEqual([true, false]);
    w.destroy(w.playerBuildings(3).find((b) => b.type === 'headquarters')!);
    for (let i = 0; i < 40; i++) w.step();
    t.update(w, 0, ui);
    expect(t.done).toEqual([true, true]);
    expect(w.winningTeam).toBe(0);
  });
});
