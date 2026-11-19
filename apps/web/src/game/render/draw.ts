import type Phaser from 'phaser';
import { TILE_H, TILE_W } from '@shadow-front/game-core';

/** Multiplies the RGB channels of a colour. */
export function shade(color: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

/** Linear blend: t = 0 → a, t = 1 → b. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** World-space offset (tiles) → screen pixel offset. */
export function iso(dx: number, dy: number): { x: number; y: number } {
  return { x: (dx - dy) * (TILE_W / 2), y: (dx + dy) * (TILE_H / 2) };
}

export interface Pt {
  x: number;
  y: number;
}

function poly(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

/**
 * Draws a rotated box (prism) standing on the ground, seen from the isometric camera.
 * (cx, cy) is a world-space offset from the graphics origin; l/w are in tiles; h and z in pixels.
 * Only faces visible to the camera are filled. Light comes from the top-left.
 */
export function drawBox(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  l: number,
  w: number,
  angle: number,
  h: number,
  z: number,
  color: number,
): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const local: [number, number][] = [
    [l / 2, w / 2],
    [l / 2, -w / 2],
    [-l / 2, -w / 2],
    [-l / 2, w / 2],
  ];
  const base = local.map(([a, b]) => {
    const p = iso(cx + a * c - b * s, cy + a * s + b * c);
    return { x: p.x, y: p.y - z };
  });
  const top = base.map((p) => ({ x: p.x, y: p.y - h }));
  if (h > 0) {
    for (let i = 0; i < 4; i++) {
      const a = base[i];
      const b = base[(i + 1) % 4];
      // Edge outward normal in screen space; faces with a downward normal face the camera.
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const nx = ey;
      const ny = -ex;
      const center = base.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
      const mid = { x: (a.x + b.x) / 2 - center.x, y: (a.y + b.y) / 2 - center.y };
      const outward = nx * mid.x + ny * mid.y > 0 ? 1 : -1;
      if (ny * outward <= 0) continue;
      const lit = nx * outward < 0 ? 0.78 : 0.58;
      poly(g, [a, b, top[(i + 1) % 4], top[i]], shade(color, lit));
    }
  }
  poly(g, top, color);
  return top;
}

/** Iso diamond for a w×h tile footprint centred on the origin, raised by z pixels. */
export function footprint(w: number, h: number, z = 0): Pt[] {
  const t = iso(-w / 2, -h / 2);
  const r = iso(w / 2, -h / 2);
  const b = iso(w / 2, h / 2);
  const l = iso(-w / 2, h / 2);
  return [t, r, b, l].map((p) => ({ x: p.x, y: p.y - z }));
}

/** Axis-aligned isometric prism over a footprint (buildings, city blocks). Returns the top face. */
export function drawPrism(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  height: number,
  color: number,
  z = 0,
): Pt[] {
  const base = footprint(w, h, z);
  const top = footprint(w, h, z + height);
  const [, r, b, l] = base;
  const [, rt, bt, lt] = top;
  if (height > 0) {
    poly(g, [l, b, bt, lt], shade(color, 0.78));
    poly(g, [b, r, rt, bt], shade(color, 0.58));
  }
  poly(g, top, color);
  return top;
}

/** Lerp between two points. */
export function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Vertical cylinder seen in iso view (power plant towers, tanks). */
export function drawCylinder(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  height: number,
  color: number,
  taper = 1,
): void {
  const ry = rx / 2;
  const topRx = rx * taper;
  g.fillStyle(shade(color, 0.68));
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.beginPath();
  g.moveTo(x - rx, y);
  g.lineTo(x - topRx, y - height);
  g.lineTo(x + topRx, y - height);
  g.lineTo(x + rx, y);
  g.closePath();
  g.fillPath();
  g.fillStyle(shade(color, 0.85));
  g.fillRect(x - topRx * 0.9, y - height, topRx * 0.6, height * 0.95);
  g.fillStyle(color);
  g.fillEllipse(x, y - height, topRx * 2, topRx);
  g.fillStyle(shade(color, 0.45));
  g.fillEllipse(x, y - height, topRx * 1.4, topRx * 0.7);
}
