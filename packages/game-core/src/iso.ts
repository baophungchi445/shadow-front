/** Isometric 2:1 projection constants (pixels). */
export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export interface Vec2 {
  x: number;
  y: number;
}

/** World (tile-unit) coordinates → isometric screen pixels. */
export function worldToScreen(x: number, y: number): Vec2 {
  return { x: (x - y) * HW, y: (x + y) * HH };
}

/** Isometric screen pixels → world (tile-unit) coordinates. Inverse of worldToScreen. */
export function screenToWorld(sx: number, sy: number): Vec2 {
  const a = sx / HW;
  const b = sy / HH;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Converts a world-space direction angle into the angle it appears at on screen. */
export function worldAngleToScreen(angle: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return Math.atan2((dx + dy) * HH, (dx - dy) * HW);
}

/** Pixel bounds of a width×height map in screen space. */
export function mapScreenBounds(
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const left = worldToScreen(0, height).x;
  const right = worldToScreen(width, 0).x;
  const bottom = worldToScreen(width, height).y;
  return { x: left, y: 0, w: right - left, h: bottom };
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}
