import { describe, expect, it } from 'vitest';
import type { Personality } from '@shadow-front/shared-types';
import { World, type Unit } from '@shadow-front/game-core';
import { AICommander } from './commander';

/** 2v2 on Desert Storm: players 0 + 2 are allies (team 0) against 1 + 3. */
function setup(pers: Personality[], seed = 3) {
  const world = new World({
    mapId: 'desert-storm',
    mission: 'annihilation',
    startingCredits: 5000,
    seed,
    slots: pers.map((p, i) => ({
      kind: 'ai' as const,
      name: `P${i}`,
      faction: 'western' as const,
      team: pers.length === 2 ? i : i % 2,
      difficulty: 'hard' as const,
      personality: p,
    })),
  });
  return { world, ais: world.players.map((p) => new AICommander(world, p.id)) };
}

type Internals = {
  launchAttack(home: Unit[], target: { x: number; y: number }, joined: boolean): void;
  known: Map<number, { id: number; x: number; y: number; type: string }>;
};

function run(world: World, ais: AICommander[], ticks: number, onTick?: () => void) {
  for (let i = 0; i < ticks; i++) {
    for (const a of ais) a.update();
    world.step();
    onTick?.();
  }
}

describe('AI tactics (v0.8)', () => {
  it('garrisons its bunker with home infantry, keeping a mobile core', () => {
    const { world, ais } = setup(['fortress', 'rush']);
    const hq = world.playerBuildings(0)[0];
    world.createBuilding(0, 'barracks', hq.tx + 4, hq.ty, true);
    const bunker = world.createBuilding(0, 'bunker', hq.tx, hq.ty + 4, true);
    for (let i = 0; i < 6; i++) world.createUnit(0, 'rifleman', hq.x + 3 + (i % 3), hq.y + 3 + Math.floor(i / 3));
    run(world, [ais[0]], 20 * 15);
    expect(bunker.passengers.length).toBeGreaterThan(0);
    const homeInf = world.playerUnits(0).filter((u) => u.def.category === 'infantry');
    expect(homeInf.length).toBeGreaterThanOrEqual(4);
  });

  it('loads infantry into APCs for an attack and unloads them near the fight', () => {
    const { world, ais } = setup(['warlord', 'rush']);
    const hq = world.playerBuildings(0)[0];
    const apc = world.createUnit(0, 'apc', hq.x + 4, hq.y + 4);
    const enemyHq = world.playerBuildings(1)[0];
    const home = world.playerUnits(0).filter((u) => u.def.weapon);
    (ais[0] as unknown as Internals).launchAttack(home, { x: enemyHq.x, y: enemyHq.y }, false);
    let maxInside = 0;
    let unloaded = 0;
    run(world, [ais[0]], 20 * 90, () => {
      maxInside = Math.max(maxInside, apc.passengers.length);
      for (const e of world.drainEvents()) if (e.type === 'unloaded' && e.carrier === apc.id) unloaded++;
    });
    expect(maxInside).toBeGreaterThanOrEqual(3);
    expect(unloaded).toBeGreaterThan(0);
  });

  it('allied AIs join an attack posted by a teammate', () => {
    const { world, ais } = setup(['warlord', 'rush', 'fortress', 'rush']);
    world.tick = 20 * 60 * 6;
    const ally = ais[2];
    const hq2 = world.playerBuildings(2)[0];
    for (let i = 0; i < 6; i++) world.createUnit(2, 'main-battle-tank', hq2.x + 3 + i * 0.8, hq2.y + 3);
    const target = world.playerBuildings(1)[0];
    (ais[0] as unknown as Internals).launchAttack(
      world.playerUnits(0).filter((u) => u.def.weapon),
      { x: target.x, y: target.y },
      false,
    );
    const decisions = new Set<string>();
    run(world, [ally], 40, () => decisions.add(ally.lastDecision));
    expect([...decisions].some((d) => d.startsWith('join ally attack'))).toBe(true);
    const moving = world.playerUnits(2).filter((u) => u.type === 'main-battle-tank' && u.order.type === 'move');
    expect(moving.length).toBeGreaterThan(0);
  });

  it('sends a transport helicopter with infantry on a drop raid', () => {
    const { world, ais } = setup(['eagle', 'rush']);
    world.tick = 20 * 60 * 8;
    const hq = world.playerBuildings(0)[0];
    const heli = world.createUnit(0, 'transport-helicopter', hq.x + 3, hq.y + 3);
    for (let i = 0; i < 6; i++) world.createUnit(0, 'rifleman', hq.x + 4 + (i % 3), hq.y + 4 + Math.floor(i / 3));
    const target = world.playerBuildings(1)[0];
    (ais[0] as unknown as Internals).known.set(target.id, {
      id: target.id,
      x: target.x,
      y: target.y,
      type: 'resource-extractor',
    });
    let maxInside = 0;
    let dropped = 0;
    run(world, [ais[0]], 20 * 120, () => {
      maxInside = Math.max(maxInside, heli.dead ? 0 : heli.passengers.length);
      for (const e of world.drainEvents()) if (e.type === 'unloaded' && e.carrier === heli.id) dropped += e.count;
    });
    expect(maxInside).toBeGreaterThanOrEqual(4);
    expect(dropped).toBeGreaterThanOrEqual(4);
  });

  it('a Hard commander builds a Mobile Command Vehicle and deploys a forward base with extractors', () => {
    const { world, ais } = setup(['fortress', 'rush']);
    world.tick = 20 * 60 * 11;
    const ai = ais[0];
    const hq = world.playerBuildings(0)[0];
    for (const [t, dx, dy] of [
      ['power-plant', 4, 0],
      ['power-plant', 4, 3],
      ['barracks', 0, 4],
      ['war-factory', 7, 0],
      ['research-center', 7, 4],
    ] as const)
      world.createBuilding(0, t, hq.tx + dx, hq.ty + dy, true);
    // Two extractors at home, plenty of credits, an army so it is not under-defended.
    world.createBuilding(0, 'resource-extractor', hq.tx - 4, hq.ty, true);
    world.createBuilding(0, 'resource-extractor', hq.tx - 4, hq.ty + 3, true);
    for (let i = 0; i < 8; i++) world.createUnit(0, 'main-battle-tank', hq.x + 3 + (i % 4), hq.y + 6 + Math.floor(i / 4));
    world.players[0].credits = 12000;
    // The passive opponent must survive the test (its HQ cannot fall).
    const enemyHq = world.playerBuildings(1)[0];
    enemyHq.maxHp = enemyHq.hp = 1e9;
    let deployed = false;
    const fwdExtractor = () => {
      const h = world.playerBuildings(0).filter((b) => b.type === 'headquarters')[1];
      return (
        !!h &&
        world
          .playerBuildings(0)
          .some((b) => b.type === 'resource-extractor' && b.complete && Math.hypot(b.x - h.x, b.y - h.y) < 12)
      );
    };
    for (let i = 0; i < 20 * 600 && !fwdExtractor(); i++) {
      ai.update();
      world.step();
      for (const e of world.drainEvents()) if (e.type === 'deployed' && e.player === 0) deployed = true;
      world.players[0].credits = Math.max(world.players[0].credits, 3000);
    }
    expect(deployed).toBe(true);
    const hqs = world.playerBuildings(0).filter((b) => b.type === 'headquarters');
    expect(hqs).toHaveLength(2);
    expect(Math.hypot(hqs[1].x - hq.x, hqs[1].y - hq.y)).toBeGreaterThan(15);
    const fwdExtractors = world
      .playerBuildings(0)
      .filter((b) => b.type === 'resource-extractor' && Math.hypot(b.x - hqs[1].x, b.y - hqs[1].y) < 12);
    expect(fwdExtractors.length).toBeGreaterThan(0);
  });

  it('upgrades the unit type its army relies on most when it has spare credits (v0.11)', () => {
    const { world, ais } = setup(['warlord', 'rush']);
    const hq = world.playerBuildings(0)[0];
    world.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
    world.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
    for (let i = 0; i < 8; i++) world.createUnit(0, 'rifleman', hq.x + 3 + (i % 4), hq.y + 3 + Math.floor(i / 4));
    world.players[0].credits = 20000;
    let started = false;
    run(world, [ais[0]], 20 * 30, () => {
      if (world.playerBuildings(0).some((b) => b.unitUpgrade?.unit === 'rifleman')) started = true;
    });
    expect(started || world.hasUnitUpgrade(0, 'rifleman')).toBe(true);
  });
});
