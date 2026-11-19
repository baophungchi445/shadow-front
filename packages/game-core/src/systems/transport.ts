import type { World } from '../world';
import { pathTo } from './movement';

/**
 * Units with a `board` order walk to their carrier and get in once close enough.
 * Moving carriers are followed (re-path every 15 ticks); the order is dropped when the carrier is gone or full.
 */
export function updateBoarding(world: World): void {
  for (const u of world.units()) {
    const o = u.order;
    if (o.type !== 'board') continue;
    const c = world.get(o.carrier);
    if (!c || c.passengers.length >= world.capacityOf(c)) {
      u.order = { type: 'idle' };
      u.anchorX = u.x;
      u.anchorY = u.y;
      continue;
    }
    const reach = c.kind === 'building' ? Math.max(c.w, c.h) / 2 + 1.2 : 1.4;
    if (Math.hypot(c.x - u.x, c.y - u.y) <= reach) {
      world.board(u, c);
      continue;
    }
    const goal = u.pathGoal;
    const drifted = !goal || Math.hypot(goal.x - c.x, goal.y - c.y) > 1.5;
    if ((!u.moving || drifted) && world.tick - u.pathTick >= 15) pathTo(world, u, c.x, c.y);
  }
}
