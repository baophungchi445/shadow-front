import type Phaser from 'phaser';

/**
 * Renders a procedural shape once into a texture and reuses it.
 *
 * Phaser re-tessellates every Graphics object on every frame (earcut), which profiling showed
 * to cost ~75% of frame time in large battles. Baking each shape per (type, colour, direction)
 * into a texture turns units and buildings into cheap batched sprites.
 *
 * (ox, oy) is where the shape's origin (ground point) lands inside the w×h texture.
 */
export function cachedTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  ox: number,
  oy: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): string {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.translateCanvas(ox, oy);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }
  return key;
}

const TAU = Math.PI * 2;

/** Quantises an angle to one of `steps` directions. */
export function dirIndex(angle: number, steps: number): number {
  return Math.round((((angle % TAU) + TAU) % TAU) / (TAU / steps)) % steps;
}

export function dirAngle(index: number, steps: number): number {
  return (index * TAU) / steps;
}
