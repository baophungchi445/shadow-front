import { BALANCE } from '@shadow-front/game-data';
import { findPath } from '../pathfinding';
import type { Entity, Unit } from '../types';
import type { World } from '../world';

/** Computes a new path for `u` to (gx, gy). Air units fly straight. */
export function pathTo(world: World, u: Unit, gx: number, gy: number): void {
  if (u.air) {
    u.path = [{ x: gx, y: gy }];
  } else {
    u.path = findPath(world.grid, u.x, u.y, gx, gy) ?? [];
  }
  u.pathIndex = 0;
  u.pathVersion = world.grid.version;
  u.pathTick = world.tick;
  u.pathGoal = { x: gx, y: gy };
  u.moving = u.path.length > 0;
  u.stuckTicks = 0;
  u.lastDist = Infinity;
}

export function clearPath(u: Unit): void {
  u.path = [];
  u.pathIndex = 0;
  u.pathGoal = null;
  u.moving = false;
}

/**
 * Group move: destinations are spread over distinct walkable tiles around the target
 * so units do not pile onto a single tile. Each unit then pathfinds independently.
 */
export function orderMove(
  world: World,
  units: Unit[],
  x: number,
  y: number,
  attackMove: boolean,
  retreat = false,
): void {
  const ground = units.filter((u) => !u.air);
  const air = units.filter((u) => u.air);

  if (ground.length) {
    const slots = world.grid.spreadTiles(Math.floor(x), Math.floor(y), ground.length);
    // Greedy assignment: the unit farthest from the target picks first, taking the slot nearest to itself.
    const sorted = [...ground].sort((a, b) => Math.hypot(b.x - x, b.y - y) - Math.hypot(a.x - x, a.y - y));
    const free = slots.slice();
    for (const u of sorted) {
      let bestI = 0;
      let bestD = Infinity;
      free.forEach((s, i) => {
        const d = Math.hypot(s.x + 0.5 - u.x, s.y + 0.5 - u.y);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });
      const s = free.splice(bestI, 1)[0] ?? { x: Math.floor(x), y: Math.floor(y) };
      assignMove(world, u, s.x + 0.5, s.y + 0.5, attackMove, retreat);
    }
  }
  air.forEach((u, i) => {
    // Simple ring formation for aircraft.
    const ring = i === 0 ? 0 : 1 + Math.floor((i - 1) / 6);
    const ang = (i * Math.PI) / 3;
    const tx = Math.max(0.5, Math.min(world.map.width - 0.5, x + Math.cos(ang) * ring));
    const ty = Math.max(0.5, Math.min(world.map.height - 0.5, y + Math.sin(ang) * ring));
    assignMove(world, u, tx, ty, attackMove, retreat);
  });
}

function assignMove(
  world: World,
  u: Unit,
  x: number,
  y: number,
  attackMove: boolean,
  retreat: boolean,
): void {
  u.order = retreat ? { type: 'retreat', x, y } : { type: 'move', x, y, attackMove };
  u.targetId = null;
  pathTo(world, u, x, y);
}

export function orderAttack(world: World, units: Unit[], target: Entity): void {
  for (const u of units) {
    u.order = { type: 'attack', target: target.id };
    u.targetId = target.id;
    clearPath(u);
  }
}

export function orderStop(units: Unit[]): void {
  for (const u of units) {
    u.order = { type: 'idle' };
    u.targetId = null;
    u.anchorX = u.x;
    u.anchorY = u.y;
    clearPath(u);
  }
}

export function orderHold(units: Unit[]): void {
  for (const u of units) {
    u.order = { type: 'hold' };
    u.targetId = null;
    u.anchorX = u.x;
    u.anchorY = u.y;
    clearPath(u);
  }
}

/** Patrol: attack-move between each unit's current position and its share of (x, y). */
export function orderPatrol(world: World, units: Unit[], x: number, y: number): void {
  const starts = new Map(units.map((u) => [u.id, { x: u.x, y: u.y }]));
  orderMove(world, units, x, y, true);
  for (const u of units) if (u.order.type === 'move') u.order.patrol = starts.get(u.id);
}

function onArrive(world: World, u: Unit): void {
  clearPath(u);
  const o = u.order;
  if (o.type === 'move' && o.patrol) {
    // Turn around and walk back to the other end.
    u.order = { type: 'move', x: o.patrol.x, y: o.patrol.y, attackMove: true, patrol: { x: o.x, y: o.y } };
    pathTo(world, u, o.patrol.x, o.patrol.y);
    return;
  }
  if (u.order.type === 'move' || u.order.type === 'retreat') {
    u.order = { type: 'idle' };
    u.anchorX = u.x;
    u.anchorY = u.y;
  }
}

/** Rotates `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

export function updateMovement(world: World): void {
  const units = world.units();
  const carriers = new Set(world.flags.map((f) => f.carrier).filter((id) => id !== null));
  for (const u of units) {
    u.prevX = u.x;
    u.prevY = u.y;
    if (!u.moving || u.pathIndex >= u.path.length) {
      u.moving = false;
      continue;
    }

    // Re-path when buildings changed and our remaining route crosses a now-blocked tile.
    if (!u.air && u.pathVersion !== world.grid.version) {
      u.pathVersion = world.grid.version;
      const blocked = u.path
        .slice(u.pathIndex)
        .some((p) => !world.grid.walkable(Math.floor(p.x), Math.floor(p.y)));
      if (blocked && u.pathGoal) {
        pathTo(world, u, u.pathGoal.x, u.pathGoal.y);
        if (!u.moving) continue;
      }
    }

    const wp = u.path[u.pathIndex];
    const dx = wp.x - u.x;
    const dy = wp.y - u.y;
    const d = Math.hypot(dx, dy);
    const turnRate = u.def.category === 'infantry' || u.air ? 0.5 : 0.18;
    if (d > 1e-6) u.facing = turnToward(u.facing, Math.atan2(dy, dx), turnRate);

    const speed = carriers.has(u.id) ? u.speed * BALANCE.flagCarrierSpeed : u.speed;
    if (d <= speed) {
      u.x = wp.x;
      u.y = wp.y;
      u.pathIndex++;
      if (u.pathIndex >= u.path.length) onArrive(world, u);
      continue;
    }
    const nx = u.x + (dx / d) * speed;
    const ny = u.y + (dy / d) * speed;
    if (!u.air && !world.grid.walkable(Math.floor(nx), Math.floor(ny)) && u.pathGoal) {
      pathTo(world, u, u.pathGoal.x, u.pathGoal.y);
      continue;
    }
    u.x = nx;
    u.y = ny;

    // Stuck detection: crowds around the destination or units blocking a corridor.
    const goal = u.path[u.path.length - 1];
    const gd = Math.hypot(goal.x - u.x, goal.y - u.y);
    if (gd < u.lastDist - 0.01) {
      u.lastDist = gd;
      u.stuckTicks = 0;
    } else if (++u.stuckTicks > 30) {
      if (gd < 2) onArrive(world, u);
      else if (u.pathGoal) pathTo(world, u, u.pathGoal.x, u.pathGoal.y);
    }
  }
  separate(world, units);
}

/**
 * Soft separation so units do not overlap. Idle units yield more than moving ones.
 * Pushes never move a ground unit onto a blocked tile.
 */
function separate(world: World, units: Unit[]): void {
  for (const u of units) {
    let px = 0;
    let py = 0;
    world.spatial.query(u.x, u.y, 1.2, (e) => {
      if (e === u || e.kind !== 'unit' || e.dead || e.air !== u.air) return;
      let dx = u.x - e.x;
      let dy = u.y - e.y;
      let d = Math.hypot(dx, dy);
      const min = u.radius + e.radius;
      if (d >= min) return;
      if (d < 1e-4) {
        // Deterministic tie-break for perfectly stacked units.
        const a = (u.id * 2.399) % (Math.PI * 2);
        dx = Math.cos(a);
        dy = Math.sin(a);
        d = 1;
      }
      const push = (min - (d < 1 ? Math.hypot(u.x - e.x, u.y - e.y) : d)) * 0.5;
      px += (dx / d) * push;
      py += (dy / d) * push;
    });
    if (px === 0 && py === 0) continue;
    const scale = u.moving ? 0.3 : 0.6;
    const mag = Math.hypot(px, py);
    const lim = Math.min(mag * scale, 0.06);
    const nx = u.x + (px / mag) * lim;
    const ny = u.y + (py / mag) * lim;
    if (u.air) {
      u.x = Math.max(0.2, Math.min(world.map.width - 0.2, nx));
      u.y = Math.max(0.2, Math.min(world.map.height - 0.2, ny));
    } else if (world.grid.walkable(Math.floor(nx), Math.floor(ny))) {
      u.x = nx;
      u.y = ny;
    }
  }
}
