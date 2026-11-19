import { TICK_RATE } from '@shadow-front/game-data';
import type { Entity } from '../types';
import type { World } from '../world';

/** Support units act every this many ticks. */
export const SUPPORT_INTERVAL = 10;

/**
 * Medics heal wounded friendly infantry; engineers repair friendly vehicles and completed buildings.
 * Each support unit restores HP to its single most damaged eligible target in range. Free of charge.
 */
export function updateSupport(world: World): void {
  if (world.tick % SUPPORT_INTERVAL !== 0) return;
  for (const u of world.units()) {
    const s = u.def.support;
    if (!s) continue;
    let best: Entity | null = null;
    let bestRatio = 1;
    world.spatial.query(u.x, u.y, s.range + 2, (e) => {
      if (e.dead || e.id === u.id || e.team !== u.team || e.hp >= e.maxHp) return;
      const eligible =
        s.heals === 'infantry'
          ? e.kind === 'unit' && e.def.category === 'infantry'
          : (e.kind === 'unit' && e.def.category !== 'infantry') || (e.kind === 'building' && e.complete);
      if (!eligible) return;
      const reach = s.range + (e.kind === 'building' ? Math.max(e.w, e.h) / 2 : 0);
      if (Math.hypot(e.x - u.x, e.y - u.y) > reach) return;
      const ratio = e.hp / e.maxHp;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = e;
      }
    });
    const target = best as Entity | null;
    if (target) {
      target.hp = Math.min(target.maxHp, target.hp + (s.rate * SUPPORT_INTERVAL) / TICK_RATE);
      u.lastFiredTick = world.tick; // drives a small "working" effect in the renderer
      u.targetId = target.id;
    } else if (u.targetId !== null) {
      u.targetId = null;
    }
  }
}
