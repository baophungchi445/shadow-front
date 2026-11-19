import type { TeamId } from '@shadow-front/shared-types';

/** Per-team fog of war: `visible` = currently seen, `explored` = ever seen. */
export class FogOfWar {
  private readonly visible = new Map<TeamId, Uint8Array>();
  private readonly explored = new Map<TeamId, Uint8Array>();
  private readonly circles = new Map<number, Int16Array>();
  /** Incremented on every recompute so renderers can skip redundant redraws. */
  version = 0;

  constructor(
    readonly width: number,
    readonly height: number,
    teams: TeamId[],
  ) {
    for (const t of teams) {
      this.visible.set(t, new Uint8Array(width * height));
      this.explored.set(t, new Uint8Array(width * height));
    }
  }

  /** Cached list of (dx, dy) offsets inside a circle of radius r. */
  private circle(r: number): Int16Array {
    const key = Math.round(r * 4);
    let c = this.circles.get(key);
    if (!c) {
      const pts: number[] = [];
      const R = Math.ceil(r);
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= r * r) pts.push(i, j);
      c = Int16Array.from(pts);
      this.circles.set(key, c);
    }
    return c;
  }

  beginUpdate(): void {
    for (const v of this.visible.values()) v.fill(0);
  }

  reveal(team: TeamId, x: number, y: number, r: number): void {
    const vis = this.visible.get(team);
    const exp = this.explored.get(team);
    if (!vis || !exp) return;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    const c = this.circle(r);
    for (let k = 0; k < c.length; k += 2) {
      const tx = cx + c[k];
      const ty = cy + c[k + 1];
      if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
      const i = ty * this.width + tx;
      vis[i] = 1;
      exp[i] = 1;
    }
  }

  endUpdate(): void {
    this.version++;
  }

  isVisible(team: TeamId, x: number, y: number): boolean {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return (this.visible.get(team)?.[ty * this.width + tx] ?? 0) === 1;
  }

  isExplored(team: TeamId, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return (this.explored.get(team)?.[ty * this.width + tx] ?? 0) === 1;
  }

  visibleGrid(team: TeamId): Uint8Array | undefined {
    return this.visible.get(team);
  }

  exploredGrid(team: TeamId): Uint8Array | undefined {
    return this.explored.get(team);
  }
}
