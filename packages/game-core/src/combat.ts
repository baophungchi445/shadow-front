import type { WeaponDef } from '@shadow-front/shared-types';
import { DAMAGE_TABLE } from '@shadow-front/game-data';
import type { Entity } from './types';

export function armorOf(e: Entity) {
  return e.kind === 'building' ? 'building' : e.def.armor;
}

export function isAir(e: Entity): boolean {
  return e.kind === 'unit' && e.air;
}

/** v0.15: a submarine (always submerged). */
export function isSub(e: Entity): boolean {
  return e.kind === 'unit' && !!e.def.submarine;
}

/** Final damage after counter table and faction multiplier. */
export function computeDamage(weapon: WeaponDef, damageMul: number, target: Entity): number {
  const sub = isSub(target) ? (weapon.antiSub ?? 0) : 1;
  return weapon.damage * DAMAGE_TABLE[weapon.type][armorOf(target)] * damageMul * sub;
}

export function canTarget(weapon: WeaponDef, target: Entity): boolean {
  // Submarines can only be hit by sub hunters; torpedoes only hit ships.
  if (isSub(target) && !weapon.antiSub) return false;
  if (weapon.navalOnly && !(target.kind === 'unit' && target.naval)) return false;
  const air = isAir(target);
  if (air && !weapon.canTargetAir) return false;
  if (!air && !weapon.canTargetGround) return false;
  return DAMAGE_TABLE[weapon.type][armorOf(target)] > 0;
}

/** Edge distance: centre distance minus target footprint radius (buildings are large). */
export function edgeDistance(fromX: number, fromY: number, target: Entity): number {
  const d = Math.hypot(target.x - fromX, target.y - fromY);
  const r = target.kind === 'building' ? Math.min(target.w, target.h) / 2 : target.radius;
  return Math.max(0, d - r);
}

export function inWeaponRange(
  weapon: WeaponDef,
  fromX: number,
  fromY: number,
  target: Entity,
  bonus = 0,
): boolean {
  const d = edgeDistance(fromX, fromY, target);
  if (d > weapon.range + bonus) return false;
  if (weapon.minRange && Math.hypot(target.x - fromX, target.y - fromY) < weapon.minRange) return false;
  return true;
}

/**
 * Target priority score (higher = better):
 * threats that can shoot back > damaged targets > nearby targets; buildings are lowest priority.
 */
export function targetScore(
  weapon: WeaponDef,
  damageMul: number,
  fromX: number,
  fromY: number,
  t: Entity,
): number {
  const d = edgeDistance(fromX, fromY, t);
  let s = (computeDamage(weapon, damageMul, t) / Math.max(1, t.hp)) * 50;
  const armed = t.kind === 'unit' ? t.def.weapon !== null : t.def.weapon !== null;
  if (armed) s += 30;
  if (t.kind === 'building') s -= 25;
  s += (1 - t.hp / t.maxHp) * 10;
  s -= d * 2;
  return s;
}
