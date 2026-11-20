import { BALANCE, RESEARCH, UNIT_UPGRADE } from '@shadow-front/game-data';
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

/** Advances building upgrades; on completion the building becomes level 2 (more HP / damage / power). */
export function updateUpgrades(world: World): void {
  for (const b of world.buildings()) {
    if (b.upgrading === null) continue;
    const up = b.def.upgrade;
    if (!up) {
      b.upgrading = null;
      continue;
    }
    b.upgrading += world.powerFactor(b.owner);
    if (b.upgrading >= up.time) {
      b.upgrading = null;
      b.level = 2;
      b.maxHp = Math.round(b.maxHp * up.hp);
      b.hp *= up.hp;
      if (up.damage) b.damageMul *= up.damage;
      world.emit({ type: 'upgraded', id: b.id, player: b.owner });
    }
  }
}

/** Advances unit-type upgrades at producers (slowed by low power). */
export function updateUnitUpgrades(world: World): void {
  for (const b of world.buildings()) {
    if (!b.unitUpgrade || !b.complete) continue;
    b.unitUpgrade.progress += world.powerFactor(b.owner);
    if (b.unitUpgrade.progress >= UNIT_UPGRADE.time) {
      const type = b.unitUpgrade.unit;
      b.unitUpgrade = null;
      world.completeUnitUpgrade(b.owner, type);
    }
  }
}
