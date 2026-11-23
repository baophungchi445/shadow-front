import type { Nav } from './grid';
import { MinHeap } from './heap';

export interface PathPoint {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;
const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

/** Octile distance — admissible heuristic for 8-connected grids. */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/**
 * A* over the navigation grid (8-connected, no corner cutting).
 * Returns tile-centre waypoints from the tile after `start` up to `goal`, or null if unreachable.
 * If the goal tile is blocked the nearest walkable tile is used instead.
 */
export function findPath(
  grid: Nav,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
  maxNodes = 6000,
): PathPoint[] | null {
  const startX = Math.floor(sx);
  const startY = Math.floor(sy);
  const goal = grid.nearestWalkable(Math.floor(gx), Math.floor(gy));
  if (!goal) return null;
  if (startX === goal.x && startY === goal.y) return [{ x: goal.x + 0.5, y: goal.y + 0.5 }];

  const W = grid.width;
  const size = W * grid.height;
  const gScore = new Float32Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const startIdx = startY * W + startX;
  const goalIdx = goal.y * W + goal.x;
  gScore[startIdx] = 0;
  const open = new MinHeap<number>();
  open.push(startIdx, octile(startX, startY, goal.x, goal.y));
  // Tie-breaking between equally long routes (v0.16): prefer tiles near the straight start→goal line, and the right
  // side of it over the left. Both terms are relative to the direction of travel, so they stay the same when the
  // map is turned 180° — point-symmetric maps then give both spawns mirrored routes (a fixed neighbour order used
  // to send one spawn around the west of an obstacle and the other one also around the west). The bonus is at most
  // ~0.1 tile, so it never makes a path noticeably longer.
  const lx = goal.x - startX;
  const ly = goal.y - startY;
  const len = Math.hypot(lx, ly) || 1;
  const tie = (x: number, y: number): number => {
    const c = ((x - startX) * ly - (y - startY) * lx) / len; // signed distance from the line (left > 0)
    return 0.0008 * (Math.abs(c) + 0.5 * c);
  };

  // Track the closest node to the goal so a partial path can be returned if the search budget runs out.
  let bestIdx = startIdx;
  let bestH = Infinity;
  let expanded = 0;

  while (open.size > 0) {
    const cur = open.pop()!;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalIdx) return reconstruct(cameFrom, cur, W);
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const h = octile(cx, cy, goal.x, goal.y);
    if (h < bestH) {
      bestH = h;
      bestIdx = cur;
    }
    if (++expanded > maxNodes) break;

    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      // The start tile may be blocked (e.g. unit pushed by a new building); allow leaving it.
      if (!grid.walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!grid.walkable(cx + dx, cy) || !grid.walkable(cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const g = gScore[cur] + cost;
      if (g < gScore[ni]) {
        gScore[ni] = g;
        cameFrom[ni] = cur;
        open.push(ni, g + octile(nx, ny, goal.x, goal.y) + tie(nx, ny));
      }
    }
  }
  if (bestIdx === startIdx) return null;
  return reconstruct(cameFrom, bestIdx, W);
}

function reconstruct(cameFrom: Int32Array, end: number, W: number): PathPoint[] {
  const out: PathPoint[] = [];
  let cur = end;
  while (cameFrom[cur] !== -1) {
    out.push({ x: (cur % W) + 0.5, y: ((cur / W) | 0) + 0.5 });
    cur = cameFrom[cur];
  }
  out.reverse();
  return smoothPath(out);
}

/** Removes collinear intermediate waypoints. */
function smoothPath(path: PathPoint[]): PathPoint[] {
  if (path.length <= 2) return path;
  const out: PathPoint[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1];
    const b = path[i];
    const c = path[i + 1];
    const d1x = Math.sign(b.x - a.x);
    const d1y = Math.sign(b.y - a.y);
    const d2x = Math.sign(c.x - b.x);
    const d2y = Math.sign(c.y - b.y);
    if (d1x !== d2x || d1y !== d2y) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
