import type { Entity } from './types';

/** Uniform-grid spatial hash rebuilt every tick for range queries. */
export class SpatialHash {
  private readonly cells = new Map<number, Entity[]>();
  constructor(
    private readonly cellSize: number,
    private readonly cols: number,
  ) {}

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number): number {
    return cy * (this.cols + 2) + cx;
  }

  insert(e: Entity): void {
    const k = this.key(Math.floor(e.x / this.cellSize), Math.floor(e.y / this.cellSize));
    let list = this.cells.get(k);
    if (!list) {
      list = [];
      this.cells.set(k, list);
    }
    list.push(e);
  }

  /** Calls `fn` for every entity whose cell overlaps the query circle (caller filters exact distance). */
  query(x: number, y: number, r: number, fn: (e: Entity) => void): void {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) for (const e of list) fn(e);
      }
  }
}
