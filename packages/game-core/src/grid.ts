import type { MapDef, TileKind } from '@shadow-front/shared-types';
import { TILE_BLOCKED } from '@shadow-front/game-data';

/**
 * Navigation grid. Combines static terrain blocking with dynamic building occupancy.
 * Ground units may only stand on tiles where `walkable()` is true.
 */
export class NavGrid {
  readonly width: number;
  readonly height: number;
  readonly tiles: TileKind[];
  private readonly terrainBlocked: Uint8Array;
  /** Entity id of the building occupying each tile (0 = free). */
  private readonly occupant: Int32Array;
  /** Bumped every time occupancy changes so paths can be invalidated. */
  version = 0;

  constructor(map: MapDef) {
    this.width = map.width;
    this.height = map.height;
    this.tiles = map.tiles.slice();
    this.terrainBlocked = new Uint8Array(this.width * this.height);
    this.occupant = new Int32Array(this.width * this.height);
    for (let i = 0; i < this.tiles.length; i++) this.terrainBlocked[i] = TILE_BLOCKED[this.tiles[i]] ? 1 : 0;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  index(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  tile(tx: number, ty: number): TileKind | undefined {
    return this.inBounds(tx, ty) ? this.tiles[this.index(tx, ty)] : undefined;
  }

  walkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.index(tx, ty);
    return this.terrainBlocked[i] === 0 && this.occupant[i] === 0;
  }

  /** Changes a tile's terrain (destructible terrain); invalidates paths. */
  setTerrain(tx: number, ty: number, kind: TileKind): void {
    if (!this.inBounds(tx, ty)) return;
    const i = this.index(tx, ty);
    this.tiles[i] = kind;
    this.terrainBlocked[i] = TILE_BLOCKED[kind] ? 1 : 0;
    this.version++;
  }

  terrainWalkable(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.terrainBlocked[this.index(tx, ty)] === 0;
  }

  occupantAt(tx: number, ty: number): number {
    return this.inBounds(tx, ty) ? this.occupant[this.index(tx, ty)] : 0;
  }

  setOccupied(tx: number, ty: number, w: number, h: number, id: number): void {
    for (let j = ty; j < ty + h; j++)
      for (let i = tx; i < tx + w; i++) if (this.inBounds(i, j)) this.occupant[this.index(i, j)] = id;
    this.version++;
  }

  /** Breadth-first ring search for the nearest walkable tile to (tx, ty). */
  nearestWalkable(tx: number, ty: number, maxRadius = 24): { x: number; y: number } | null {
    return nearestBy(this, tx, ty, maxRadius);
  }

  /**
   * Distinct walkable tiles spiralling outward from (tx, ty); used to spread group-move destinations.
   */
  spreadTiles(tx: number, ty: number, count: number): { x: number; y: number }[] {
    return spreadBy(this, tx, ty, count);
  }

  /** Navigation view for ships (v0.13): only open water is passable. */
  water(): WaterNav {
    return new WaterNav(this);
  }
}

/** What pathfinding and move-spreading need from a navigation layer (land grid or water view). */
export interface Nav {
  readonly width: number;
  readonly height: number;
  readonly version: number;
  inBounds(tx: number, ty: number): boolean;
  walkable(tx: number, ty: number): boolean;
  nearestWalkable(tx: number, ty: number, maxRadius?: number): { x: number; y: number } | null;
  spreadTiles(tx: number, ty: number, count: number): { x: number; y: number }[];
}

/** Water-only view over a NavGrid: ships sail on water tiles and nowhere else (v0.13). */
export class WaterNav implements Nav {
  constructor(private readonly grid: NavGrid) {}
  get width(): number {
    return this.grid.width;
  }
  get height(): number {
    return this.grid.height;
  }
  get version(): number {
    return this.grid.version;
  }
  inBounds(tx: number, ty: number): boolean {
    return this.grid.inBounds(tx, ty);
  }
  walkable(tx: number, ty: number): boolean {
    return this.grid.tile(tx, ty) === 'water';
  }
  /** Ships sent inland head for the closest water, however far (the search is still bounded by the map). */
  nearestWalkable(tx: number, ty: number, maxRadius = 64): { x: number; y: number } | null {
    return nearestBy(this, tx, ty, maxRadius);
  }
  spreadTiles(tx: number, ty: number, count: number): { x: number; y: number }[] {
    return spreadBy(this, tx, ty, count);
  }
}

type Walk = Pick<Nav, 'width' | 'height' | 'walkable'>;

function nearestBy(g: Walk, tx: number, ty: number, maxRadius: number): { x: number; y: number } | null {
  tx = Math.max(0, Math.min(g.width - 1, Math.floor(tx)));
  ty = Math.max(0, Math.min(g.height - 1, Math.floor(ty)));
  if (g.walkable(tx, ty)) return { x: tx, y: ty };
  for (let r = 1; r <= maxRadius; r++) {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const x = tx + i;
        const y = ty + j;
        if (!g.walkable(x, y)) continue;
        const d = i * i + j * j;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    if (best) return best;
  }
  return null;
}

function spreadBy(g: Walk & Pick<Nav, 'nearestWalkable'>, tx: number, ty: number, count: number) {
  const out: { x: number; y: number }[] = [];
  const origin = g.nearestWalkable(tx, ty);
  if (!origin) return out;
  for (let r = 0; out.length < count && r < 20; r++) {
    const ring: { x: number; y: number; d: number }[] = [];
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const x = origin.x + i;
        const y = origin.y + j;
        if (g.walkable(x, y)) ring.push({ x, y, d: i * i + j * j });
      }
    ring.sort((a, b) => a.d - b.d);
    for (const t of ring) {
      if (out.length >= count) break;
      out.push({ x: t.x, y: t.y });
    }
  }
  return out;
}
