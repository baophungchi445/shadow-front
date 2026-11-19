import { describe, expect, it } from 'vitest';
import { World } from './world';
import { TUTORIAL_STEPS, TutorialTracker, tutorialConfig } from './tutorial';

describe('tutorial', () => {
  it('uses a fixed 1v1 setup against an enemy far away', () => {
    const w = new World(tutorialConfig());
    expect(w.mission).toBe('tutorial');
    expect(w.players).toHaveLength(2);
    const [me, enemy] = w.players.map((p) => w.playerBuildings(p.id)[0]);
    expect(Math.hypot(me.x - enemy.x, me.y - enemy.y)).toBeGreaterThan(40);
  });

  it('completes objectives strictly in order', () => {
    const w = new World(tutorialConfig());
    const t = new TutorialTracker();
    const ui = { selectedOwnUnits: 0 };
    // Building a power plant first does not skip "select" and "move".
    const hq = w.playerBuildings(0)[0];
    w.createBuilding(0, 'power-plant', hq.tx, hq.ty + 4, true);
    expect(t.update(w, 0, ui)).toHaveLength(0);
    expect(t.current?.id).toBe('select');

    ui.selectedOwnUnits = 2;
    expect(t.update(w, 0, ui).map((s) => s.id)).toEqual(['select']);
    const units = w.playerUnits(0);
    w.issue({
      type: 'move',
      player: 0,
      units: units.map((u) => u.id),
      x: hq.x + 6,
      y: hq.y + 6,
      attackMove: false,
    });
    // move → power (already built) complete together.
    expect(t.update(w, 0, ui).map((s) => s.id)).toEqual(['move', 'power']);
    expect(t.current?.id).toBe('extractor');
  });

  it('finishes when the enemy outpost is destroyed', () => {
    const w = new World(tutorialConfig());
    const t = new TutorialTracker();
    t.index = TUTORIAL_STEPS.findIndex((s) => s.id === 'destroy');
    expect(t.update(w, 0, { selectedOwnUnits: 0 })).toHaveLength(0);
    for (const e of [...w.playerBuildings(1), ...w.playerUnits(1)]) w.destroy(e);
    for (let i = 0; i < 20; i++) w.step();
    expect(t.update(w, 0, { selectedOwnUnits: 0 }).map((s) => s.id)).toEqual(['destroy']);
    expect(t.finished).toBe(true);
    expect(w.winningTeam).toBe(0);
  });
});
