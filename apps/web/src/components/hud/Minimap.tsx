import { useEffect, useRef } from 'react';
import type { GameController } from '../../game/GameController';
import { TILE_COLORS } from '../../game/render/terrain';
import { hex } from '../Icon';

const W = 232;
const H = 116;

/**
 * Isometric minimap drawn on a 2D canvas with the same affine transform as the battlefield.
 * Shows terrain, fog, visible units/buildings and the camera footprint. Click to move the camera.
 */
export function Minimap({ controller, size = W }: { controller: GameController; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = size;
  const height = (size * H) / W;

  useEffect(() => {
    const world = controller.world;
    const { width: mw, height: mh, tiles } = world.map;
    // Pre-render terrain at 1 px per tile.
    const base = document.createElement('canvas');
    base.width = mw;
    base.height = mh;
    const bctx = base.getContext('2d')!;
    const img = bctx.createImageData(mw, mh);
    const paintTerrain = () => {
      tiles.forEach((t, i) => {
        const c = TILE_COLORS[t];
        img.data[i * 4] = (c >> 16) & 255;
        img.data[i * 4 + 1] = (c >> 8) & 255;
        img.data[i * 4 + 2] = c & 255;
        img.data[i * 4 + 3] = 255;
      });
      bctx.putImageData(img, 0, 0);
    };
    paintTerrain();
    // Destructible terrain: repaint when tiles change.
    let terrainVersion = world.terrainVersion;
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = mw;
    fogCanvas.height = mh;
    const fctx = fogCanvas.getContext('2d')!;

    const ctx = canvas.current!.getContext('2d')!;
    const scale = width / (mw * Math.SQRT2);
    const k = scale; // px per tile along the rotated axes
    const setIso = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(width / 2, 0);
      ctx.scale(1, 0.5);
      ctx.rotate(Math.PI / 4);
      ctx.scale(k, k);
    };

    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 100) return;
      last = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      setIso();
      if (world.terrainVersion !== terrainVersion) {
        terrainVersion = world.terrainVersion;
        paintTerrain();
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0);
      const team = controller.team;
      for (const e of world.entities.values()) {
        if (e.dead) continue;
        if (!world.isVisibleTo(team, e)) continue;
        ctx.fillStyle = hex(world.players[e.owner].color);
        if (e.kind === 'building') ctx.fillRect(e.tx, e.ty, e.w, e.h);
        else ctx.fillRect(e.x - 0.7, e.y - 0.7, 1.4, 1.4);
      }
      const vis = world.fog.visibleGrid(team);
      const exp = world.fog.exploredGrid(team);
      if (vis && exp) {
        const fimg = fctx.createImageData(mw, mh);
        for (let i = 0; i < mw * mh; i++) {
          fimg.data[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 110 : 235;
        }
        fctx.putImageData(fimg, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(fogCanvas, 0, 0);
      }
      // Attack alert pings (expanding red rings, fade after 6 s).
      const now = performance.now();
      for (const a of controller.alerts) {
        const age = (now - a.time) / 1000;
        if (age > 6) continue;
        const phase = (age % 1.2) / 1.2;
        ctx.strokeStyle = `rgba(255,70,70,${(1 - age / 6) * (1 - phase)})`;
        ctx.lineWidth = 1.6 / k;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.5 + phase * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Strategic points (public map knowledge): owner colour or neutral grey.
      for (const pt of world.points) {
        ctx.fillStyle = pt.player !== null ? hex(world.players[pt.player].color) : '#c8ccd0';
        ctx.strokeStyle = '#0b0e11';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.rect(pt.x - 1.4, pt.y - 1.4, 2.8, 2.8);
        ctx.fill();
        ctx.stroke();
      }
      // Capture the Flag: flag positions (public).
      for (const f of world.flags) {
        const col = world.players.find((pl) => pl.team === f.team)?.color ?? 0xffffff;
        ctx.fillStyle = hex(col);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 2.5);
        ctx.lineTo(f.x + 2.5, f.y);
        ctx.lineTo(f.x, f.y + 2.5);
        ctx.lineTo(f.x - 2.5, f.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Camera footprint.
      const v = controller.cameraView;
      if (v.length === 4) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1.2 / k;
        ctx.beginPath();
        v.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [controller, width, height]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Left button only: right-click is handled by onContextMenu (move order).
    if (e.type === 'pointerdown' ? e.button !== 0 : e.buttons !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * width - width / 2;
    const sy = (((e.clientY - rect.top) / rect.height) * height) / 0.5;
    // Inverse of rotate(45°) · scale(k).
    const k = width / (controller.world.map.width * Math.SQRT2);
    controller.centerOn((sx + sy) / Math.SQRT2 / k, (sy - sx) / Math.SQRT2 / k);
  };

  return (
    <canvas
      ref={canvas}
      width={width}
      height={height}
      className="block cursor-pointer"
      style={{ width, height }}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onContextMenu={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const sx = ((e.clientX - rect.left) / rect.width) * width - width / 2;
        const sy = (((e.clientY - rect.top) / rect.height) * height) / 0.5;
        const k = width / (controller.world.map.width * Math.SQRT2);
        controller.moveSelected((sx + sy) / Math.SQRT2 / k, (sy - sx) / Math.SQRT2 / k);
      }}
    />
  );
}
