import type { Command, CommandResult, EntityId, PlayerId } from '@shadow-front/shared-types';
import { BALANCE, BUILDABLE, BUILDINGS, RESEARCH, UNITS } from '@shadow-front/game-data';
import type { World } from './world';
import type { Building, Unit } from './types';
import { orderMove, orderAttack, orderStop, orderHold } from './systems/movement';

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
      orderMove(world, units, cmd.x, cmd.y, cmd.attackMove ?? false);
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
      orderAttack(world, units, target);
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
      if (!Number.isInteger(cmd.tx) || !Number.isInteger(cmd.ty)) return fail('Bad position');
      if (!world.requirementsMet(cmd.player, def.requires)) return fail('Requirements not met');
      if (p.credits < def.cost) return fail('Insufficient credits');
      const err = world.placementError(cmd.player, cmd.building, cmd.tx, cmd.ty);
      if (err) return fail(err);
      p.credits -= def.cost;
      p.stats.creditsSpent += def.cost;
      world.createBuilding(cmd.player, cmd.building, cmd.tx, cmd.ty, false);
      return ok;
    }
    case 'cancelBuild': {
      const b = ownedBuilding(world, cmd.player, cmd.building);
      if (!b || b.complete) return fail('Nothing to cancel');
      world.players[cmd.player].credits += Math.round(b.def.cost * BALANCE.buildingCancelRefund);
      world.players[cmd.player].stats.creditsSpent -= b.def.cost;
      b.dead = true;
      world.grid.setOccupied(b.tx, b.ty, b.w, b.h, 0);
      return ok;
    }
    case 'produce': {
      const b = ownedBuilding(world, cmd.player, cmd.producer);
      const def = UNITS[cmd.unit];
      if (!b || !def) return fail('Invalid producer');
      if (!b.complete) return fail('Building under construction');
      if (def.producedBy !== b.type) return fail(`${def.name} is not produced here`);
      if (!world.requirementsMet(cmd.player, def.requires)) return fail('Requirements not met');
      if (b.queue.length >= BALANCE.maxQueue) return fail('Queue full');
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
