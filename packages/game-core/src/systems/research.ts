import { BALANCE, RESEARCH } from '@shadow-front/game-data';
import type { World } from '../world';

/** Advances technology research (slowed by low power like production). */
export function updateResearch(world: World): void {
  for (const b of world.buildings()) {
    if (!b.research || !b.complete) continue;
    b.research.progress += world.powerFactor(b.owner);
    if (b.research.progress >= RESEARCH[b.research.id].time) {
      const id = b.research.id;
      b.research = null;
      world.completeResearch(b.owner, id);
    }
  }
}

/** Repairs buildings with repair toggled on, paying credits per tick; stops when full or broke. */
export function updateRepair(world: World): void {
  for (const b of world.buildings()) {
    if (!b.repairing) continue;
    if (!b.complete || b.hp >= b.maxHp) {
      b.repairing = false;
      continue;
    }
    const p = world.players[b.owner];
    const cost = (b.def.cost * BALANCE.repairCostRatio) / BALANCE.repairTicks;
    if (p.credits < cost) {
      b.repairing = false;
      continue;
    }
    p.credits -= cost;
    p.stats.creditsSpent += cost;
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp / BALANCE.repairTicks);
  }
}
