import { describe, expect, it } from 'vitest';
import type { Difficulty, MapId, Personality } from '@shadow-front/shared-types';
import { World } from '@shadow-front/game-core';
import { AICommander } from './commander';

function aiMatch(mapId: MapId, d: Difficulty, p1: Personality, p2: Personality, seed = 7) {
  const world = new World({
    mapId,
    mission: 'annihilation',
    startingCredits: 5000,
    seed,
    slots: [
      { kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: d, personality: p1 },
      { kind: 'ai', name: 'B', faction: 'eastern', team: 1, difficulty: d, personality: p2 },
    ],
  });
  const ais = world.players.map((p) => new AICommander(world, p.id));
  return { world, ais };
}

describe('AICommander', () => {
  it('builds a functioning base and produces an army (normal)', () => {
    const { world, ais } = aiMatch('desert-storm', 'normal', 'warlord', 'rush');
    for (let i = 0; i < 20 * 180; i++) {
      for (const ai of ais) ai.update();
      world.step();
    }
    for (const p of world.players) {
      const types = new Set(world.playerBuildings(p.id).map((b) => b.type));
      if (p.defeated) continue;
      expect(types.has('power-plant')).toBe(true);
      expect(types.has('barracks')).toBe(true);
      expect(p.stats.unitsBuilt).toBeGreaterThan(3);
      expect(p.stats.creditsEarned).toBeGreaterThan(0);
    }
  });

  it('AI vs AI match produces combat and eventually a winner (hard)', () => {
    const { world, ais } = aiMatch('desert-storm', 'hard', 'rush', 'eagle', 3);
    const maxTicks = 20 * 60 * 25;
    for (let i = 0; i < maxTicks && world.winningTeam === null; i++) {
      for (const ai of ais) ai.update();
      world.step();
    }
    const kills = world.players.reduce((s, p) => s + p.stats.kills, 0);
    expect(kills).toBeGreaterThan(5);
    // The match either finished or at least one side lost buildings.
    const lost = world.players.reduce((s, p) => s + p.stats.buildingsLost, 0);
    expect(world.winningTeam !== null || lost > 0).toBe(true);
  }, 120_000);

  it('never sees through fog: no known enemy buildings at start', () => {
    const { ais } = aiMatch('urban-conflict', 'insane', 'fortress', 'warlord');
    for (const ai of ais) {
      ai.update();
      expect((ai as unknown as { known: Map<number, unknown> }).known.size).toBe(0);
    }
  });

  it('captures strategic points and researches technology without overspending', () => {
    const { world, ais } = aiMatch('urban-conflict', 'hard', 'warlord', 'fortress', 5);
    let captures = 0;
    let researched = 0;
    for (let i = 0; i < 20 * 60 * 14 && world.winningTeam === null; i++) {
      for (const ai of ais) ai.update();
      world.step();
      for (const e of world.drainEvents()) {
        if (e.type === 'pointCaptured') captures++;
        if (e.type === 'researchComplete') researched++;
      }
    }
    expect(captures).toBeGreaterThan(0);
    expect(researched).toBeGreaterThan(0);
    for (const p of world.players) expect(p.credits).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('repairs damaged buildings when safe, but not while enemies are close', () => {
    const { world, ais } = aiMatch('desert-storm', 'normal', 'warlord', 'rush', 11);
    const hq = world.playerBuildings(0).find((b) => b.type === 'headquarters')!;
    hq.hp = hq.maxHp * 0.5;
    // An enemy tank parked next to the HQ: the AI must not start repairing under fire.
    const enemy = world.createUnit(1, 'main-battle-tank', hq.x + 4, hq.y);
    enemy.order = { type: 'hold' };
    for (let i = 0; i < 40; i++) {
      ais[0].update();
      world.step();
      enemy.x = enemy.prevX = hq.x + 4; // keep it in place
      enemy.y = enemy.prevY = hq.y;
    }
    expect(hq.repairing).toBe(false);

    world.destroy(enemy);
    const hpBefore = hq.hp;
    for (let i = 0; i < 20 * 8; i++) {
      ais[0].update();
      world.step();
    }
    expect(hq.hp).toBeGreaterThan(hpBefore);
    expect(hq.repairing || hq.hp >= hq.maxHp).toBe(true);
  });

  it('an allied AI holds out in survival instead of raiding empty spawns (easy waves)', () => {
    const world = new World({
      mapId: 'desert-storm',
      mission: 'survival',
      startingCredits: 5000,
      seed: 1,
      survival: { difficulty: 'easy', waves: 10 },
      slots: [
        { kind: 'ai', name: 'D', faction: 'western', team: 0, difficulty: 'normal', personality: 'fortress' },
      ],
    });
    const ai = new AICommander(world, 0);
    while (world.winningTeam === null && world.tick < 20 * 60 * 25) {
      ai.update();
      world.step();
    }
    expect(world.survival!.wave).toBe(10);
    expect(world.winningTeam).toBe(0);
  }, 120_000);
});
