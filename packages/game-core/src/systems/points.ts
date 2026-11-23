import type { PlayerId, TeamId } from '@shadow-front/shared-types';
import { BALANCE } from '@shadow-front/game-data';
import type { World } from '../world';

/** Interval (ticks) at which control points are evaluated; must match the caller in World.step(). */
const INTERVAL = 10;

/**
 * Strategic control points. Ground units inside the radius capture a point: an enemy-held
 * point is first neutralised, then captured. More units capture faster (up to 3×).
 * Contested points (several teams present) are frozen.
 */
export function updateControlPoints(world: World): void {
  const r = BALANCE.pointRadius;
  for (const pt of world.points) {
    // Drop ownership credit from defeated players (team keeps the point if a teammate is alive).
    if (pt.player !== null && world.players[pt.player].defeated) {
      const mate = world.players.find((p) => p.team === pt.team && !p.defeated);
      pt.player = mate ? mate.id : null;
      if (!mate) pt.team = null;
    }

    const counts = new Map<TeamId, Map<PlayerId, number>>();
    world.spatial.query(pt.x, pt.y, r + 1, (e) => {
      if (e.kind !== 'unit' || e.dead || e.air || e.naval) return;
      if (Math.hypot(e.x - pt.x, e.y - pt.y) > r) return;
      let m = counts.get(e.team);
      if (!m) counts.set(e.team, (m = new Map()));
      m.set(e.owner, (m.get(e.owner) ?? 0) + 1);
    });
    const teams = [...counts.keys()];
    pt.contested = teams.length > 1;
    if (teams.length !== 1) {
      if (teams.length === 0)
        pt.progress = Math.max(0, pt.progress - INTERVAL / (BALANCE.pointCaptureTicks * 2));
      continue;
    }
    const team = teams[0];
    const byPlayer = counts.get(team)!;
    const n = [...byPlayer.values()].reduce((a, b) => a + b, 0);
    if (pt.team === team) {
      pt.capTeam = null;
      pt.progress = 0;
      continue;
    }
    if (pt.capTeam !== team) {
      pt.capTeam = team;
      pt.progress = 0;
    }
    pt.progress += (INTERVAL * Math.min(3, n)) / BALANCE.pointCaptureTicks;
    if (pt.progress < 1) continue;
    pt.progress = 0;
    if (pt.team !== null) {
      const previousTeam = pt.team;
      pt.team = null;
      pt.player = null;
      world.emit({ type: 'pointNeutralized', point: pt.index, previousTeam });
    } else {
      let best: PlayerId = -1;
      let bestN = -1;
      for (const [pid, c] of byPlayer) if (c > bestN) [best, bestN] = [pid, c];
      pt.team = team;
      pt.player = best;
      pt.capTeam = null;
      world.emit({ type: 'pointCaptured', point: pt.index, team, previousTeam: null });
    }
  }
}
