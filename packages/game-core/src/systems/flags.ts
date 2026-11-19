import { BALANCE } from '@shadow-front/game-data';
import type { Flag, Unit } from '../types';
import type { World } from '../world';

/**
 * Capture the Flag.
 * - Enemy ground units touching a flag pick it up; it travels with the carrier.
 * - When the carrier dies (or leaves the map, e.g. boards a transport) the flag drops where it was.
 * - A team touching its own dropped flag returns it home instantly.
 * - Bringing an enemy flag to your own flag stand while your flag is home scores a capture.
 */
export function updateFlags(world: World): void {
  if (!world.flags.length) return;
  const r = BALANCE.flagRadius;
  for (const f of world.flags) {
    if (f.carrier !== null) {
      const c = world.get(f.carrier);
      if (!c || c.kind !== 'unit') {
        f.carrier = null;
        world.emit({ type: 'flagDropped', team: f.team, x: f.x, y: f.y });
      } else {
        f.x = c.x;
        f.y = c.y;
        const home = world.flags.find((h) => h.team === c.team);
        if (home && home.atHome && Math.hypot(c.x - home.homeX, c.y - home.homeY) <= r + 0.5) {
          world.captures.set(c.team, (world.captures.get(c.team) ?? 0) + 1);
          world.emit({ type: 'flagCaptured', team: c.team, flagTeam: f.team });
          returnHome(f);
        }
        continue;
      }
    }
    // Flag lying on the ground (home or dropped): look for someone touching it.
    let toucher: Unit | null = null;
    let ownTouch = false;
    world.spatial.query(f.x, f.y, r + 1, (e) => {
      if (e.kind !== 'unit' || e.dead || e.air || Math.hypot(e.x - f.x, e.y - f.y) > r) return;
      if (e.team === f.team) ownTouch = true;
      else if (!toucher) toucher = e;
    });
    if (!f.atHome && ownTouch) {
      returnHome(f);
      world.emit({ type: 'flagReturned', team: f.team });
      continue;
    }
    const taker = toucher as Unit | null;
    if (taker) {
      f.carrier = taker.id;
      f.atHome = false;
      world.emit({ type: 'flagTaken', team: f.team, by: taker.team, x: f.x, y: f.y });
    }
  }
}

function returnHome(f: Flag): void {
  f.carrier = null;
  f.atHome = true;
  f.x = f.homeX;
  f.y = f.homeY;
}
