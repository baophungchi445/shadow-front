import type Phaser from 'phaser';
import type { World } from '@shadow-front/game-core';
import type { GraphicsQuality } from './quality';

/** Particles per weather and graphics quality (low / medium / high). */
const COUNTS = { low: 70, medium: 150, high: 240 } as const;

interface Drop {
  /** Position relative to the camera view, 0..1. */
  x: number;
  y: number;
  /** Speed multiplier (depth illusion). */
  s: number;
}

/**
 * Weather and darkness drawn over the battlefield (v0.11): a darkening tint at night, a colour cast per weather,
 * and rain streaks / snowflakes / blowing sand that move across the camera view. Purely visual: the effects on
 * vision and speed live in the simulation.
 */
export class WeatherLayer {
  private readonly tint: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private drops: Drop[] = [];
  quality: GraphicsQuality = 'medium';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    // Above units and the fog of war (30000), below selection / HUD overlays (40000).
    this.tint = scene.add.graphics().setDepth(35000);
    this.fx = scene.add.graphics().setDepth(35001);
  }

  /** Night darkness 0..1 currently drawn (for tests / HUD). */
  darkness(): number {
    return 1 - this.world.daylight();
  }

  update(deltaMs: number): void {
    const view = this.scene.cameras.main.worldView;
    const pad = 40;
    const x = view.x - pad;
    const y = view.y - pad;
    const w = view.width + pad * 2;
    const h = view.height + pad * 2;

    this.tint.clear();
    const dark = this.darkness();
    if (dark > 0) {
      this.tint.fillStyle(0x07112a, 0.45 * dark);
      this.tint.fillRect(x, y, w, h);
    }
    const weather = this.world.weather;
    const cast =
      weather === 'sandstorm'
        ? { c: 0xb4874a, a: 0.22 }
        : weather === 'rain'
          ? { c: 0x2a3a4c, a: 0.14 }
          : weather === 'snow'
            ? { c: 0xe4edf5, a: 0.1 }
            : null;
    if (cast) {
      this.tint.fillStyle(cast.c, cast.a);
      this.tint.fillRect(x, y, w, h);
    }

    this.fx.clear();
    if (weather === 'clear') return;
    const n = COUNTS[this.quality];
    while (this.drops.length < n)
      this.drops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    if (this.drops.length > n) this.drops.length = n;
    const dt = Math.min(100, deltaMs) / 1000;
    const zoom = this.scene.cameras.main.zoom;

    if (weather === 'rain') {
      this.fx.lineStyle(1 / zoom, 0xaecbe6, 0.55);
      for (const d of this.drops) {
        d.y += dt * 1.6 * d.s;
        d.x -= dt * 0.25 * d.s;
        this.wrap(d);
        const px = x + d.x * w;
        const py = y + d.y * h;
        const len = (16 * d.s) / zoom;
        this.fx.lineBetween(px, py, px - len * 0.25, py + len);
      }
    } else if (weather === 'snow') {
      this.fx.fillStyle(0xffffff, 0.85);
      const t = this.scene.time.now / 1000;
      for (const d of this.drops) {
        d.y += dt * 0.12 * d.s;
        d.x += dt * 0.03 * Math.sin(t + d.s * 10);
        this.wrap(d);
        this.fx.fillCircle(x + d.x * w, y + d.y * h, (1.6 * d.s) / zoom);
      }
    } else {
      // Sandstorm: fast horizontal streaks.
      this.fx.lineStyle(1.5 / zoom, 0xd9b27a, 0.45);
      for (const d of this.drops) {
        d.x += dt * 0.9 * d.s;
        d.y += dt * 0.05 * d.s;
        this.wrap(d);
        const px = x + d.x * w;
        const py = y + d.y * h;
        const len = (26 * d.s) / zoom;
        this.fx.lineBetween(px, py, px - len, py - len * 0.08);
      }
    }
  }

  private wrap(d: Drop): void {
    if (d.y > 1) d.y -= 1;
    if (d.y < 0) d.y += 1;
    if (d.x > 1) d.x -= 1;
    if (d.x < 0) d.x += 1;
  }
}
