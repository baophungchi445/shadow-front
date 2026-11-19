import type Phaser from 'phaser';
import type { TeamId } from '@shadow-front/shared-types';
import { TILE_W, type World } from '@shadow-front/game-core';

/**
 * Fog of war overlay. The per-tile visibility grid is written into a tiny canvas texture
 * (1 px = 1 tile) and displayed through an affine transform that exactly matches the
 * isometric projection: scaleY(0.5) · rotate(45°) · scale(TILE_W/√2·… ).
 * Linear filtering gives soft fog edges for free.
 */
export class FogLayer {
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly outer: Phaser.GameObjects.Container;
  private lastVersion = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly team: TeamId,
  ) {
    const { width, height } = world.map;
    const key = `fog-${Date.now()}`;
    this.tex = scene.textures.createCanvas(key, width, height)!;
    const k = (TILE_W / 2) * Math.SQRT2;
    const img = scene.add.image(0, 0, key).setOrigin(0, 0).setScale(k);
    const inner = scene.add.container(0, 0, [img]).setRotation(Math.PI / 4);
    this.outer = scene.add.container(0, 0, [inner]).setScale(1, 0.5).setDepth(30000);
  }

  update(): void {
    if (this.world.fog.version === this.lastVersion) return;
    this.lastVersion = this.world.fog.version;
    const vis = this.world.fog.visibleGrid(this.team);
    const exp = this.world.fog.exploredGrid(this.team);
    if (!vis || !exp) return;
    const ctx = this.tex.getContext();
    const { width, height } = this.world.map;
    const data = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const a = vis[i] ? 0 : exp[i] ? 120 : 245;
      data.data[i * 4] = 6;
      data.data[i * 4 + 1] = 9;
      data.data[i * 4 + 2] = 12;
      data.data[i * 4 + 3] = a;
    }
    ctx.putImageData(data, 0, 0);
    this.tex.refresh();
  }

  destroy(): void {
    this.outer.destroy(true);
    this.tex.destroy();
  }
}
