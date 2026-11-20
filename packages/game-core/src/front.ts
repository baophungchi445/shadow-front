import type { Building } from './types';
/** Point `dist` tiles outside the middle of a building's front edge (see `Building.facing`). */
export function frontOf(
  b: Pick<Building, 'tx' | 'ty' | 'w' | 'h' | 'facing'>,
  dist: number,
): { x: number; y: number } {
  const cx = b.tx + b.w / 2;
  const cy = b.ty + b.h / 2;
  switch (b.facing) {
    case 1:
      return { x: b.tx + b.w + dist, y: cy };
    case 2:
      return { x: cx, y: b.ty - dist };
    case 3:
      return { x: b.tx - dist, y: cy };
    default:
      return { x: cx, y: b.ty + b.h + dist };
  }
}
