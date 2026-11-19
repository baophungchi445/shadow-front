import type { BuildingTypeId, PlayerId } from '@shadow-front/shared-types';
import { BUILDINGS } from '@shadow-front/game-data';
import type { Building, World } from '@shadow-front/game-core';

/**
 * Keeps a one-tile walkable border around new buildings so the AI never walls in its own units.
 */
function hasClearBorder(world: World, tx: number, ty: number, w: number, h: number): boolean {
  for (let j = ty - 1; j <= ty + h; j++)
    for (let i = tx - 1; i <= tx + w; i++) {
      const edge = i === tx - 1 || i === tx + w || j === ty - 1 || j === ty + h;
      if (!edge) continue;
      if (!world.grid.inBounds(i, j)) return false;
      if (world.grid.occupantAt(i, j) !== 0) return false;
    }
  return true;
}

/** Spiral search for a valid footprint position around (cx, cy). */
export function findPlacement(
  world: World,
  player: PlayerId,
  type: BuildingTypeId,
  cx: number,
  cy: number,
  maxRadius = 12,
): { tx: number; ty: number } | null {
  const def = BUILDINGS[type];
  const ox = Math.floor(cx - def.w / 2);
  const oy = Math.floor(cy - def.h / 2);
  for (let r = 0; r <= maxRadius; r++) {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const tx = ox + i;
        const ty = oy + j;
        if (world.placementError(player, type, tx, ty)) continue;
        if (!hasClearBorder(world, tx, ty, def.w, def.h)) continue;
        return { tx, ty };
      }
  }
  return null;
}

/** Finds an extractor site: ore with remaining credits, near own base, not already covered by an extractor. */
export function findExtractorSite(
  world: World,
  player: PlayerId,
  base: Building,
): { tx: number; ty: number } | null {
  const covered = new Set<number>();
  for (const b of world.buildings())
    if (b.type === 'resource-extractor') for (const i of world.oreTilesNear(b.x, b.y)) covered.add(i);
  const candidates: { x: number; y: number; d: number }[] = [];
  const W = world.map.width;
  for (let i = 0; i < world.oreRemaining.length; i++) {
    if (world.oreRemaining[i] <= 0 || covered.has(i)) continue;
    const x = (i % W) + 0.5;
    const y = Math.floor(i / W) + 0.5;
    const d = Math.hypot(x - base.x, y - base.y);
    if (d < 18) candidates.push({ x, y, d });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const c of candidates.slice(0, 12)) {
    const spot = findPlacement(world, player, 'resource-extractor', c.x, c.y, 3);
    if (spot) return spot;
  }
  return null;
}
