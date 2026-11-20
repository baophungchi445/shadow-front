import type { Command, CommandResult, EntityId, PlayerId } from '@shadow-front/shared-types';
import {
  BALANCE,
  BUILDABLE,
  BUILDINGS,
  RESEARCH,
  UNITS,
  availableTo,
  buildingAvailableTo,
  researchAvailableTo,
  unitUpgradeCost,
} from '@shadow-front/game-data';
import type { World } from './world';
import { canTarget } from './combat';
import type { Building, Unit } from './types';
import {
  orderMove,
  orderAttack,
  orderStop,
  orderHold,
  orderPatrol,
  orderFormation,
  pathTo,
} from './systems/movement';

const ok: CommandResult = { ok: true };
const fail = (reason: string): CommandResult => ({ ok: false, reason });

/** Resolves and filters unit ids to living units owned by `player`. */
function ownedUnits(world: World, player: PlayerId, ids: EntityId[]): Unit[] {
  const out: Unit[] = [];
  for (const id of ids) {
    const e = world.get(id);
    if (e && e.kind === 'unit' && e.owner === player) out.push(e);
  }
  return out;
}

function ownedBuilding(world: World, player: PlayerId, id: EntityId): Building | null {
  const e = world.get(id);
  return e && e.kind === 'building' && e.owner === player ? e : null;
}

/** Validates and applies a command. Every player action (human or AI) goes through here. */
export function executeCommand(world: World, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'move': {
      const units = ownedUnits(world, cmd.player, cmd.units);
      if (!units.length) return fail('No units');
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Bad target');
      if (cmd.formation && cmd.formation !== 'spread' && units.length > 1)
        orderFormation(world, units, cmd.x, cmd.y, cmd.attackMove ?? false, cmd.formation);
      else orderMove(world, units, cmd.x, cmd.y, cmd.attackMove ?? false);
      return ok;
    }
    case 'attack': {
      const units = ownedUnits(world, cmd.player, cmd.units).filter((u) => u.def.weapon);
      const target = world.get(cmd.target);
      if (!units.length) return fail('No armed units');
      if (!target) return fail('Invalid target');
      const team = world.players[cmd.player].team;
      if (!world.areEnemies(team, target.team)) return fail('Cannot attack allies');
      if (!world.isVisibleTo(team, target)) return fail('Target not visible');
      // Units whose weapon cannot hit this target (e.g. tanks vs aircraft) attack-move toward it instead.
      const able = units.filter((u) => canTarget(u.def.weapon!, target));
      if (!able.length) return fail('Selected units cannot attack that target');
      orderAttack(world, able, target);
      const rest = units.filter((u) => !able.includes(u));
      if (rest.length) orderMove(world, rest, target.x, target.y, true);
      return ok;
    }
    case 'stop': {
      orderStop(ownedUnits(world, cmd.player, cmd.units));
      return ok;
    }
    case 'hold': {
      orderHold(ownedUnits(world, cmd.player, cmd.units));
      return ok;
    }
    case 'retreat': {
      const units = ownedUnits(world, cmd.player, cmd.units);
      const hq =
        world.playerBuildings(cmd.player).find((b) => b.type === 'headquarters') ??
        world.playerBuildings(cmd.player)[0];
      if (!hq) return fail('No base to retreat to');
      orderMove(world, units, hq.x, hq.y + hq.h / 2 + 1.5, false, true);
      return ok;
    }
    case 'build': {
      if (!BUILDABLE.includes(cmd.building)) return fail('Not buildable');
      const def = BUILDINGS[cmd.building];
      const p = world.players[cmd.player];
      if (!buildingAvailableTo(cmd.building, p.faction))
        return fail(`${def.name} is not available to your faction`);
      if (!Number.isInteger(cmd.tx) || !Number.isInteger(cmd.ty)) return fail('Bad position');
      if (!world.requirementsMet(cmd.player, def.requires)) return fail('Requirements not met');
      if (p.credits < def.cost) return fail('Insufficient credits');
      const err = world.placementError(cmd.player, cmd.building, cmd.tx, cmd.ty);
      if (err) return fail(err);
      p.credits -= def.cost;
      p.stats.creditsSpent += def.cost;
      world.createBuilding(cmd.player, cmd.building, cmd.tx, cmd.ty, false, cmd.facing ?? 0);
      return ok;
    }
    case 'patrol': {
      const units = ownedUnits(world, cmd.player, cmd.units).filter((u) => u.def.weapon);
      if (!units.length) return fail('No armed units');
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Bad target');
      orderPatrol(world, units, cmd.x, cmd.y);
      return ok;
    }
    case 'load': {
      const carrier = world.get(cmd.carrier);
      if (!carrier || carrier.owner !== cmd.player) return fail('Invalid transport');
      const free = world.capacityOf(carrier) - carrier.passengers.length;
      if (free <= 0) return fail(world.capacityOf(carrier) ? 'Transport is full' : 'Cannot carry units');
      const units = ownedUnits(world, cmd.player, cmd.units).filter(
        (u) => u.def.category === 'infantry' && u.id !== carrier.id,
      );
      if (!units.length) return fail('Only infantry can get in');
      for (const u of units.slice(0, free)) {
        u.order = { type: 'board', carrier: carrier.id };
        u.targetId = null;
        pathTo(world, u, carrier.x, carrier.y);
      }
      return ok;
    }
    case 'unload': {
      const carrier = world.get(cmd.carrier);
      if (!carrier || carrier.owner !== cmd.player) return fail('Invalid transport');
      if (!carrier.passengers.length) return fail('Nobody inside');
      if (carrier.kind === 'unit' && carrier.air) {
        const t = world.grid.nearestWalkable(Math.floor(carrier.x), Math.floor(carrier.y));
        if (!t || Math.hypot(t.x + 0.5 - carrier.x, t.y + 0.5 - carrier.y) > 2)
          return fail('No open ground below to unload');
      }
      world.unloadAll(carrier);
      return ok;
    }
    case 'smoke': {
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return fail('Bad target');
      const grenadiers = ownedUnits(world, cmd.player, cmd.units).filter((u) => u.def.smoke);
      if (!grenadiers.length) return fail('No selected unit carries smoke grenades');
      const ready = grenadiers
        .filter((u) => world.tick >= u.smokeReadyTick)
        .sort((a, b) => Math.hypot(a.x - cmd.x, a.y - cmd.y) - Math.hypot(b.x - cmd.x, b.y - cmd.y));
      if (!ready.length) return fail('Smoke grenade not ready');
      const err = world.throwSmoke(ready[0], cmd.x, cmd.y);
      return err ? fail(err) : ok;
    }
    case 'deploy': {
      const u = world.get(cmd.unit);
      if (!u || u.kind !== 'unit' || u.owner !== cmd.player) return fail('Invalid unit');
      if (!u.def.deploysTo) return fail(`${u.def.name} cannot deploy`);
      if (u.air) return fail('Cannot deploy in the air');
      const r = world.deploy(u);
      return typeof r === 'string' ? fail(r) : ok;
    }
    case 'transfer': {
      const from = world.players[cmd.player];
      const to = world.players[cmd.to];
      if (!to || to.id === from.id || to.raider) return fail('Invalid recipient');
      if (to.team !== from.team) return fail('Credits can only be sent to teammates');
      if (to.defeated) return fail('That commander has been eliminated');
      const amount = Math.floor(cmd.amount);
      if (!(amount > 0)) return fail('Invalid amount');
      if (from.credits < amount) return fail('Insufficient credits');
      from.credits -= amount;
      to.credits += amount;
      world.emit({ type: 'creditsSent', from: from.id, to: to.id, amount });
      return ok;
    }
    case 'upgrade': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b) return fail('Invalid building');
      const up = b.def.upgrade;
      if (!up) return fail('This building cannot be upgraded');
      if (!b.complete) return fail('Building under construction');
      if (b.level >= 2) return fail('Already upgraded');
      if (b.upgrading !== null) return fail('Upgrade in progress');
      const p = world.players[cmd.player];
      if (p.credits < up.cost) return fail('Insufficient credits');
      p.credits -= up.cost;
      p.stats.creditsSpent += up.cost;
      b.upgrading = 0;
      return ok;
    }
    case 'upgradeUnit': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      const def = UNITS[cmd.unit];
      if (!b || !def || def.producedBy !== b.type) return fail('This building does not train that unit');
      if (!b.complete) return fail('Building under construction');
      const p = world.players[cmd.player];
      if (!availableTo(cmd.unit, p.faction)) return fail(`${def.name} is not available to your faction`);
      if (world.hasUnitUpgrade(cmd.player, cmd.unit)) return fail('Already upgraded');
      if (b.unitUpgrade) return fail('Upgrade in progress');
      if (world.playerBuildings(cmd.player).some((o) => o.unitUpgrade?.unit === cmd.unit))
        return fail('Already in progress');
      const cost = unitUpgradeCost(cmd.unit);
      if (p.credits < cost) return fail('Insufficient credits');
      p.credits -= cost;
      p.stats.creditsSpent += cost;
      b.unitUpgrade = { unit: cmd.unit, progress: 0 };
      return ok;
    }
    case 'cancelUnitUpgrade': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b || !b.unitUpgrade) return fail('Nothing to cancel');
      const cost = unitUpgradeCost(b.unitUpgrade.unit);
      world.players[cmd.player].credits += cost;
      world.players[cmd.player].stats.creditsSpent -= cost;
      b.unitUpgrade = null;
      return ok;
    }
    case 'sell': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b) return fail('Invalid building');
      if (!b.complete) return fail('Building under construction');
      if (b.type === 'headquarters') return fail('The Headquarters cannot be sold');
      const p = world.players[cmd.player];
      // Queued units and running research are refunded in full, like a cancel.
      let refund = Math.round(b.def.cost * BALANCE.sellRefund * (b.hp / b.maxHp));
      for (const u of b.queue) refund += world.unitCost(cmd.player, u);
      if (b.research) refund += RESEARCH[b.research.id].cost;
      if (b.upgrading !== null) refund += b.def.upgrade?.cost ?? 0;
      if (b.unitUpgrade) refund += unitUpgradeCost(b.unitUpgrade.unit);
      p.credits += refund;
      world.unloadAll(b);
      world.removeBuilding(b);
      world.emit({ type: 'sold', id: b.id, player: cmd.player, refund, x: b.x, y: b.y });
      return ok;
    }
    case 'cancelBuild': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b || b.complete) return fail('Nothing to cancel');
      // A deploying Headquarters was paid for as a vehicle: it cannot be cancelled for the building price.
      if (b.type === 'headquarters') return fail('A deploying Headquarters cannot be cancelled');
      world.players[cmd.player].credits += Math.round(b.def.cost * BALANCE.buildingCancelRefund);
      world.players[cmd.player].stats.creditsSpent -= b.def.cost;
      world.removeBuilding(b);
      return ok;
    }
    case 'produce': {
      const b = ownedBuilding(world, cmd.player, cmd.producer);
      const def = UNITS[cmd.unit];
      if (!b || !def) return fail('Invalid producer');
      if (!b.complete) return fail('Building under construction');
      if (def.producedBy !== b.type) return fail(`${def.name} is not produced here`);
      if (!availableTo(cmd.unit, world.players[cmd.player].faction))
        return fail(`${def.name} is not available to your faction`);
      if (!world.requirementsMet(cmd.player, def.requires)) return fail('Requirements not met');
      if (b.queue.length >= BALANCE.maxQueue) return fail('Queue full');
      if (world.overCap(cmd.player, cmd.unit)) return fail(`Unit limit reached (${world.unitCap})`);
      const cost = world.unitCost(cmd.player, cmd.unit);
      const p = world.players[cmd.player];
      if (p.credits < cost) return fail('Insufficient credits');
      p.credits -= cost;
      p.stats.creditsSpent += cost;
      b.queue.push(cmd.unit);
      return ok;
    }
    case 'cancel': {
      const b = ownedBuilding(world, cmd.player, cmd.producer);
      if (!b || b.queue.length === 0) return fail('Queue empty');
      const unit = b.queue.pop()!;
      if (b.queue.length === 0) b.queueProgress = 0;
      const cost = world.unitCost(cmd.player, unit);
      world.players[cmd.player].credits += cost;
      world.players[cmd.player].stats.creditsSpent -= cost;
      return ok;
    }
    case 'rally': {
      const b = ownedBuilding(world, cmd.player, cmd.producer);
      if (!b) return fail('Invalid building');
      b.rallyX = cmd.x;
      b.rallyY = cmd.y;
      return ok;
    }
    case 'research': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      const def = RESEARCH[cmd.research];
      if (!b || b.type !== 'research-center' || !def) return fail('Research requires a Research Center');
      if (!b.complete) return fail('Building under construction');
      if (b.research) return fail('Already researching');
      if (world.hasResearch(cmd.player, cmd.research)) return fail('Already researched');
      if (!researchAvailableTo(cmd.research, world.players[cmd.player].faction))
        return fail(`${def.name} is not available to your faction`);
      if (world.playerBuildings(cmd.player).some((o) => o.research?.id === cmd.research))
        return fail('Already in progress');
      const p = world.players[cmd.player];
      if (p.credits < def.cost) return fail('Insufficient credits');
      p.credits -= def.cost;
      p.stats.creditsSpent += def.cost;
      b.research = { id: cmd.research, progress: 0 };
      return ok;
    }
    case 'cancelResearch': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b || !b.research) return fail('Nothing to cancel');
      const cost = RESEARCH[b.research.id].cost;
      world.players[cmd.player].credits += cost;
      world.players[cmd.player].stats.creditsSpent -= cost;
      b.research = null;
      return ok;
    }
    case 'repair': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b || !b.complete) return fail('Invalid building');
      if (cmd.on && b.hp >= b.maxHp) return fail('Building is not damaged');
      b.repairing = cmd.on;
      return ok;
    }
  }
}
