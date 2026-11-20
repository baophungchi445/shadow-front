import type { Formation } from '@shadow-front/shared-types';
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

/**
 * Offsets (in tiles) of formation slots, in formation space: x = forward (toward the target), y = sideways.
 * Slot 0 is the front centre.
 */
export function formationOffsets(kind: Exclude<Formation, 'spread'>, n: number, gap: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (kind === 'line') {
    // Rows of up to 8 side by side; extra rows behind.
    const perRow = Math.min(8, n);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const k = i % perRow;
      out.push({ x: -row * gap, y: (k - (inRow - 1) / 2) * gap });
    }
  } else if (kind === 'column') {
    // Two abreast, one behind the other.
    for (let i = 0; i < n; i++) {
      const pairCount = Math.min(2, n - Math.floor(i / 2) * 2);
      out.push({ x: -Math.floor(i / 2) * gap, y: pairCount === 1 ? 0 : (i % 2 === 0 ? -0.5 : 0.5) * gap });
    }
  } else {
    // Wedge: leader at the tip, the rest alternate left / right, one step back each.
    out.push({ x: 0, y: 0 });
    for (let i = 1; i < n; i++) {
      const step = Math.ceil(i / 2);
      const side = i % 2 === 1 ? -1 : 1;
      out.push({ x: -step * gap * 0.8, y: side * step * gap * 0.8 });
    }
  }
  return out;
}

/**
 * Formation move for ground units: slots are laid out around the target, facing the direction of travel, and
 * every unit moves at the slowest member's speed. Air units keep the ring formation of `orderMove`.
 */
export function orderFormation(
  world: World,
  units: Unit[],
  x: number,
  y: number,
  attackMove: boolean,
  kind: Exclude<Formation, 'spread'>,
): void {
  const ground = units.filter((u) => !u.air);
  const air = units.filter((u) => u.air);
  if (air.length) orderMove(world, air, x, y, attackMove);
  if (!ground.length) return;
  // Anchor the formation on open ground when the clicked tile is blocked.
  if (!world.grid.walkable(Math.floor(x), Math.floor(y))) {
    const t = world.grid.nearestWalkable(Math.floor(x), Math.floor(y));
    if (t) {
      x = t.x + 0.5;
      y = t.y + 0.5;
    }
  }
  const cx = ground.reduce((s, u) => s + u.x, 0) / ground.length;
  const cy = ground.reduce((s, u) => s + u.y, 0) / ground.length;
  let fx = x - cx;
  let fy = y - cy;
  const d = Math.hypot(fx, fy);
  if (d < 0.5) {
    fx = 1;
    fy = 0;
  } else {
    fx /= d;
    fy /= d;
  }
  // Sideways axis (perpendicular to travel).
  const sx = -fy;
  const sy = fx;
  const gap = Math.max(1, 2 * Math.max(...ground.map((u) => u.radius)) + 0.15);
  const offsets = formationOffsets(kind, ground.length, gap);
  const taken = new Set<number>();
  const slots = offsets.map((o) => {
    const t = world.grid.nearestWalkable(Math.floor(x + fx * o.x + sx * o.y), Math.floor(y + fy * o.x + sy * o.y), 4);
    if (t && !taken.has(t.y * world.map.width + t.x)) {
      taken.add(t.y * world.map.width + t.x);
      // Keep the exact (sub-tile) slot position when it lies on open ground.
      const px = x + fx * o.x + sx * o.y;
      const py = y + fy * o.x + sy * o.y;
      const exact = Math.floor(px) === t.x && Math.floor(py) === t.y;
      return exact ? { x: px, y: py } : { x: t.x + 0.5, y: t.y + 0.5 };
    }
    return null;
  });
  // Blocked slots fall back to free tiles around the target.
  const missing = slots.filter((s) => s === null).length;
  if (missing) {
    const extra = world.grid
      .spreadTiles(Math.floor(x), Math.floor(y), ground.length + missing)
      .filter((t) => !taken.has(t.y * world.map.width + t.x));
    let k = 0;
    for (let i = 0; i < slots.length; i++)
      if (!slots[i]) {
        const t = extra[k++] ?? { x: Math.floor(x), y: Math.floor(y) };
        slots[i] = { x: t.x + 0.5, y: t.y + 0.5 };
      }
  }
  // Front slots go to the toughest units; each then takes the free slot nearest to it within its rank.
  const order = [...ground].sort((a, b) => b.maxHp - a.maxHp);
  const speed = Math.min(...ground.map((u) => u.speed * world.weatherSpeed(u)));
  const free = slots.map((s, i) => ({ ...(s as { x: number; y: number }), i }));
  for (const u of order) {
    // Prefer the most forward free slot; break ties by distance to the unit.
    free.sort((a, b) => a.i - b.i);
    const front = free[0].i;
    const rank = free.filter((s) => offsets[s.i].x === offsets[front].x);
    rank.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y));
    const s = rank[0];
    free.splice(free.indexOf(s), 1);
    assignMove(world, u, s.x, s.y, attackMove, false);
    if (u.order.type === 'move') u.order.speed = speed;
  }
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

    const cap = u.order.type === 'move' && u.order.speed ? u.order.speed : Infinity;
    const base = (world.isSuppressed(u) ? u.speed * BALANCE.suppressedSpeed : u.speed) * world.weatherSpeed(u);
    const speed = Math.min(cap, carriers.has(u.id) ? base * BALANCE.flagCarrierSpeed : base);
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
