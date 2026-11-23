import type Phaser from 'phaser';
import type { BuildingTypeId, UnitTypeId } from '@shadow-front/shared-types';
import { BUILDINGS } from '@shadow-front/game-data';
import { drawBox, drawCylinder, drawPrism, footprint, iso, lerpPt, mix, shade, type Pt } from './draw';

/** Neutral military base tones mixed with the team colour so ownership stays readable. */
const CONCRETE = 0x8d8f8a;
const STEEL = 0x6b7076;
const OLIVE = 0x59613f;

export function teamTint(color: number, t = 0.55): number {
  return mix(OLIVE, color, t);
}

/** Altitude (px) at which air units fly. */
export const AIR_ALTITUDE: Partial<Record<UnitTypeId, number>> = {
  'attack-helicopter': 30,
  'recon-drone': 38,
  'fighter-jet': 46,
  bomber: 42,
};

/** Flat polygon given in unit-local tiles (x forward), rotated by `f` and lifted `z` pixels. */
function plate(
  g: Phaser.GameObjects.Graphics,
  pts: [number, number][],
  f: number,
  z: number,
  color: number,
  alpha = 1,
): void {
  const c = Math.cos(f);
  const s = Math.sin(f);
  g.fillStyle(color, alpha);
  g.fillPoints(
    pts.map(([a, b]) => {
      const p = iso(a * c - b * s, a * s + b * c);
      return { x: p.x, y: p.y - z };
    }),
    true,
  );
}

// ------------------------------------------------------------------ buildings

/**
 * Draws a building centred on the graphics origin (footprint centre, ground level).
 * `progress` < 1 renders a construction site.
 */
export function drawBuilding(
  g: Phaser.GameObjects.Graphics,
  type: BuildingTypeId,
  color: number,
  progress: number,
  /** Animation phase 0..1 (radar, steam, pump). */
  phase: number,
  /** Front side (see `Building.facing`): 0 = +y, 1 = +x, 2 = -y, 3 = -x. Front details face that way (v0.13). */
  facing = 0,
): void {
  const def = BUILDINGS[type];
  // The camera sees the +x and +y faces: facings 0 / 1 show the front, 2 / 3 show the back on that face.
  const face: Face = facing % 2 === 0 ? 'y' : 'x';
  const back = facing >= 2;
  const { w, h } = def;
  const team = color;
  const body = mix(CONCRETE, color, 0.18);

  // Foundation slab.
  drawPrism(g, w, h, 3, shade(CONCRETE, 0.8));

  if (progress < 1) {
    const height = Math.max(4, def.height * progress);
    drawPrism(g, w - 0.3, h - 0.3, height, shade(body, 0.75), 3);
    // Scaffolding.
    const top = footprint(w - 0.1, h - 0.1, 3 + def.height);
    const base = footprint(w - 0.1, h - 0.1, 3);
    g.lineStyle(1, 0xd9b44a, 0.85);
    for (let i = 1; i < 4; i++) {
      g.lineBetween(base[i].x, base[i].y, top[i].x, top[i].y);
    }
    g.lineBetween(top[3].x, top[3].y, top[2].x, top[2].y);
    g.lineBetween(top[2].x, top[2].y, top[1].x, top[1].y);
    // Crane arm.
    g.lineStyle(2, 0xe2b23a, 1);
    const c = iso(w / 2 - 0.3, -h / 2 + 0.3);
    g.lineBetween(c.x, c.y - 3, c.x, c.y - def.height - 22);
    g.lineBetween(c.x - 26, c.y - def.height - 20, c.x + 10, c.y - def.height - 20);
    return;
  }

  switch (type) {
    case 'headquarters': {
      const t1 = drawPrism(g, w - 0.4, h - 0.4, 26, body, 3);
      drawPrism(g, w - 1.4, h - 1.4, 18, shade(body, 1.08), 29);
      stripe(g, t1, team);
      {
        const half = (face === 'x' ? w : h) / 2 - 0.2;
        if (!back) {
          facePanel(g, face, half, 0, 0.36, 3, 17, 0x23272b);
          faceLine(g, face, half, 0, 0.42, 18, team);
          faceLine(g, face, half, 0, 0.36, 10, 0x50565c);
        } else {
          for (const at of [-0.55, 0.55]) {
            facePanel(g, face, half, at, 0.25, 9, 20, 0x2f3438);
            for (let i = 0; i < 4; i++) faceLine(g, face, half, at, 0.25, 11 + i * 2.5, 0x5d646b);
          }
        }
      }
      // Antenna mast and radar dish.
      const top = iso(0, 0);
      g.lineStyle(2, 0x2b2f33, 1);
      g.lineBetween(top.x + 10, top.y - 47, top.x + 10, top.y - 78);
      g.fillStyle(0xcfd4d8);
      g.fillEllipse(top.x - 12, top.y - 52, 18, 9);
      g.fillStyle(team);
      g.fillCircle(top.x + 10, top.y - 79, 2.5);
      // Rotating radar bar.
      const a = phase * Math.PI * 2;
      g.lineStyle(2, 0x1c2024, 1);
      g.lineBetween(
        top.x - 12 - Math.cos(a) * 8,
        top.y - 54 - Math.sin(a) * 3,
        top.x - 12 + Math.cos(a) * 8,
        top.y - 54 + Math.sin(a) * 3,
      );
      break;
    }
    case 'power-plant': {
      const t1 = drawPrism(g, w - 0.3, h - 0.3, 12, body, 3);
      stripe(g, t1, team);
      const c1 = iso(-0.35, -0.35);
      const c2 = iso(0.35, 0.35);
      drawCylinder(g, c1.x, c1.y - 15, 11, 26, 0xb9bbb5, 0.75);
      drawCylinder(g, c2.x, c2.y - 15, 11, 22, 0xb9bbb5, 0.75);
      // Steam.
      g.fillStyle(0xffffff, 0.18);
      const puff = phase;
      g.fillCircle(c1.x + puff * 4, c1.y - 44 - puff * 10, 5 + puff * 4);
      break;
    }
    case 'resource-extractor': {
      const t1 = drawPrism(g, w - 0.4, h - 0.4, 10, shade(STEEL, 1.1), 3);
      stripe(g, t1, team);
      const c = iso(0.25, 0.25);
      drawCylinder(g, c.x, c.y - 13, 9, 14, 0xc29b48, 1);
      // Derrick.
      const d = iso(-0.35, -0.35);
      g.lineStyle(2, 0x3a3d40, 1);
      g.lineBetween(d.x - 8, d.y - 13, d.x, d.y - 46);
      g.lineBetween(d.x + 8, d.y - 13, d.x, d.y - 46);
      g.lineBetween(d.x - 5, d.y - 25, d.x + 5, d.y - 25);
      const pump = Math.sin(phase * Math.PI * 2) * 4;
      g.lineStyle(3, team, 1);
      g.lineBetween(d.x - 12, d.y - 38 + pump, d.x + 12, d.y - 38 - pump);
      break;
    }
    case 'barracks': {
      const t1 = drawPrism(g, w - 0.3, h - 0.5, 16, mix(OLIVE, CONCRETE, 0.5), 3);
      // Pitched roof ridge.
      const ridgeA = lerpPt(t1[0], t1[3], 0.5);
      const ridgeB = lerpPt(t1[1], t1[2], 0.5);
      g.fillStyle(shade(OLIVE, 0.9));
      g.fillPoints([t1[3], t1[2], { x: ridgeB.x, y: ridgeB.y - 7 }, { x: ridgeA.x, y: ridgeA.y - 7 }], true);
      g.fillStyle(shade(OLIVE, 1.15));
      g.fillPoints([t1[0], t1[1], { x: ridgeB.x, y: ridgeB.y - 7 }, { x: ridgeA.x, y: ridgeA.y - 7 }], true);
      {
        const half = face === 'x' ? (w - 0.3) / 2 : (h - 0.5) / 2;
        if (!back) {
          facePanel(g, face, half, 0, 0.17, 3, 13, 0x2a2620);
          faceLine(g, face, half, 0, 0.22, 14, team);
        } else {
          facePanel(g, face, half, -0.35, 0.12, 8, 13, 0x9fb7c2);
          facePanel(g, face, half, 0.35, 0.12, 8, 13, 0x9fb7c2);
        }
      }
      // Flag.
      const f = iso(0.7, -0.7);
      g.lineStyle(1.5, 0x222222, 1);
      g.lineBetween(f.x, f.y - 18, f.x, f.y - 44);
      g.fillStyle(team);
      g.fillRect(f.x, f.y - 44, 11, 7);
      break;
    }
    case 'war-factory': {
      const t1 = drawPrism(g, w - 0.3, h - 0.3, 24, mix(STEEL, CONCRETE, 0.4), 3);
      stripe(g, t1, team);
      const half = (face === 'x' ? w : h) / 2 - 0.15;
      if (!back) {
        // Garage door on the front face.
        facePanel(g, face, half, 0, 0.6, 3, 20, 0x24282c);
        for (let i = 1; i < 4; i++) faceLine(g, face, half, 0, 0.6, 3 + i * 4.5, 0x50565c);
      } else {
        // Back wall: service hatch, vent grille and an exhaust duct.
        facePanel(g, face, half, -0.45, 0.18, 3, 12, 0x3a3f44);
        facePanel(g, face, half, 0.3, 0.32, 12, 19, 0x2b2f33);
        for (let i = 0; i < 3; i++) faceLine(g, face, half, 0.3, 0.32, 13.5 + i * 2, 0x5d646b);
        const d = face === 'x' ? iso(half + 0.08, 0.3) : iso(0.3, half + 0.08);
        g.lineStyle(3, 0x2b2f33, 1);
        g.lineBetween(d.x, d.y - 19, d.x, d.y - 31);
      }
      // Roof vents.
      const v = iso(-0.6, -0.4);
      drawBox(g, -0.6, -0.4, 0.5, 0.5, 0, 6, 27, shade(STEEL, 0.9));
      g.fillStyle(0x1b1e21);
      g.fillCircle(v.x, v.y - 34, 3);
      break;
    }
    case 'airfield': {
      drawPrism(g, w - 0.2, h - 0.2, 4, 0x4b4f52, 3);
      const pad = footprint(1.6, 1.6, 7);
      g.lineStyle(2, 0xe8e8e8, 0.9);
      g.strokePoints(pad, true);
      const c = iso(0, 0);
      g.lineStyle(2.5, 0xf2f2f2, 1);
      g.lineBetween(c.x - 9, c.y - 11, c.x - 3, c.y - 2);
      g.lineBetween(c.x + 3, c.y - 12, c.x + 9, c.y - 3);
      g.lineBetween(c.x - 6, c.y - 6, c.x + 6, c.y - 7);
      // Taxi line painted towards the front (where aircraft roll out).
      {
        const [dx, dy] = FACING_DIR[facing] ?? FACING_DIR[0];
        g.lineStyle(2, 0xf0d060, 0.9);
        for (let k = 0; k < 3; k++) {
          const t0 = 0.9 + k * 0.22;
          const a = iso(dx * t0, dy * t0);
          const b = iso(dx * (t0 + 0.12), dy * (t0 + 0.12));
          g.lineBetween(a.x, a.y - 7, b.x, b.y - 7);
        }
      }
      // Control tower.
      drawBox(g, -1.05, -1.05, 0.55, 0.55, 0, 30, 7, mix(CONCRETE, team, 0.25));
      drawBox(g, -1.05, -1.05, 0.75, 0.75, 0, 8, 37, 0x9fc6d6);
      break;
    }
    case 'naval-yard': {
      // v0.13: concrete quay, slipway pointing out of the front, boat shed at the back and a gantry crane.
      const [dx, dy] = FACING_DIR[facing] ?? FACING_DIR[0];
      const sx = -dy;
      const sy = dx;
      const q = (a: number, b: number, z: number) => {
        const p = iso(dx * a + sx * b, dy * a + sy * b);
        return { x: p.x, y: p.y - z };
      };
      g.fillStyle(0x2e6a86, 1);
      g.fillPoints([q(-0.2, -0.45, 3), q(1.45, -0.45, 3), q(1.45, 0.45, 3), q(-0.2, 0.45, 3)], true);
      g.lineStyle(1, 0xd9dcd2, 0.8);
      for (const b of [-0.45, 0.45]) {
        const a1 = q(-0.2, b, 3);
        const a2 = q(1.45, b, 3);
        g.lineBetween(a1.x, a1.y, a2.x, a2.y);
      }
      // Boat shed on the rear half.
      drawBox(g, -dx * 0.75, -dy * 0.75, 1.2, 2.2, Math.atan2(dy, dx), 14, 3, mix(STEEL, CONCRETE, 0.5));
      drawBox(g, -dx * 0.75, -dy * 0.75, 1.24, 0.5, Math.atan2(dy, dx), 2, 17, team);
      // Gantry crane over the slipway.
      g.lineStyle(2.5, 0xe8b830, 1);
      for (const b of [-0.55, 0.55]) {
        const lo = q(0.6, b, 3);
        g.lineBetween(lo.x, lo.y, lo.x, lo.y - 30);
      }
      const t1 = q(0.6, -0.55, 33);
      const t2 = q(0.6, 0.55, 33);
      g.lineBetween(t1.x, t1.y, t2.x, t2.y);
      break;
    }
    case 'research-center': {
      const t1 = drawPrism(g, w - 0.3, h - 0.3, 18, 0xd2d5d8, 3);
      stripe(g, t1, team);
      const c = iso(0, 0);
      g.fillStyle(0x7fb8d4);
      g.slice(c.x, c.y - 21, 18, Math.PI, 0, false);
      g.fillPath();
      g.fillStyle(0xb8e0f0, 0.7);
      g.fillEllipse(c.x - 5, c.y - 30, 8, 6);
      g.fillStyle(team);
      g.fillEllipse(c.x, c.y - 21, 36, 8);
      g.fillStyle(0x7fb8d4);
      g.fillEllipse(c.x, c.y - 22, 34, 6);
      break;
    }
    case 'defense-turret':
    case 'sam-site':
    case 'missile-launcher': {
      drawPrism(g, 0.95, 0.95, 10, mix(CONCRETE, team, 0.22), 3);
      break;
    }
    case 'bunker': {
      const t1 = drawPrism(g, w - 0.2, h - 0.2, 14, shade(mix(CONCRETE, OLIVE, 0.35), 0.9), 3);
      stripe(g, t1, team);
      // Firing slits along the two front faces.
      g.fillStyle(0x15181b, 1);
      const a = iso(w / 2 - 0.1, -h / 2 + 0.5);
      const b = iso(-w / 2 + 0.5, h / 2 - 0.1);
      g.fillRect(a.x - 10, a.y - 11, 12, 3);
      g.fillRect(b.x - 2, b.y - 11, 12, 3);
      // Sandbags on the roof.
      g.fillStyle(0xb79f6a, 1);
      const c = iso(0, 0);
      g.fillEllipse(c.x - 8, c.y - 18, 10, 5);
      g.fillEllipse(c.x + 6, c.y - 18, 10, 5);
      break;
    }
    case 'field-hospital': {
      const t1 = drawPrism(g, w - 0.3, h - 0.3, 16, 0xe6e8e4, 3);
      stripe(g, t1, team);
      // Red cross on the roof.
      const c = iso(0, 0);
      g.fillStyle(0xd23c3c, 1);
      g.fillRect(c.x - 3, c.y - 27, 6, 14);
      g.fillRect(c.x - 8, c.y - 23, 16, 6);
      break;
    }
    case 'repair-bay': {
      const t1 = drawPrism(g, w - 0.2, h - 0.2, 10, mix(CONCRETE, STEEL, 0.5), 3);
      stripe(g, t1, team);
      // Crane arm + hook.
      const c = iso(0, 0);
      g.lineStyle(3, 0xe8b830, 1);
      g.lineBetween(c.x - 12, c.y - 13, c.x - 12, c.y - 38);
      g.lineBetween(c.x - 12, c.y - 38, c.x + 14, c.y - 32);
      g.lineStyle(1.5, 0x2b2f33, 1);
      g.lineBetween(c.x + 12, c.y - 32, c.x + 12, c.y - 22);
      break;
    }
    case 'oil-derrick': {
      drawPrism(g, w - 0.6, h - 0.6, 6, shade(CONCRETE, 0.85), 3);
      // Lattice tower and a nodding pump (animated through `phase`).
      const c = iso(0, 0);
      g.lineStyle(2, 0x3a3f45, 1);
      g.lineBetween(c.x - 9, c.y - 9, c.x, c.y - 44);
      g.lineBetween(c.x + 9, c.y - 9, c.x, c.y - 44);
      g.lineBetween(c.x - 6, c.y - 22, c.x + 6, c.y - 22);
      const nod = Math.sin(phase * Math.PI * 2) * 5;
      g.lineStyle(3, team, 1);
      g.lineBetween(c.x - 16, c.y - 14 + nod, c.x + 16, c.y - 14 - nod);
      g.fillStyle(0x1b1c1c);
      g.fillCircle(c.x + 16, c.y - 14 - nod, 3);
      break;
    }
    case 'howitzer':
    case 'bastion': {
      const tall = type === 'bastion' ? 18 : 9;
      const t1 = drawPrism(g, w - 0.2, h - 0.2, tall, shade(mix(CONCRETE, team, 0.2), type === 'bastion' ? 0.8 : 0.95), 3);
      stripe(g, t1, team);
      break;
    }
    case 'wall': {
      const t1 = drawPrism(g, 1, 1, 12, shade(CONCRETE, 0.95), 3);
      g.lineStyle(1, shade(CONCRETE, 0.7), 1);
      g.lineBetween(t1[3].x, t1[3].y, t1[1].x, t1[1].y);
      break;
    }
    case 'radar-station': {
      const t1 = drawPrism(g, w - 0.5, h - 0.5, 14, body, 3);
      stripe(g, t1, team);
      // Mast + rotating dish (animated through `phase`).
      const c = iso(0, 0);
      g.lineStyle(3, 0x2b2f33, 1);
      g.lineBetween(c.x, c.y - 17, c.x, c.y - 40);
      const a = phase * Math.PI * 2;
      const dx = Math.cos(a) * 14;
      g.fillStyle(0xcfd4d8);
      g.fillEllipse(c.x + dx * 0.15, c.y - 44, Math.max(6, Math.abs(dx) * 2), 12);
      g.lineStyle(2, team, 1);
      g.strokeEllipse(c.x + dx * 0.15, c.y - 44, Math.max(6, Math.abs(dx) * 2), 12);
      break;
    }
  }
}

type Face = 'x' | 'y';

/** Unit vectors (tiles) pointing out of each building facing. */
const FACING_DIR: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** Corners along a visible wall face: `half` tiles out from the centre, `at ± span` tiles along it. */
function faceSpan(face: Face, half: number, at: number, span: number): [Pt, Pt] {
  return face === 'x'
    ? [iso(half, at - span), iso(half, at + span)]
    : [iso(at - span, half), iso(at + span, half)];
}

/** Filled rectangle on a visible wall face (+x or +y), from height z0 to z1 px. */
function facePanel(
  g: Phaser.GameObjects.Graphics,
  face: Face,
  half: number,
  at: number,
  span: number,
  z0: number,
  z1: number,
  color: number,
): void {
  const [a, b] = faceSpan(face, half, at, span);
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      { x: a.x, y: a.y - z0 },
      { x: b.x, y: b.y - z0 },
      { x: b.x, y: b.y - z1 },
      { x: a.x, y: a.y - z1 },
    ],
    true,
  );
}

/** Horizontal line on a visible wall face at height z px. */
function faceLine(
  g: Phaser.GameObjects.Graphics,
  face: Face,
  half: number,
  at: number,
  span: number,
  z: number,
  color: number,
): void {
  const [a, b] = faceSpan(face, half, at, span);
  g.lineStyle(1.5, color, 1);
  g.lineBetween(a.x, a.y - z, b.x, b.y - z);
}

/** Team-coloured trim along the two front edges of a roof. */
function stripe(g: Phaser.GameObjects.Graphics, top: Pt[], color: number): void {
  g.lineStyle(2, color, 1);
  g.lineBetween(top[3].x, top[3].y, top[2].x, top[2].y);
  g.lineBetween(top[2].x, top[2].y, top[1].x, top[1].y);
}

/** Rotating weapon part of defensive buildings (redrawn each frame). */
export function drawTurretHead(
  g: Phaser.GameObjects.Graphics,
  type: BuildingTypeId,
  color: number,
  angle: number,
  recoil: number,
): void {
  if (type === 'defense-turret') {
    drawBox(g, 0, 0, 0.5, 0.45, angle, 7, 13, mix(STEEL, color, 0.35));
    const len = 0.62 - recoil * 0.15;
    const a = iso(Math.cos(angle) * 0.2, Math.sin(angle) * 0.2);
    const b = iso(Math.cos(angle) * len, Math.sin(angle) * len);
    g.lineStyle(3, 0x2a2e33, 1);
    g.lineBetween(a.x, a.y - 17, b.x, b.y - 17);
  } else if (type === 'howitzer') {
    // Long barrel raised at an angle.
    drawBox(g, 0, 0, 0.55, 0.5, angle, 8, 10, mix(STEEL, color, 0.3));
    const a = iso(Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
    const b = iso(Math.cos(angle) * (0.95 - recoil * 0.2), Math.sin(angle) * (0.95 - recoil * 0.2));
    g.lineStyle(4, 0x2a2e33, 1);
    g.lineBetween(a.x, a.y - 16, b.x, b.y - 30);
  } else if (type === 'bastion') {
    drawBox(g, 0, 0, 0.7, 0.62, angle, 9, 20, mix(STEEL, color, 0.35));
    const len = 0.95 - recoil * 0.2;
    const a = iso(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25);
    const b = iso(Math.cos(angle) * len, Math.sin(angle) * len);
    g.lineStyle(4.5, 0x2a2e33, 1);
    g.lineBetween(a.x, a.y - 25, b.x, b.y - 25);
  } else if (type === 'bunker') {
    // Mounted machine gun on the roof.
    const a = iso(Math.cos(angle) * 0.05, Math.sin(angle) * 0.05);
    const b = iso(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5);
    g.lineStyle(2.5, 0x25292d, 1);
    g.lineBetween(a.x, a.y - 20, b.x, b.y - 20);
  } else if (type === 'missile-launcher') {
    const top = drawBox(g, 0, 0, 0.56, 0.5, angle, 9, 13, mix(STEEL, color, 0.3));
    g.fillStyle(0x3a3f45);
    for (const pt of top) g.fillCircle(pt.x, pt.y - 1, 2);
    g.fillStyle(0xe98a2b);
    g.fillCircle((top[0].x + top[1].x) / 2, (top[0].y + top[1].y) / 2 - 2, 1.6);
  } else if (type === 'sam-site') {
    const top = drawBox(g, 0, 0, 0.5, 0.42, angle, 8, 13, mix(STEEL, color, 0.3));
    g.fillStyle(0xe8e8e8);
    for (const p of top.slice(0, 2)) g.fillCircle(p.x, p.y - 2, 2.2);
    g.fillStyle(0xd23c3c);
    for (const p of top.slice(0, 2)) g.fillCircle(p.x, p.y - 3, 1);
  }
}

// ------------------------------------------------------------------ units

/**
 * Draws the hull / chassis of a unit (everything that rotates with the unit's facing),
 * centred on the graphics origin (ground point). Infantry is drawn whole, facing `f`.
 */
export function drawUnitBody(
  g: Phaser.GameObjects.Graphics,
  type: UnitTypeId,
  color: number,
  f: number,
): void {
  const hull = teamTint(color);
  const dark = shade(hull, 0.7);
  const shadow = (rx: number) => {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(2, 2, rx * 2, rx);
  };
  switch (type) {
    case 'rifleman':
    case 'at-soldier':
    case 'sniper':
    case 'medic':
    case 'engineer': {
      shadow(6);
      g.fillStyle(0x2d3127);
      g.fillRect(-3, -6, 2.2, 6);
      g.fillRect(0.8, -6, 2.2, 6);
      g.fillStyle(hull);
      g.fillRoundedRect(-4, -15, 8, 10, 2);
      g.fillStyle(0xd8b48a);
      g.fillCircle(0, -17.5, 2.6);
      // Helmet: medics white, engineers yellow, everyone else olive.
      g.fillStyle(type === 'medic' ? 0xeeeeee : type === 'engineer' ? 0xe8b830 : shade(OLIVE, 0.8));
      g.fillEllipse(0, -19, 6.5, 3.5);
      if (type === 'medic') {
        g.fillStyle(0xd23c3c);
        g.fillRect(-1.5, -13, 3, 6);
        g.fillRect(-3, -11.5, 6, 3);
      }
      if (type === 'engineer') {
        g.fillStyle(0x4a4f3a);
        g.fillRoundedRect(-5, -14, 3, 7, 1);
      }
      const d = iso(Math.cos(f), Math.sin(f));
      const n = Math.hypot(d.x, d.y) || 1;
      if (type === 'medic' || type === 'engineer') break; // unarmed
      const len = type === 'sniper' ? 14 : 9;
      g.lineStyle(type === 'at-soldier' ? 3.5 : type === 'sniper' ? 1.5 : 2, 0x1e2124, 1);
      g.lineBetween(0, -11, (d.x / n) * len, -11 + (d.y / n) * len);
      if (type === 'at-soldier') {
        g.fillStyle(0x56603a);
        g.fillCircle((d.x / n) * 9, -11 + (d.y / n) * 9, 2);
      }
      break;
    }
    case 'recon-vehicle':
      shadow(14);
      wheels(g, f, 0.55, 0.36);
      drawBox(g, 0, 0, 0.58, 0.34, f, 6, 2, hull);
      break;
    case 'apc':
      shadow(17);
      wheels(g, f, 0.7, 0.44);
      drawBox(g, 0, 0, 0.72, 0.42, f, 11, 2, hull);
      drawBox(g, 0.22, 0, 0.18, 0.4, f, 2, 13, shade(hull, 1.1));
      break;
    case 'main-battle-tank':
      shadow(19);
      tracks(g, f, 0.84, 0.52);
      drawBox(g, 0, 0, 0.78, 0.44, f, 6, 3, hull);
      break;
    case 'heavy-tank':
      shadow(23);
      tracks(g, f, 0.98, 0.64);
      drawBox(g, 0, 0, 0.92, 0.54, f, 8, 3, shade(hull, 0.92));
      break;
    case 'mobile-artillery':
      shadow(19);
      tracks(g, f, 0.86, 0.5);
      drawBox(g, 0, 0, 0.82, 0.44, f, 6, 3, hull);
      break;
    case 'attack-helicopter': {
      const z = AIR_ALTITUDE['attack-helicopter']!;
      g.fillStyle(0x000000, 0.22);
      g.fillEllipse(3, 3, 26, 11);
      const tail = iso(-Math.cos(f) * 0.75, -Math.sin(f) * 0.75);
      g.lineStyle(3, dark, 1);
      g.lineBetween(0, -z, tail.x, tail.y - z - 2);
      drawBox(g, 0.05, 0, 0.6, 0.26, f, 7, z - 4, hull);
      drawBox(g, 0.32, 0, 0.16, 0.18, f, 4, z - 2, 0x9fc6d6);
      g.fillStyle(0x1d2023);
      g.fillCircle(tail.x, tail.y - z - 3, 2.5);
      break;
    }
    case 'fighter-jet': {
      const z = AIR_ALTITUDE['fighter-jet']!;
      // Ground shadow of the delta wing.
      plate(g, [[0.55, 0], [-0.4, 0.42], [-0.3, 0], [-0.4, -0.42]], f, -2, 0x000000, 0.18);
      plate(g, [[0.15, 0], [-0.38, 0.44], [-0.38, -0.44]], f, z, dark);
      drawBox(g, 0, 0, 0.9, 0.12, f, 4, z - 1, hull);
      plate(g, [[-0.25, 0], [-0.42, 0.16], [-0.42, -0.16]], f, z + 4, shade(hull, 0.85));
      const nose = iso(Math.cos(f) * 0.28, Math.sin(f) * 0.28);
      g.fillStyle(0x9fc6d6);
      g.fillEllipse(nose.x, nose.y - z - 4, 5, 3);
      break;
    }
    case 'bomber': {
      const z = AIR_ALTITUDE.bomber!;
      plate(g, [[0.2, 0.75], [0.05, 0.75], [-0.1, 0], [0.05, -0.75], [0.2, -0.75], [0.3, 0]], f, -2, 0x000000, 0.2);
      plate(g, [[0.25, 0.8], [0.08, 0.8], [-0.05, 0], [0.08, -0.8], [0.25, -0.8], [0.35, 0]], f, z, dark);
      drawBox(g, 0, 0, 1.05, 0.2, f, 6, z - 2, hull);
      plate(g, [[-0.4, 0], [-0.55, 0.3], [-0.55, -0.3]], f, z + 4, shade(hull, 0.85));
      for (const side of [-0.45, 0.45]) {
        const e = iso(Math.cos(f) * 0.18 - Math.sin(f) * side, Math.sin(f) * 0.18 + Math.cos(f) * side);
        g.fillStyle(0x2a2d30);
        g.fillEllipse(e.x, e.y - z, 5, 3);
      }
      break;
    }
    case 'mcv': {
      shadow(22);
      wheels(g, f, 0.95, 0.56);
      drawBox(g, 0, 0, 0.98, 0.54, f, 10, 2, shade(hull, 0.92));
      drawBox(g, -0.12, 0, 0.5, 0.46, f, 8, 12, hull);
      // Command dish and antenna.
      g.fillStyle(0xd9dcd2);
      g.fillEllipse(0, -26, 12, 6);
      g.lineStyle(1.5, 0x1e2124, 1);
      g.lineBetween(4, -22, 4, -36);
      break;
    }
    case 'patrol-boat':
    case 'destroyer': {
      // v0.13 ships: wake, pointed hull, deck and bridge.
      const k = type === 'destroyer' ? 1.45 : 1;
      const hullPts: [number, number][] = [
        [0.55 * k, 0],
        [0.28 * k, 0.22 * k],
        [-0.42 * k, 0.2 * k],
        [-0.48 * k, 0],
        [-0.42 * k, -0.2 * k],
        [0.28 * k, -0.22 * k],
      ];
      plate(g, hullPts.map(([a, b]) => [a - 0.12 * k, b * 1.5] as [number, number]), f, -1, 0xffffff, 0.22);
      plate(g, hullPts, f, 0, shade(hull, 0.6));
      plate(g, hullPts.map(([a, b]) => [a * 0.95, b * 0.92] as [number, number]), f, 4, shade(mix(STEEL, hull, 0.35), 1.05));
      if (type === 'destroyer') {
        drawBox(g, -0.4, 0, 0.36, 0.26, f, 9, 4, shade(mix(STEEL, hull, 0.3), 0.95));
        drawBox(g, -0.45, 0, 0.16, 0.14, f, 7, 13, shade(STEEL, 0.85));
        const m = iso(Math.cos(f) * -0.5, Math.sin(f) * -0.5);
        g.lineStyle(1.5, 0x1e2124, 1);
        g.lineBetween(m.x, m.y - 21, m.x, m.y - 33);
      } else {
        drawBox(g, -0.1, 0, 0.22, 0.2, f, 6, 4, shade(mix(STEEL, hull, 0.3), 0.95));
        const w = iso(Math.cos(f) * -0.04, Math.sin(f) * -0.04);
        g.fillStyle(0x9fc6d6);
        g.fillEllipse(w.x, w.y - 9, 5, 2.5);
      }
      break;
    }
    case 'submarine': {
      // v0.15: long dark hull barely above the water, conning tower (sail) and a periscope wake.
      const cig: [number, number][] = [
        [0.62, 0],
        [0.45, 0.13],
        [-0.45, 0.13],
        [-0.65, 0],
        [-0.45, -0.13],
        [0.45, -0.13],
      ];
      plate(g, cig.map(([a, b]) => [a - 0.1, b * 2.2] as [number, number]), f, -1, 0xffffff, 0.12);
      plate(g, cig, f, 1, shade(mix(0x2b3036, hull, 0.25), 0.9));
      plate(g, cig.map(([a, b]) => [a * 0.9, b * 0.5] as [number, number]), f, 2.5, shade(mix(0x2b3036, hull, 0.4), 1.15));
      drawBox(g, 0.12, 0, 0.2, 0.09, f, 7, 2, shade(mix(0x2b3036, hull, 0.3), 1.05));
      const sp = iso(Math.cos(f) * 0.12, Math.sin(f) * 0.12);
      g.lineStyle(1, 0x1e2124, 1);
      g.lineBetween(sp.x, sp.y - 9, sp.x, sp.y - 13);
      break;
    }
    case 'landing-craft': {
      // v0.14: flat-bottomed box hull, open well deck, bow ramp and a small wheelhouse at the stern.
      const box: [number, number][] = [
        [0.62, 0.32],
        [-0.55, 0.32],
        [-0.62, 0.24],
        [-0.62, -0.24],
        [-0.55, -0.32],
        [0.62, -0.32],
      ];
      plate(g, box.map(([a, b]) => [a - 0.15, b * 1.4] as [number, number]), f, -1, 0xffffff, 0.2);
      plate(g, box, f, 0, shade(hull, 0.6));
      plate(g, box, f, 5, shade(mix(STEEL, hull, 0.35), 1.0));
      plate(g, [[0.5, 0.22], [-0.3, 0.22], [-0.3, -0.22], [0.5, -0.22]], f, 5.5, shade(STEEL, 0.55));
      plate(g, [[0.62, 0.3], [0.5, 0.3], [0.5, -0.3], [0.62, -0.3]], f, 8, shade(hull, 0.85));
      drawBox(g, -0.46, 0, 0.18, 0.4, f, 7, 5, shade(mix(STEEL, hull, 0.3), 0.95));
      break;
    }
    case 'recon-drone': {
      const z = AIR_ALTITUDE['recon-drone']!;
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(3, 3, 18, 8);
      g.lineStyle(2, dark, 1);
      for (const a of [0.785, 2.356, 3.927, 5.498]) {
        const p = iso(Math.cos(a + f) * 0.3, Math.sin(a + f) * 0.3);
        g.lineBetween(0, -z, p.x, p.y - z);
        g.fillStyle(0xdddddd, 0.35);
        g.fillEllipse(p.x, p.y - z - 1, 11, 5);
      }
      drawBox(g, 0, 0, 0.22, 0.16, f, 4, z - 2, hull);
      g.fillStyle(0x6fe0ff);
      g.fillCircle(0, -z - 3, 1.6);
      break;
    }
  }
}

/** True when the unit has a separately rotating top part (turret or rotor). */
const NO_TOP: UnitTypeId[] = [
  'rifleman',
  'at-soldier',
  'sniper',
  'medic',
  'engineer',
  'recon-drone',
  'fighter-jet',
  'bomber',
  'mcv',
  'landing-craft',
  'submarine',
];

export function hasTop(type: UnitTypeId): boolean {
  return !NO_TOP.includes(type);
}

/**
 * Draws the rotating top of a unit: turret + barrel aimed at `t`, or the rotor of a helicopter
 * (where `t` is the blade angle). Same origin as drawUnitBody.
 */
export function drawUnitTop(
  g: Phaser.GameObjects.Graphics,
  type: UnitTypeId,
  color: number,
  t: number,
): void {
  const hull = teamTint(color);
  const dark = shade(hull, 0.7);
  const barrel = (len: number, z: number, width: number, from = 0.08) => {
    const a = iso(Math.cos(t) * from, Math.sin(t) * from);
    const b = iso(Math.cos(t) * len, Math.sin(t) * len);
    g.lineStyle(width, 0x25292d, 1);
    g.lineBetween(a.x, a.y - z, b.x, b.y - z);
  };
  switch (type) {
    case 'recon-vehicle':
      drawBox(g, -0.06, 0, 0.26, 0.26, t, 4, 8, dark);
      barrel(0.3, 13, 2);
      break;
    case 'apc':
      drawBox(g, -0.1, 0, 0.16, 0.16, t, 3, 13, dark);
      barrel(0.3, 15, 2);
      break;
    case 'main-battle-tank':
      drawBox(g, -0.05, 0, 0.36, 0.3, t, 5, 9, shade(hull, 1.08));
      barrel(0.62, 12, 3);
      break;
    case 'heavy-tank': {
      drawBox(g, -0.08, 0, 0.44, 0.38, t, 7, 11, hull);
      const s = iso(-Math.sin(t) * 0.08, Math.cos(t) * 0.08);
      g.translateCanvas(s.x, s.y);
      barrel(0.7, 15, 3);
      g.translateCanvas(-2 * s.x, -2 * s.y);
      barrel(0.7, 15, 3);
      g.translateCanvas(s.x, s.y);
      break;
    }
    case 'mobile-artillery': {
      drawBox(g, -0.15, 0, 0.42, 0.38, t, 9, 9, shade(hull, 1.05));
      const a = iso(Math.cos(t) * 0.05, Math.sin(t) * 0.05);
      const b = iso(Math.cos(t) * 0.82, Math.sin(t) * 0.82);
      g.lineStyle(3, 0x25292d, 1);
      g.lineBetween(a.x, a.y - 15, b.x, b.y - 24);
      break;
    }
    case 'patrol-boat':
      // Machine-gun mount on the deckhouse (turret sprite shares the hull's origin, so it sits amidships).
      drawBox(g, 0, 0, 0.12, 0.12, t, 3, 10, dark);
      barrel(0.32, 12, 2, 0);
      break;
    case 'destroyer':
      // Main gun on top of the superstructure.
      drawBox(g, 0, 0, 0.3, 0.26, t, 5, 13, shade(hull, 1.05));
      barrel(0.62, 16, 3, 0.05);
      break;
    case 'attack-helicopter': {
      const z = AIR_ALTITUDE['attack-helicopter']!;
      g.fillStyle(0xdddddd, 0.12);
      g.fillEllipse(0, -z - 6, 46, 23);
      g.lineStyle(1.5, 0x1d2023, 0.8);
      for (let k = 0; k < 2; k++) {
        const ang = t + (k * Math.PI) / 2;
        const p = iso(Math.cos(ang) * 0.72, Math.sin(ang) * 0.72);
        g.lineBetween(-p.x, -p.y - z - 6, p.x, p.y - z - 6);
      }
      g.lineStyle(1, dark, 1);
      break;
    }
  }
}

function tracks(g: Phaser.GameObjects.Graphics, f: number, l: number, w: number): void {
  const side = w / 2 - 0.07;
  const nx = -Math.sin(f) * side;
  const ny = Math.cos(f) * side;
  drawBox(g, nx, ny, l, 0.14, f, 4, 0, 0x2a2c2a);
  drawBox(g, -nx, -ny, l, 0.14, f, 4, 0, 0x2a2c2a);
}

function wheels(g: Phaser.GameObjects.Graphics, f: number, l: number, w: number): void {
  const side = w / 2 - 0.04;
  for (const along of [-l * 0.32, 0, l * 0.32]) {
    for (const s of [-1, 1]) {
      const x = Math.cos(f) * along - Math.sin(f) * side * s;
      const y = Math.sin(f) * along + Math.cos(f) * side * s;
      const p = iso(x, y);
      g.fillStyle(0x1b1c1c);
      g.fillEllipse(p.x, p.y - 2, 6, 5);
    }
  }
}
