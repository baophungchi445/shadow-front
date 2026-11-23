import { describe, expect, it } from 'vitest';
import type { BuildingTypeId, Difficulty, GameEvent } from '@shadow-front/shared-types';
import { World, type Unit } from '@shadow-front/game-core';
import {
  Adaptation,
  NO_HABITS,
  rememberedStyles,
  sanitizeHabits,
  updateHabits,
  type StyleSignals,
} from './adaptation';
import { AICommander } from './commander';

const MIN = 1200;
const bad = (tick: number, x = 50, y = 50) => ({ tick, x, y, sent: 3000, dealt: 300, lost: 2800 });
const good = (tick: number) => ({ tick, x: 50, y: 50, sent: 3000, dealt: 2500, lost: 600 });
const signals = (o: Partial<StyleSignals> = {}): StyleSignals => ({
  tick: 6 * MIN,
  firstAssaultTick: null,
  enemyDefenses: 0,
  seenUnits: 10,
  seenAir: 0,
  seenShips: 0,
  ...o,
});

describe('Adaptation rules (v0.17)', () => {
  it('Easy never adapts', () => {
    const a = new Adaptation('easy');
    expect(a.recordAttack(bad(MIN))).toEqual([]);
    expect(a.observe(signals({ enemyDefenses: 9 }))).toEqual([]);
    expect(a.patience).toBe(1);
  });

  it('a failed attack makes it patient; a second failure at the same place makes it switch target', () => {
    const a = new Adaptation('normal');
    expect(a.recordAttack(bad(5 * MIN))).toEqual(['patience']);
    expect(a.patience).toBeCloseTo(1.3);
    expect(a.targetPenalty(50, 50, 6 * MIN)).toBe(0);
    // Same place 3 minutes later: patience again (throttle passed) and switch target.
    expect(a.recordAttack(bad(8 * MIN, 52, 49))).toEqual(['patience', 'switch-target']);
    expect(a.targetPenalty(51, 51, 9 * MIN)).toBeGreaterThan(0);
    expect(a.targetPenalty(10, 10, 9 * MIN)).toBe(0);
    expect(a.targetPenalty(51, 51, 14 * MIN)).toBe(0); // forgotten after 5 minutes
    // Patience is capped.
    for (let i = 0; i < 10; i++) a.recordAttack(bad((20 + i * 3) * MIN, 10 + i * 20, 10));
    expect(a.patience).toBe(2);
  });

  it('a successful attack makes it press on sooner and relaxes patience', () => {
    const a = new Adaptation('normal');
    a.recordAttack(bad(5 * MIN));
    expect(a.recordAttack(good(9 * MIN))).toEqual(['press']);
    expect(a.cooldownFactor).toBe(0.7);
    expect(a.patience).toBeCloseTo(1);
    expect(a.recordAttack(good(12 * MIN))).toEqual([]); // already pressing: nothing new to announce
  });

  it('tiny groups teach nothing; the same tactic is not announced twice within 2 minutes', () => {
    const a = new Adaptation('hard');
    expect(a.recordAttack({ ...bad(MIN), sent: 300 })).toEqual([]);
    expect(a.recordAttack(bad(5 * MIN))).toEqual(['patience']);
    expect(a.recordAttack(bad(6 * MIN, 10, 10))).toEqual([]); // within 2 min: learned silently
    expect(a.patience).toBeCloseTo(1.69);
    expect(a.log.map((e) => e.tactic)).toEqual(['patience']);
  });

  it('Normal does not read play styles; Hard does, each style once', () => {
    expect(new Adaptation('normal').observe(signals({ enemyDefenses: 9 }))).toEqual([]);
    const a = new Adaptation('hard');
    expect(a.observe(signals({ firstAssaultTick: 3 * MIN }))).toEqual(['anti-rush']);
    expect(a.observe(signals({ firstAssaultTick: 3 * MIN }))).toEqual([]);
    expect(a.observe(signals({ enemyDefenses: 3 }))).toEqual([]);
    expect(a.observe(signals({ enemyDefenses: 4 }))).toEqual(['siege']);
    expect(a.observe(signals({ seenUnits: 10, seenAir: 4 }))).toEqual(['anti-air']);
    expect(a.observe(signals({ seenShips: 3 }))).toEqual(['anti-naval']);
    expect([...a.styles].sort()).toEqual(['air', 'naval', 'rush', 'turtle']);
  });

  it('Insane reads styles sooner', () => {
    const read = (d: Difficulty) =>
      new Adaptation(d).observe(signals({ enemyDefenses: 3, firstAssaultTick: 6 * MIN }));
    expect(read('hard')).toEqual([]);
    expect(read('insane').sort()).toEqual(['anti-rush', 'siege']);
  });
});

type Internals = {
  known: Map<number, { id: number; x: number; y: number; type: string }>;
  attackThreshold(): number;
  unitScore(t: string): number;
  nextBuilding(): BuildingTypeId | null;
  minArmy(): number;
  launchAttack(home: Unit[], target: { x: number; y: number }, joined: boolean): void;
};

/** 1v1 on Desert Storm: P0 is the AI under test, P1 a passive opponent we script. */
function duel(difficulty: Difficulty = 'hard') {
  const world = new World({
    mapId: 'desert-storm',
    mission: 'annihilation',
    startingCredits: 20000,
    seed: 5,
    slots: [
      { kind: 'ai', name: 'AI', faction: 'western', team: 0, difficulty, personality: 'warlord' },
      { kind: 'human', name: 'You', faction: 'western', team: 1 },
    ],
  });
  const ai = new AICommander(world, 0);
  return { world, ai, int: ai as unknown as Internals };
}

function run(world: World, ai: AICommander, ticks: number): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    ai.update();
    world.step();
    out.push(...world.drainEvents().filter((e) => e.type === 'aiAdapted'));
  }
  return out;
}

/** Places `type` for `pid` at the first legal spot found by a coarse scan (test helper). */
function placeAnywhere(world: World, pid: number, type: BuildingTypeId): void {
  for (let k = 0; k < 400; k++) {
    const tx = 2 + (k % 20) * 3;
    const ty = 2 + Math.floor(k / 20) * 3;
    if (!world.placementError(pid, type, tx, ty)) {
      world.createBuilding(pid, type, tx, ty, true);
      return;
    }
  }
}

describe('AI commander adapts in a match (v0.17)', () => {
  it('a fortified opponent → siege: announced, bigger attack threshold, long-range units, a missile battery', () => {
    const { world, ai, int } = duel();
    const hq = world.playerBuildings(1)[0];
    for (const [dx, dy] of [
      [-4, -6],
      [-7, -2],
      [-2, -8],
      [-8, -5],
    ])
      world.createBuilding(1, 'defense-turret', hq.tx + dx, hq.ty + dy, true);
    // The AI has scouted the base.
    for (const b of world.playerBuildings(1)) int.known.set(b.id, { id: b.id, x: b.x, y: b.y, type: b.type });
    expect(world.playerBuildings(1).filter((b) => b.type === 'defense-turret').length).toBe(4);
    const before = int.attackThreshold();
    const ev = run(world, ai, 40);
    expect(ev).toContainEqual({ type: 'aiAdapted', player: 0, tactic: 'siege' });
    expect(ai.adapt.has('turtle')).toBe(true);
    expect(int.attackThreshold()).toBeCloseTo(before * 1.15);
    const score = (t: string) => {
      let s = 0;
      for (let i = 0; i < 50; i++) s += int.unitScore(t);
      return s / 50;
    };
    expect(score('mobile-artillery')).toBeGreaterThan(score('rifleman'));
    // With a Research Center, the missile battery appears in its build list.
    placeAnywhere(world, 0, 'research-center');
    const order: string[] = [];
    for (let i = 0; i < 25; i++) {
      const n = int.nextBuilding();
      if (!n) break;
      order.push(n);
      if (n === 'missile-launcher') break;
      placeAnywhere(world, 0, n); // pretend it was built so the list moves on
    }
    expect(order).toContain('missile-launcher');
  });

  it('an early rush → anti-rush: a bigger home guard for the first 10 minutes', () => {
    const { world, ai, int } = duel();
    run(world, ai, 2 * MIN); // opening
    const guardBefore = int.minArmy();
    const hq = world.playerBuildings(0).find((b) => b.type === 'headquarters')!;
    for (let i = 0; i < 4; i++) world.createUnit(1, 'rifleman', hq.x + 4 + i * 0.6, hq.y + 4);
    const ev = run(world, ai, 40);
    expect(ev).toContainEqual({ type: 'aiAdapted', player: 0, tactic: 'anti-rush' });
    expect(int.minArmy()).toBeGreaterThan(guardBefore * 1.25);
  });

  it('a wiped-out attack is measured and makes the AI more patient', () => {
    const { world, ai, int } = duel('normal');
    const tanks: Unit[] = [];
    for (let i = 0; i < 6; i++) tanks.push(world.createUnit(0, 'main-battle-tank', 30 + i, 30));
    int.launchAttack(tanks, { x: 56, y: 56 }, false);
    for (const t of tanks) world.destroy(t); // destroyed without doing any damage
    const ev = run(world, ai, 40);
    expect(ev).toContainEqual({ type: 'aiAdapted', player: 0, tactic: 'patience' });
    expect(ai.adapt.patience).toBeCloseTo(1.3);
    expect(ai.adapt.log[0].tactic).toBe('patience');
  });
});

describe('Memory of the player between matches (v0.17.2)', () => {
  it('habits: two matches in a row make a habit; a long habit survives one match without it', () => {
    let h = updateHabits(NO_HABITS, ['rush']);
    expect(h.rush).toBeCloseTo(0.4);
    expect(rememberedStyles(h)).toEqual([]);
    h = updateHabits(h, ['rush', 'air']);
    expect(rememberedStyles(h)).toEqual(['rush']);
    h = updateHabits(h, []);
    expect(rememberedStyles(h)).toEqual([]); // a fresh habit fades after one match without it
    for (let i = 0; i < 4; i++) h = updateHabits(h, ['turtle']);
    h = updateHabits(h, []);
    expect(rememberedStyles(h)).toEqual(['turtle']);
  });

  it('stored habits are sanitized', () => {
    expect(sanitizeHabits(null)).toEqual(NO_HABITS);
    expect(sanitizeHabits({ rush: 0.7, air: 5, naval: 'x', junk: 1 })).toEqual({ ...NO_HABITS, rush: 0.7 });
  });

  it('every difficulty notices styles (for the memory); only Hard+ act and prepare from memory', () => {
    const normal = new Adaptation('normal');
    expect(normal.observe(signals({ enemyDefenses: 5 }))).toEqual([]);
    expect([...normal.detected]).toEqual(['turtle']);
    expect(normal.has('turtle')).toBe(false);
    expect(normal.prime(['rush'])).toEqual([]);
    const hard = new Adaptation('hard');
    expect(hard.prime(['rush', 'air'])).toEqual(['anti-rush', 'anti-air']);
    expect(hard.has('rush') && hard.has('air')).toBe(true);
    // Recognising a remembered style later in the match is not announced again.
    expect(hard.observe(signals({ firstAssaultTick: 3 * MIN }))).toEqual([]);
  });

  it('a Hard commander facing a human prepares from memory and says so; an AI-vs-AI match ignores it', () => {
    const { world } = duel();
    const ai = new AICommander(world, 0, { remembered: ['turtle'] });
    expect(ai.adapt.has('turtle')).toBe(true);
    expect(world.drainEvents().filter((e) => e.type === 'aiAdapted')).toEqual([
      { type: 'aiAdapted', player: 0, tactic: 'siege', remembered: true },
    ]);
    const aiOnly = new World({
      mapId: 'desert-storm',
      mission: 'annihilation',
      startingCredits: 5000,
      seed: 1,
      slots: [0, 1].map((i) => ({
        kind: 'ai' as const,
        name: 'P' + i,
        faction: 'western' as const,
        team: i,
        difficulty: 'hard' as const,
        personality: 'warlord' as const,
      })),
    });
    aiOnly.drainEvents();
    expect(new AICommander(aiOnly, 0, { remembered: ['turtle'] }).adapt.has('turtle')).toBe(false);
  });
});

