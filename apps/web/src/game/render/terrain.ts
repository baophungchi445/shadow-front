import type Phaser from 'phaser';
import type { TileKind } from '@shadow-front/shared-types';
import { mapScreenBounds, worldToScreen, type World } from '@shadow-front/game-core';
import { drawPrism, footprint, mix, shade } from './draw';

export const TILE_COLORS: Record<TileKind, number> = {
  sand: 0xc4a46a,
  grass: 0x6c8744,
  road: 0x5c5a55,
  concrete: 0x8a8b86,
  rock: 0x8b7658,
  water: 0x2e6a86,
  urban: 0x4c4f53,
  ore: 0xa98b52,
};

/** Deterministic per-tile hash in [0, 1). */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

const URBAN_HEIGHTS = [16, 28, 40, 56, 72];
const URBAN_PALETTE = [0x6e747b, 0x8a7f72, 0x5f7486, 0x7d8378];

function generateObjectTextures(scene: Phaser.Scene): void {
  // City block towers with window strips.
  URBAN_HEIGHTS.forEach((hgt, hi) =>
    URBAN_PALETTE.forEach((col, ci) => {
      makeTexture(scene, `urban-${hi}-${ci}`, 64, 32 + hgt + 2, (g) => {
        g.translateCanvas(32, 16 + hgt);
        drawPrism(g, 0.96, 0.96, hgt, col);
        const base = footprint(0.96, 0.96);
        const [, r, b, l] = base;
        g.lineStyle(1, 0xc9dbe6, 0.35);
        for (let z = 7; z < hgt - 3; z += 6) {
          g.lineBetween(l.x + 3, l.y - z + 1.5, b.x - 2, b.y - z);
          g.lineBetween(b.x + 2, b.y - z, r.x - 3, r.y - z + 1.5);
        }
        const top = footprint(0.7, 0.7, hgt + 1);
        g.fillStyle(shade(col, 0.82));
        g.fillPoints(top, true);
      });
    }),
  );
  // Desert boulders.
  for (let i = 0; i < 3; i++) {
    makeTexture(scene, `rock-${i}`, 64, 54, (g) => {
      g.translateCanvas(32, 34);
      const c = mix(0x8b7658, 0x6d655c, i * 0.3);
      drawPrism(g, 0.95, 0.9, 7 + i * 3, shade(c, 0.9));
      drawPrism(g, 0.6, 0.7, 6 + i * 2, c, 7 + i * 3);
      drawPrism(g, 0.3, 0.35, 4, shade(c, 1.15), 13 + i * 5);
    });
  }
  // Park trees.
  for (let i = 0; i < 2; i++) {
    makeTexture(scene, `tree-${i}`, 64, 64, (g) => {
      g.translateCanvas(32, 44);
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(4, 2, 34, 15);
      g.fillStyle(0x4a3524);
      g.fillRect(-2, -16, 4, 16);
      const leaf = i ? 0x3f6b33 : 0x4d7a36;
      g.fillStyle(shade(leaf, 0.8));
      g.fillCircle(0, -24, 13);
      g.fillStyle(leaf);
      g.fillCircle(-4, -29, 9);
      g.fillStyle(shade(leaf, 1.2));
      g.fillCircle(3, -32, 6);
    });
  }
  // Ore crystal clusters.
  for (let i = 0; i < 3; i++) {
    makeTexture(scene, `ore-${i}`, 48, 40, (g) => {
      g.translateCanvas(24, 30);
      const crystals = [
        [-9, 2, 5, 11],
        [6, 3, 4, 9],
        [-1, -1, 6, 16],
        [11, -2, 3, 7],
        [-14, -3, 3, 6],
      ];
      crystals.forEach(([x, y, w, h], k) => {
        if ((k + i) % 4 === 3) return;
        const col = k % 2 ? 0xf0c040 : 0xd89a2a;
        g.fillStyle(shade(col, 0.7));
        g.fillTriangle(x - w, y, x, y - h, x, y + 2);
        g.fillStyle(col);
        g.fillTriangle(x, y + 2, x, y - h, x + w, y);
        g.fillStyle(0xfff2b0, 0.8);
        g.fillTriangle(x - 1, y - h * 0.6, x, y - h, x + 1, y - h * 0.6);
      });
    });
  }
}

export interface TerrainLayer {
  rt: Phaser.GameObjects.RenderTexture;
  oreSprites: { idx: number; img: Phaser.GameObjects.Image; full: number }[];
  /** Burns a scorch mark into the ground texture. */
  scorch(x: number, y: number, size: number): void;
  updateOre(world: World): void;
}

/** Bakes the static ground into a single render texture and spawns depth-sorted terrain objects. */
export function buildTerrain(scene: Phaser.Scene, world: World): TerrainLayer {
  generateObjectTextures(scene);
  const map = world.map;
  const bounds = mapScreenBounds(map.width, map.height);
  const rt = scene.add
    .renderTexture(bounds.x, bounds.y, bounds.w, bounds.h + 4)
    .setOrigin(0, 0)
    .setDepth(-10000);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const offX = -bounds.x;
  const offY = -bounds.y;
  const urbanMap = map.id === 'urban-conflict';

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const kind = map.tiles[ty * map.width + tx];
      const v = 0.94 + hash2(tx, ty) * 0.12;
      const p = worldToScreen(tx + 0.5, ty + 0.5);
      const cx = p.x + offX;
      const cy = p.y + offY;
      const d = [
        { x: cx, y: cy - 16 },
        { x: cx + 32, y: cy },
        { x: cx, y: cy + 16 },
        { x: cx - 32, y: cy },
      ];
      let col = TILE_COLORS[kind];
      if (kind === 'rock' && urbanMap) col = TILE_COLORS.grass;
      g.fillStyle(shade(col, v));
      g.fillPoints(d, true);
      // Surface detail.
      if (kind === 'sand' || kind === 'ore') {
        g.fillStyle(shade(col, 0.88), 0.6);
        for (let k = 0; k < 3; k++) {
          const a = hash2(tx * 7 + k, ty * 13);
          const b = hash2(tx * 3, ty * 5 + k);
          g.fillEllipse(cx + (a - 0.5) * 34, cy + (b - 0.5) * 14, 6, 2);
        }
      } else if (kind === 'grass') {
        g.fillStyle(shade(col, 1.15), 0.5);
        for (let k = 0; k < 4; k++) {
          const a = hash2(tx * 11 + k, ty * 3);
          const b = hash2(tx, ty * 17 + k);
          g.fillRect(cx + (a - 0.5) * 34, cy + (b - 0.5) * 14, 2, 2);
        }
      } else if (kind === 'water') {
        g.lineStyle(1, 0x8fc7de, 0.25);
        const a = hash2(tx, ty);
        g.lineBetween(cx - 10 + a * 6, cy - 2, cx + 6 + a * 6, cy - 2);
      } else if (kind === 'road') {
        g.lineStyle(1, 0x3f3e3a, 0.6);
        g.strokePoints(d, true);
      } else if (kind === 'concrete') {
        g.lineStyle(1, 0x6f706c, 0.5);
        g.strokePoints(d, true);
      }
    }
  }
  // Subtle water/shore darkening.
  rt.draw(g, 0, 0);
  g.destroy();

  // Depth-sorted terrain objects.
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const kind = map.tiles[ty * map.width + tx];
      const p = worldToScreen(tx + 0.5, ty + 0.5);
      const hv = hash2(tx + 101, ty + 37);
      if (kind === 'urban') {
        const hi = Math.min(URBAN_HEIGHTS.length - 1, Math.floor(hv * URBAN_HEIGHTS.length));
        const ci = Math.floor(hash2(tx >> 1, ty >> 1) * URBAN_PALETTE.length);
        const hgt = URBAN_HEIGHTS[hi];
        scene.add
          .image(p.x, p.y, `urban-${hi}-${ci}`)
          .setOrigin(0.5, (16 + hgt) / (32 + hgt + 2))
          .setDepth(p.y);
      } else if (kind === 'rock') {
        if (urbanMap)
          scene.add
            .image(p.x, p.y, `tree-${Math.floor(hv * 2)}`)
            .setOrigin(0.5, 44 / 64)
            .setDepth(p.y);
        else
          scene.add
            .image(p.x, p.y, `rock-${Math.floor(hv * 3)}`)
            .setOrigin(0.5, 34 / 54)
            .setDepth(p.y);
      }
    }
  }

  const oreSprites: TerrainLayer['oreSprites'] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== 'ore') continue;
    const tx = i % map.width;
    const ty = Math.floor(i / map.width);
    const p = worldToScreen(tx + 0.5, ty + 0.5);
    const img = scene.add
      .image(p.x, p.y, `ore-${Math.floor(hash2(tx, ty + 9) * 3)}`)
      .setOrigin(0.5, 30 / 40)
      .setDepth(p.y - 2);
    oreSprites.push({ idx: i, img, full: map.oreAmount });
  }

  return {
    rt,
    oreSprites,
    scorch(x, y, size) {
      const s = worldToScreen(x, y);
      const sg = scene.make.graphics({ x: 0, y: 0 }, false);
      sg.fillStyle(0x1c1712, 0.35);
      sg.fillEllipse(s.x + offX, s.y + offY, size * 2.2, size * 1.1);
      sg.fillStyle(0x0d0b09, 0.3);
      sg.fillEllipse(s.x + offX, s.y + offY, size * 1.2, size * 0.6);
      rt.draw(sg, 0, 0);
      sg.destroy();
    },
    updateOre(w) {
      for (const o of oreSprites) {
        const f = w.oreRemaining[o.idx] / o.full;
        o.img.setVisible(f > 0.01);
        o.img.setScale(0.45 + 0.55 * f);
      }
    },
  };
}
