import { BALANCE, RESEARCH_EFFECTS, TICK_RATE, UNITS } from '@shadow-front/game-data';
import type { World } from '../world';
import { orderMove } from './movement';
import { frontOf } from '../front';

/** Recomputes power produced/used per player from completed buildings. */
export function updatePower(world: World): void {
  for (const p of world.players) {
    p.powerProduced = 0;
    p.powerUsed = 0;
  }
  for (const b of world.buildings()) {
    if (!b.complete) continue;
    const p = world.players[b.owner];
    if (b.def.power > 0) p.powerProduced += b.def.power * (b.level >= 2 ? (b.def.upgrade?.power ?? 1) : 1);
    else p.powerUsed += -b.def.power;
  }
}

/** Advances buildings under construction. HP rises with progress. */
export function updateConstruction(world: World): void {
  for (const b of world.buildings()) {
    if (b.complete) continue;
    const step = world.powerFactor(b.owner) / b.def.buildTime;
    b.progress = Math.min(1, b.progress + step);
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * step);
    if (b.progress >= 1) {
      b.complete = true;
      world.players[b.owner].stats.buildingsBuilt++;
      if (b.def.needsOre) b.oreTiles = world.oreTilesNear(b.x, b.y);
      world.emit({ type: 'built', id: b.id, player: b.owner });
    }
  }
}

/** Advances production queues and spawns finished units at the producer's exit. */
export function updateProduction(world: World): void {
  for (const b of world.buildings()) {
    if (!b.complete || b.queue.length === 0) continue;
    const type = b.queue[0];
    const def = UNITS[type];
    b.queueProgress = Math.min(def.buildTime, b.queueProgress + world.powerFactor(b.owner));
    if (b.queueProgress < def.buildTime) continue;

    const exit = frontOf(b, 0.5);
    let sx = exit.x;
    let sy = exit.y;
    if (def.category !== 'air') {
      // Exit through the building's front edge (see Building.facing).
      const t = world.grid.nearestWalkable(Math.floor(exit.x), Math.floor(exit.y), 6);
      if (!t) continue; // Exit blocked; retry next tick.
      sx = t.x + 0.5;
      sy = t.y + 0.5;
    }
    b.queue.shift();
    b.queueProgress = 0;
    const u = world.createUnit(b.owner, type, sx, sy);
    world.players[b.owner].stats.unitsBuilt++;
    world.unitStat(b.owner, type).built++;
    world.emit({ type: 'produced', id: u.id, player: b.owner });
    orderMove(world, [u], b.rallyX, b.rallyY, true);
  }
}

/** Credits income: HQ trickle and Resource Extractors draining finite ore. */
export function updateEconomy(world: World): void {
  for (const b of world.buildings()) {
    if (!b.complete || !b.def.income) continue;
    const p = world.players[b.owner];
    let amount = (b.def.income / TICK_RATE) * world.powerFactor(b.owner);
    if (b.def.needsOre) {
      if (world.hasResearch(b.owner, 'efficient-extraction')) amount *= RESEARCH_EFFECTS.extraction;
      let need = amount;
      let got = 0;
      for (const idx of b.oreTiles) {
        if (need <= 0) break;
        const take = Math.min(need, world.oreRemaining[idx]);
        if (take <= 0) continue;
        world.oreRemaining[idx] -= take;
        need -= take;
        got += take;
      }
      amount = got;
    }
    p.credits += amount;
    p.stats.creditsEarned += amount;
  }
  // Strategic points pay their controller.
  for (const pt of world.points) {
    if (pt.player === null) continue;
    const p = world.players[pt.player];
    const amount = BALANCE.pointIncome / TICK_RATE;
    p.credits += amount;
    p.stats.creditsEarned += amount;
  }
}
