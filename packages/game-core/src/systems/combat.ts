import type { WeaponDef } from '@shadow-front/shared-types';
import { BALANCE } from '@shadow-front/game-data';
import { canTarget, computeDamage, inWeaponRange, targetScore } from '../combat';
import type { Building, Entity, Unit } from '../types';
import type { World } from '../world';
import { clearPath, pathTo, turnToward } from './movement';

type Shooter = Unit | Building;

/** Best visible enemy within `radius` that `weapon` can damage. */
export function acquireTarget(world: World, s: Shooter, weapon: WeaponDef, radius: number): Entity | null {
  let best: Entity | null = null;
  let bestScore = -Infinity;
  world.spatial.query(s.x, s.y, radius + 2, (e) => {
    if (e.dead || !world.areEnemies(s.team, e.team)) return;
    if (!canTarget(weapon, e)) return;
    if (Math.hypot(e.x - s.x, e.y - s.y) > radius + (e.kind === 'building' ? e.w / 2 : 0)) return;
    if (!world.isVisibleTo(s.team, e)) return;
    const sc = targetScore(weapon, s.damageMul, s.x, s.y, e);
    if (sc > bestScore) {
      bestScore = sc;
      best = e;
    }
  });
  return best;
}

function validTarget(world: World, s: Shooter, weapon: WeaponDef, id: number | null): Entity | null {
  const t = world.get(id);
  if (!t || !world.areEnemies(s.team, t.team) || !canTarget(weapon, t)) return null;
  if (!world.isVisibleTo(s.team, t)) return null;
  return t;
}

function fire(world: World, s: Shooter, weapon: WeaponDef, t: Entity): void {
  const homing = weapon.type !== 'artillery';
  let tx = t.x;
  let ty = t.y;
  if (!homing) {
    // Artillery scatter: shells land near, not exactly on, the aim point.
    tx += (world.rng() - 0.5) * 1.2;
    ty += (world.rng() - 0.5) * 1.2;
  }
  world.projectiles.push({
    id: world.allocId(),
    owner: s.owner,
    team: s.team,
    sourceId: s.id,
    x: s.x,
    y: s.y,
    startX: s.x,
    startY: s.y,
    tx,
    ty,
    targetId: t.id,
    homing,
    weapon,
    damageMul: s.damageMul * world.damageBonus(s.owner),
    air: t.kind === 'unit' && t.air,
  });
  s.cooldown = weapon.cooldown;
  s.lastFiredTick = world.tick;
  world.emit({ type: 'shot', from: s.id, x: s.x, y: s.y, tx: t.x, ty: t.y, weapon: weapon.type });
}

/** Aims and fires if possible. Returns true if the target is in range. */
function tryShoot(world: World, s: Shooter, weapon: WeaponDef, t: Entity): boolean {
  const desired = Math.atan2(t.y - s.y, t.x - s.x);
  s.turretFacing = turnToward(s.turretFacing, desired, 0.25);
  if (!inWeaponRange(weapon, s.x, s.y, t)) return false;
  if (s.kind === 'unit' && (s.def.category === 'infantry' || s.air)) s.facing = s.turretFacing;
  if (s.cooldown <= 0 && Math.abs(turnToward(s.turretFacing, desired, 10) - s.turretFacing) < 0.35)
    fire(world, s, weapon, t);
  return true;
}

/** Moves a unit toward its target, re-pathing at most every 15 ticks. */
function chase(world: World, u: Unit, t: Entity): void {
  const goal = u.pathGoal;
  const moved = !goal || Math.hypot(goal.x - t.x, goal.y - t.y) > 1.5;
  if ((!u.moving || moved) && world.tick - u.pathTick >= 15) pathTo(world, u, t.x, t.y);
}

function updateUnit(world: World, u: Unit, weapon: WeaponDef): void {
  const order = u.order;
  switch (order.type) {
    case 'retreat':
      return;
    case 'move':
      if (!order.attackMove) return;
      break;
  }

  if (order.type === 'attack') {
    const t = validTarget(world, u, weapon, order.target);
    if (!t) {
      u.order = { type: 'idle' };
      u.targetId = null;
      u.anchorX = u.x;
      u.anchorY = u.y;
      clearPath(u);
      return;
    }
    u.targetId = t.id;
    if (tryShoot(world, u, weapon, t)) clearPath(u);
    else chase(world, u, t);
    return;
  }

  const hold = order.type === 'hold';
  const scanRadius = hold ? weapon.range : u.vision;
  let t = validTarget(world, u, weapon, u.targetId);
  if (t && hold && !inWeaponRange(weapon, u.x, u.y, t)) t = null;
  if (!t || (world.tick + u.id) % 10 === 0) {
    const better = acquireTarget(world, u, weapon, scanRadius);
    if (better && (!t || better !== t)) t = better;
  }

  if (!t) {
    if (u.targetId !== null) {
      u.targetId = null;
      // Target lost: attack-movers resume their route; idle units return to their post.
      if (order.type === 'move') pathTo(world, u, order.x, order.y);
      else if (order.type === 'idle' && Math.hypot(u.anchorX - u.x, u.anchorY - u.y) > 2)
        pathTo(world, u, u.anchorX, u.anchorY);
    }
    if (!u.moving) u.turretFacing = turnToward(u.turretFacing, u.facing, 0.1);
    return;
  }

  // Leash: idle units do not chase forever.
  if (order.type === 'idle' && Math.hypot(t.x - u.anchorX, t.y - u.anchorY) > BALANCE.chaseLeash) {
    u.targetId = null;
    if (Math.hypot(u.anchorX - u.x, u.anchorY - u.y) > 1) pathTo(world, u, u.anchorX, u.anchorY);
    return;
  }
  u.targetId = t.id;
  if (tryShoot(world, u, weapon, t)) {
    if (u.moving) clearPath(u);
  } else if (!hold) {
    chase(world, u, t);
  }
}

function updateBuilding(world: World, b: Building, weapon: WeaponDef): void {
  let t = validTarget(world, b, weapon, b.targetId);
  if (t && !inWeaponRange(weapon, b.x, b.y, t)) t = null;
  if (!t || (world.tick + b.id) % 10 === 0) t = acquireTarget(world, b, weapon, weapon.range) ?? t;
  b.targetId = t ? t.id : null;
  if (t) tryShoot(world, b, weapon, t);
}

export function updateCombat(world: World): void {
  for (const e of world.entities.values()) {
    if (e.dead) continue;
    const weapon = e.def.weapon;
    if (!weapon) continue;
    if (e.kind === 'building') {
      if (!e.complete) continue;
      const rate = world.isLowPower(e.owner) ? BALANCE.lowPowerFireRate : 1;
      e.cooldown = Math.max(0, e.cooldown - rate);
      updateBuilding(world, e, weapon);
    } else {
      e.cooldown = Math.max(0, e.cooldown - 1);
      updateUnit(world, e, weapon);
    }
  }
}

export function updateProjectiles(world: World): void {
  const keep = [];
  for (const p of world.projectiles) {
    if (p.homing) {
      const t = world.get(p.targetId);
      if (t) {
        p.tx = t.x;
        p.ty = t.y;
      }
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > p.weapon.projectileSpeed) {
      p.x += (dx / d) * p.weapon.projectileSpeed;
      p.y += (dy / d) * p.weapon.projectileSpeed;
      keep.push(p);
      continue;
    }
    p.x = p.tx;
    p.y = p.ty;
    impact(world, p.owner, p.team, p.weapon, p.damageMul, p.x, p.y, p.targetId);
  }
  world.projectiles = keep;
}

function impact(
  world: World,
  owner: number,
  team: number,
  weapon: WeaponDef,
  damageMul: number,
  x: number,
  y: number,
  targetId: number | null,
): void {
  const splash = weapon.splash ?? 0;
  world.emit({ type: 'hit', x, y, weapon: weapon.type, splash });
  if (splash > 0) {
    const victims: Entity[] = [];
    world.spatial.query(x, y, splash + 2, (e) => {
      if (e.dead || !world.areEnemies(team, e.team) || !canTarget(weapon, e)) return;
      const r = e.kind === 'building' ? Math.min(e.w, e.h) / 2 : e.radius;
      if (Math.hypot(e.x - x, e.y - y) <= splash + r) victims.push(e);
    });
    for (const e of victims) {
      const falloff = 1 - 0.5 * Math.min(1, Math.hypot(e.x - x, e.y - y) / (splash + 0.01));
      world.damage(e, computeDamage(weapon, damageMul, e) * falloff, owner);
    }
    return;
  }
  const t = world.get(targetId);
  if (!t) return;
  const r = t.kind === 'building' ? Math.max(t.w, t.h) / 2 + 0.5 : t.radius + 0.5;
  if (Math.hypot(t.x - x, t.y - y) <= r) world.damage(t, computeDamage(weapon, damageMul, t), owner);
}
