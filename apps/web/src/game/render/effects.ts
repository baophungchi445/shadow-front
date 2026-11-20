import Phaser from 'phaser';
import { QUALITY, type GraphicsQuality } from './quality';

type Kind = 'fire' | 'smoke' | 'flash' | 'spark' | 'ring' | 'debris' | 'marker';

interface Particle {
  img: Phaser.GameObjects.Image | null;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
}

/**
 * Lightweight particle system drawn with two Graphics layers:
 * additive (fire, flashes) and normal (smoke, debris). Positions are screen pixels.
 */
export class Effects {
  private readonly add: Phaser.GameObjects.Graphics;
  private readonly normal: Phaser.GameObjects.Graphics;
  private readonly ground: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  /** Recycled particle sprites per blend layer (Graphics circles were re-tessellated every frame). */
  private readonly freeAdd: Phaser.GameObjects.Image[] = [];
  private readonly freeNormal: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;
  private readonly rnd = Math.random;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    if (!scene.textures.exists('fx-soft')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      // Soft round particle: stacked translucent discs approximate a radial falloff.
      for (let r = 16; r > 0; r -= 2) {
        g.fillStyle(0xffffff, 0.14);
        g.fillCircle(16, 16, r);
      }
      g.generateTexture('fx-soft', 32, 32);
      g.clear();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture('fx-dot', 4, 4);
      g.destroy();
    }
    this.ground = scene.add.graphics().setDepth(-4000);
    this.normal = scene.add.graphics().setDepth(20000);
    this.add = scene.add.graphics().setDepth(20001).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** Graphics quality: particle cap and how much optional smoke / debris is kept. */
  quality: GraphicsQuality = 'high';
  private skip = 0;

  private push(p: Omit<Particle, 'max' | 'img'>): void {
    const q = QUALITY[this.quality];
    if (this.particles.length > q.particles) return;
    if (
      q.keepEvery > 1 &&
      p.kind !== 'ring' &&
      p.kind !== 'marker' &&
      p.kind !== 'flash' &&
      ++this.skip % q.keepEvery !== 0
    )
      return;
    let img: Phaser.GameObjects.Image | null = null;
    if (p.kind !== 'ring' && p.kind !== 'marker') {
      const additive = p.kind === 'flash' || p.kind === 'fire' || p.kind === 'spark';
      const pool = additive ? this.freeAdd : this.freeNormal;
      img = pool.pop() ?? null;
      if (!img) {
        img = this.scene.add.image(0, 0, 'fx-soft').setDepth(additive ? 20001 : 20000);
        if (additive) img.setBlendMode(Phaser.BlendModes.ADD);
      }
      img
        .setTexture(p.kind === 'spark' || p.kind === 'debris' ? 'fx-dot' : 'fx-soft')
        .setTint(p.color)
        .setVisible(true);
    }
    this.particles.push({ ...p, img, max: p.life });
  }

  private release(p: Particle): void {
    if (!p.img) return;
    p.img.setVisible(false);
    const additive = p.kind === 'flash' || p.kind === 'fire' || p.kind === 'spark';
    (additive ? this.freeAdd : this.freeNormal).push(p.img);
    p.img = null;
  }

  muzzle(x: number, y: number, big: boolean): void {
    this.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: big ? 5 : 3, size: big ? 9 : 5, color: 0xffe08a });
    if (big) this.push({ kind: 'smoke', x, y, vx: 0, vy: -0.2, life: 30, size: 5, color: 0x9a948a });
  }

  impact(x: number, y: number, weapon: string, splash: number): void {
    if (weapon === 'bullet') {
      for (let i = 0; i < 2; i++)
        this.push({
          kind: 'spark',
          x,
          y,
          vx: (this.rnd() - 0.5) * 2,
          vy: -this.rnd() * 1.5,
          life: 8,
          size: 1.5,
          color: 0xffd27a,
        });
      return;
    }
    const big = weapon === 'artillery' || splash > 0;
    this.explosion(x, y, big ? 1.3 : 0.7);
  }

  explosion(x: number, y: number, scale: number): void {
    this.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: 6, size: 22 * scale, color: 0xfff1c0 });
    this.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 14, size: 30 * scale, color: 0xffb060 });
    const n = Math.round(8 * scale);
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2;
      const s = this.rnd() * 1.6 * scale;
      this.push({
        kind: 'fire',
        x,
        y: y - 4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5 - 0.6,
        life: 16 + this.rnd() * 12,
        size: (6 + this.rnd() * 6) * scale,
        color: this.rnd() < 0.5 ? 0xff8a2a : 0xffc04a,
      });
    }
    for (let i = 0; i < n; i++) {
      this.push({
        kind: 'smoke',
        x: x + (this.rnd() - 0.5) * 14 * scale,
        y: y - 6,
        vx: (this.rnd() - 0.5) * 0.4,
        vy: -0.35 - this.rnd() * 0.4,
        life: 50 + this.rnd() * 40,
        size: (7 + this.rnd() * 6) * scale,
        color: this.rnd() < 0.5 ? 0x4a4642 : 0x625d57,
      });
    }
    for (let i = 0; i < n / 2; i++) {
      const a = this.rnd() * Math.PI * 2;
      this.push({
        kind: 'debris',
        x,
        y: y - 4,
        vx: Math.cos(a) * 2.2 * scale,
        vy: -2 - this.rnd() * 2,
        life: 24,
        size: 2,
        color: 0x2a2622,
      });
    }
  }

  smokePuff(x: number, y: number, dark: boolean): void {
    this.push({
      kind: 'smoke',
      x: x + (this.rnd() - 0.5) * 10,
      y,
      vx: 0.15,
      vy: -0.45,
      life: 60,
      size: 6 + this.rnd() * 4,
      color: dark ? 0x2e2b28 : 0x77716a,
    });
    if (dark && this.rnd() < 0.5)
      this.push({ kind: 'fire', x, y: y + 2, vx: 0, vy: -0.4, life: 14, size: 5, color: 0xff7a22 });
  }

  /** Small licking flames on a burning (incendiary) target. */
  flames(x: number, y: number, spread: number): void {
    this.push({
      kind: 'fire',
      x: x + (this.rnd() - 0.5) * spread,
      y: y + (this.rnd() - 0.5) * spread * 0.4,
      vx: 0,
      vy: -0.5 - this.rnd() * 0.3,
      life: 12 + this.rnd() * 8,
      size: 3 + this.rnd() * 3,
      color: this.rnd() < 0.5 ? 0xff7a22 : 0xffb43a,
    });
  }

  trail(x: number, y: number): void {
    this.push({ kind: 'smoke', x, y, vx: 0, vy: -0.1, life: 18, size: 2.5, color: 0xcfcac2 });
  }

  /** Command feedback marker on the ground. */
  marker(x: number, y: number, color: number): void {
    this.push({ kind: 'marker', x, y, vx: 0, vy: 0, life: 22, size: 18, color });
  }

  update(): void {
    this.add.clear();
    this.normal.clear();
    this.ground.clear();
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life--;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      alive.push(p);
      p.x += p.vx;
      p.y += p.vy;
      const t = p.life / p.max;
      const img = p.img;
      switch (p.kind) {
        case 'flash':
          img!
            .setPosition(p.x, p.y)
            .setAlpha(t)
            .setScale((p.size * (0.6 + 0.4 * t)) / 12);
          break;
        case 'fire':
          p.vx *= 0.92;
          p.vy *= 0.92;
          img!
            .setPosition(p.x, p.y)
            .setAlpha(t * 0.9)
            .setScale((p.size * (0.4 + 0.6 * t)) / 12);
          break;
        case 'spark':
          img!
            .setPosition(p.x, p.y)
            .setAlpha(t)
            .setScale(p.size / 4);
          break;
        case 'smoke':
          p.vx *= 0.99;
          img!
            .setPosition(p.x, p.y)
            .setAlpha(t * 0.55)
            .setScale((p.size * (1.6 - 0.6 * t)) / 12);
          break;
        case 'debris':
          p.vy += 0.25;
          img!
            .setPosition(p.x, p.y)
            .setAlpha(1)
            .setScale(p.size / 4);
          break;
        case 'ring':
          this.add.lineStyle(2, p.color, t * 0.8);
          this.add.strokeEllipse(p.x, p.y, p.size * (1.4 - t) * 2, p.size * (1.4 - t));
          break;
        case 'marker': {
          const s = p.size * (0.5 + 0.5 * t);
          this.ground.lineStyle(2, p.color, t);
          this.ground.strokePoints(
            [
              { x: p.x, y: p.y - s / 2 },
              { x: p.x + s, y: p.y },
              { x: p.x, y: p.y + s / 2 },
              { x: p.x - s, y: p.y },
            ],
            true,
          );
          break;
        }
      }
    }
    this.particles = alive;
  }

  destroy(): void {
    for (const p of this.particles) p.img?.destroy();
    for (const img of [...this.freeAdd, ...this.freeNormal]) img.destroy();
    this.add.destroy();
    this.normal.destroy();
    this.ground.destroy();
  }
}
