import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingTypeId, UnitTypeId } from '@shadow-front/shared-types';
import { BUILDINGS, UNITS } from '@shadow-front/game-data';

/**
 * Procedural low-poly models for the 3D prototype (v0.19).
 *
 * Axes: +X forward, +Y up, +Z right-hand side; 1 unit = 1 tile. A model is split into parts so one InstancedMesh per
 * part can draw every unit of a type in one call:
 * - pivot: `hull` follows the body, `turret` turns with the weapon, `rotor` / `spin` rotate on their own;
 * - tint:  `paint` is multiplied by the faction camouflage, `team` by the player colour, `fixed` keeps its colours,
 *          `glow` is unlit (windows, beacons, lights — bright at night so bloom picks them up).
 */
export type Pivot = 'hull' | 'turret' | 'rotor' | 'rotor2' | 'spin';
export type Tint = 'paint' | 'team' | 'fixed' | 'glow';

export interface ModelPart {
  pivot: Pivot;
  tint: Tint;
  /** Pivot position relative to the model origin. */
  origin: THREE.Vector3;
  geometry: THREE.BufferGeometry;
}

export interface Model {
  parts: ModelPart[];
  /** Footprint radius (team ring under units). */
  radius: number;
}

type V3 = [number, number, number];

const tmpColor = new THREE.Color();

class ModelBuilder {
  private groups = new Map<string, { pivot: Pivot; tint: Tint; origin: THREE.Vector3; geos: THREE.BufferGeometry[] }>();
  private pivot: Pivot = 'hull';
  private origin = new THREE.Vector3();

  /** Switches the pivot new primitives attach to; coordinates are then relative to (x, y, z). */
  use(pivot: Pivot, x = 0, y = 0, z = 0): this {
    this.pivot = pivot;
    this.origin = new THREE.Vector3(x, y, z);
    return this;
  }

  private add(tint: Tint, color: number, geo: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scale?: V3): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')),
      new THREE.Vector3(...(scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    tmpColor.setHex(color);
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = tmpColor.r;
      c[i * 3 + 1] = tmpColor.g;
      c[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const key = `${this.pivot}|${tint}`;
    let grp = this.groups.get(key);
    if (!grp) {
      grp = { pivot: this.pivot, tint, origin: this.origin.clone(), geos: [] };
      this.groups.set(key, grp);
    }
    grp.geos.push(g);
    return this;
  }

  box(tint: Tint, color: number, size: V3, pos: V3, rot?: V3): this {
    return this.add(tint, color, new THREE.BoxGeometry(...size), pos, rot);
  }

  /** Cylinder along Y (rotate with `rot` to lay it down). */
  cyl(tint: Tint, color: number, rTop: number, rBot: number, h: number, pos: V3, rot?: V3, seg = 8): this {
    return this.add(tint, color, new THREE.CylinderGeometry(rTop, rBot, h, seg), pos, rot);
  }

  /** Cylinder along X (barrels, fuselages). */
  tube(tint: Tint, color: number, r: number, len: number, pos: V3, seg = 6, rTip = r): this {
    return this.add(tint, color, new THREE.CylinderGeometry(rTip, r, len, seg), pos, [0, 0, -Math.PI / 2]);
  }

  sphere(tint: Tint, color: number, r: number, pos: V3, scale?: V3, seg = 8): this {
    return this.add(tint, color, new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), pos, undefined, scale);
  }

  dome(tint: Tint, color: number, r: number, pos: V3, seg = 10): this {
    return this.add(tint, color, new THREE.SphereGeometry(r, seg, 5, 0, Math.PI * 2, 0, Math.PI / 2), pos);
  }

  /** Triangular prism pointing +X (bows, roofs); `len` along X, `h` along Y, `w` along Z. */
  wedge(tint: Tint, color: number, len: number, h: number, w: number, pos: V3, rot?: V3): this {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
    g.rotateY(Math.PI / 2);
    g.scale(len / 0.75, h, w / 0.866);
    return this.add(tint, color, g, pos, rot);
  }

  /** Gabled roof along X: base at `pos.y`, ridge `h` above it, `w` across Z. */
  roof(tint: Tint, color: number, len: number, h: number, w: number, pos: V3): this {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.25, 0); // base at y = 0
    g.scale(len, h / 0.75, w / 0.866);
    return this.add(tint, color, g, pos);
  }

  build(radius: number): Model {
    const parts: ModelPart[] = [];
    for (const g of this.groups.values()) {
      const geometry = mergeGeometries(g.geos, false)!;
      g.geos.forEach((x) => x.dispose());
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      parts.push({ pivot: g.pivot, tint: g.tint, origin: g.origin, geometry });
    }
    return { parts, radius };
  }
}

// --------------------------------------------------------------------------------------------- palette
const DARK = 0x2b2c27; // tracks, tyres
const GUN = 0x34372f;
const METAL = 0x6c7076;
const GLASS = 0x26333b;
const SKIN = 0xc79a76;
const CONCRETE = 0x9a9a92;
const ASPHALT = 0x3e3f3c;
const WHITE = 0xe9ebe6;
const WARM = 0xffc777;
const RED = 0xff3b30;
/** Paint tint shades (multiplied by the camouflage colour). */
const P = 0xffffff;
const P2 = 0xc9c9c9;
const P3 = 0x9a9a9a;

// --------------------------------------------------------------------------------------------- units
function infantry(type: UnitTypeId): Model {
  const m = new ModelBuilder();
  const s = 1.15;
  m.box('paint', P3, [0.08 * s, 0.16 * s, 0.13 * s], [0, 0.08 * s, 0]); // legs
  m.box('paint', P, [0.11 * s, 0.17 * s, 0.17 * s], [0, 0.245 * s, 0]); // torso
  m.box('fixed', 0x3b3a2c, [0.06 * s, 0.1 * s, 0.13 * s], [-0.075 * s, 0.25 * s, 0]); // pack
  m.sphere('fixed', SKIN, 0.045 * s, [0.01 * s, 0.37 * s, 0], undefined, 6);
  const helmet =
    type === 'medic' ? WHITE : type === 'engineer' ? 0xe3b437 : type === 'ranger' ? 0x2f3a2a : -1;
  if (helmet >= 0) m.dome('fixed', helmet, 0.055 * s, [0.005 * s, 0.38 * s, 0], 6);
  else m.dome('paint', P2, 0.055 * s, [0.005 * s, 0.38 * s, 0], 6);
  m.box('team', P, [0.112 * s, 0.03 * s, 0.172 * s], [0, 0.3 * s, 0]); // armband / chest stripe
  if (type === 'at-soldier') {
    m.tube('fixed', 0x4a5236, 0.03 * s, 0.34 * s, [0.02 * s, 0.34 * s, 0.08 * s]);
  } else if (type === 'sniper') {
    m.tube('fixed', GUN, 0.012 * s, 0.36 * s, [0.12 * s, 0.25 * s, 0.07 * s]);
  } else if (type === 'medic') {
    m.box('fixed', RED, [0.07 * s, 0.07 * s, 0.02 * s], [-0.075 * s, 0.27 * s, 0.07 * s]);
  } else if (type === 'engineer') {
    m.box('fixed', 0x6d5a35, [0.08 * s, 0.13 * s, 0.14 * s], [-0.09 * s, 0.25 * s, 0]);
  } else {
    m.tube('fixed', GUN, 0.014 * s, 0.24 * s, [0.1 * s, 0.24 * s, 0.07 * s]);
  }
  return m.build(0.2);
}

function tracks(m: ModelBuilder, len: number, w: number, h: number): void {
  for (const z of [-1, 1]) {
    m.box('fixed', DARK, [len, h, w * 0.26], [0, h / 2, z * w * 0.37]);
    for (let i = 0; i < 4; i++)
      m.cyl('fixed', 0x3d3f38, h * 0.36, h * 0.36, w * 0.27, [(-0.375 + i * 0.25) * len, h * 0.42, z * w * 0.37], [Math.PI / 2, 0, 0]);
  }
}

function wheels(m: ModelBuilder, xs: number[], w: number, r: number): void {
  for (const x of xs)
    for (const z of [-1, 1]) m.cyl('fixed', DARK, r, r, 0.07, [x, r, z * w * 0.5], [Math.PI / 2, 0, 0], 8);
}

function tank(scale: number, heavy: boolean): Model {
  const m = new ModelBuilder();
  const L = 0.95 * scale;
  const W = 0.56 * scale;
  tracks(m, L, W, 0.17 * scale);
  m.box('paint', P2, [L * 0.92, 0.12 * scale, W * 0.62], [0, 0.19 * scale, 0]);
  m.box('paint', P, [L * 0.8, 0.07 * scale, W * 0.98], [-0.02 * L, 0.21 * scale, 0]); // fenders
  m.box('paint', P2, [L * 0.18, 0.08 * scale, W * 0.7], [L * 0.43, 0.17 * scale, 0], [0, 0, 0.5]); // glacis
  m.box('fixed', 0x4a4a40, [0.1 * scale, 0.05 * scale, W * 0.5], [-0.44 * L, 0.27 * scale, 0]); // engine deck
  const ty = 0.3 * scale;
  m.use('turret', -0.06 * L, ty, 0);
  m.box('paint', P, [0.42 * scale, 0.13 * scale, 0.36 * scale], [0, 0.05 * scale, 0]);
  m.box('team', P, [0.425 * scale, 0.025 * scale, 0.365 * scale], [0, 0.085 * scale, 0]); // turret band
  m.box('paint', P2, [0.14 * scale, 0.1 * scale, 0.3 * scale], [0.24 * scale, 0.035 * scale, 0], [0, 0, 0.35]);
  m.box('paint', P3, [0.12 * scale, 0.1 * scale, 0.32 * scale], [-0.25 * scale, 0.05 * scale, 0]); // bustle
  m.cyl('paint', P2, 0.05 * scale, 0.05 * scale, 0.05 * scale, [-0.04 * scale, 0.14 * scale, 0.08 * scale]); // hatch
  m.tube('fixed', GUN, 0.03 * scale, 0.6 * scale, [0.5 * scale, 0.05 * scale, heavy ? -0.05 * scale : 0], 6, 0.024 * scale);
  if (heavy) m.tube('fixed', GUN, 0.03 * scale, 0.6 * scale, [0.5 * scale, 0.05 * scale, 0.05 * scale], 6, 0.024 * scale);
  m.cyl('fixed', GUN, 0.004, 0.004, 0.3 * scale, [-0.2 * scale, 0.27 * scale, -0.12 * scale]); // antenna
  m.box('team', P, [0.06 * scale, 0.06 * scale, 0.005], [-0.2 * scale, 0.4 * scale, -0.09 * scale]); // pennant
  m.box('glow', WARM, [0.02, 0.03, 0.05 * scale], [L * 0.52 + 0.06 * L, -0.09 * scale, W * 0.33]);
  m.box('glow', WARM, [0.02, 0.03, 0.05 * scale], [L * 0.52 + 0.06 * L, -0.09 * scale, -W * 0.33]);
  return m.build(0.42 * scale);
}

function apcLike(tracked: boolean, gun: 'small' | 'cannon'): Model {
  const m = new ModelBuilder();
  const L = 0.95;
  const W = 0.5;
  if (tracked) tracks(m, L, W, 0.15);
  else wheels(m, [-0.32, 0, 0.32], W, 0.1);
  m.box('paint', P, [L * 0.9, 0.2, W * 0.86], [-0.03, 0.27, 0]);
  m.box('paint', P2, [0.2, 0.17, W * 0.82], [0.4, 0.23, 0], [0, 0, 0.7]);
  m.box('team', P, [L * 0.6, 0.03, W * 0.88], [-0.1, 0.33, 0]);
  m.box('fixed', GLASS, [0.02, 0.05, W * 0.5], [0.46, 0.32, 0]);
  m.box('glow', WARM, [0.02, 0.03, 0.04], [0.5, 0.22, 0.17]);
  m.box('glow', WARM, [0.02, 0.03, 0.04], [0.5, 0.22, -0.17]);
  m.use('turret', 0.05, 0.37, 0);
  m.cyl('paint', P2, 0.1, 0.12, 0.08, [0, 0.04, 0], undefined, 8);
  if (gun === 'cannon') m.tube('fixed', GUN, 0.022, 0.42, [0.26, 0.05, 0]);
  else m.tube('fixed', GUN, 0.013, 0.26, [0.18, 0.05, 0]);
  return m.build(0.4);
}

function truck(top: (m: ModelBuilder) => void, long = 1): Model {
  const m = new ModelBuilder();
  wheels(m, [-0.34 * long, -0.12 * long, 0.32 * long], 0.42, 0.085);
  m.box('fixed', 0x3a3a36, [0.9 * long, 0.06, 0.36], [0, 0.13, 0]); // chassis
  m.box('paint', P, [0.22, 0.2, 0.4], [0.33 * long, 0.27, 0]); // cab
  m.box('fixed', GLASS, [0.02, 0.09, 0.34], [0.33 * long + 0.11, 0.31, 0]);
  m.box('team', P, [0.225, 0.03, 0.405], [0.33 * long, 0.29, 0]); // door stripe
  m.box('glow', WARM, [0.02, 0.03, 0.04], [0.33 * long + 0.115, 0.2, 0.15]);
  m.box('glow', WARM, [0.02, 0.03, 0.04], [0.33 * long + 0.115, 0.2, -0.15]);
  top(m);
  return m.build(0.42 * long);
}

function heli(kind: 'attack' | 'gunship' | 'transport'): Model {
  const m = new ModelBuilder();
  const s = kind === 'gunship' ? 1.2 : kind === 'transport' ? 1.3 : 1;
  m.sphere('paint', P, 0.16 * s, [0.05 * s, 0, 0], [kind === 'transport' ? 2.6 : 1.9, 0.9, 0.85], 10);
  m.tube('paint', P2, 0.055 * s, 0.6 * s, [-0.42 * s, 0.03 * s, 0], 6, 0.03 * s);
  m.box('paint', P2, [0.12 * s, 0.16 * s, 0.015], [-0.72 * s, 0.1 * s, 0], [0, 0, 0.4]); // fin
  m.box('team', P, [0.2 * s, 0.015, 0.2 * s], [-0.62 * s, 0.05 * s, 0]);
  m.box('fixed', GLASS, [0.12 * s, 0.07 * s, 0.14 * s], [0.27 * s, 0.07 * s, 0], [0, 0, -0.4]);
  m.box('glow', RED, [0.02, 0.02, 0.02], [-0.78 * s, 0.2 * s, 0]);
  if (kind !== 'transport') {
    m.box('paint', P3, [0.12 * s, 0.02, 0.5 * s], [0, -0.02 * s, 0]); // stub wings
    for (const z of [-1, 1]) m.tube('fixed', GUN, 0.025 * s, 0.18 * s, [0.02, -0.06 * s, z * 0.22 * s]);
  }
  for (const z of [-1, 1]) m.box('fixed', DARK, [0.4 * s, 0.015, 0.015], [0, -0.15 * s, z * 0.11 * s]); // skids
  const blades = (pv: Pivot, x: number, y: number, n: number, len: number) => {
    m.use(pv, x, y, 0);
    m.cyl('fixed', GUN, 0.025, 0.03, 0.06, [0, -0.02, 0]);
    for (let i = 0; i < n; i++) m.box('fixed', 0x22231f, [len, 0.008, 0.045], [0, 0, 0], [0, (i * Math.PI) / n, 0]);
  };
  if (kind === 'transport') {
    blades('rotor', 0.32 * s, 0.2 * s, 3, 0.9 * s);
    blades('rotor2', -0.32 * s, 0.24 * s, 3, 0.9 * s);
  } else blades('rotor', 0, 0.18 * s, 2, 0.95 * s);
  return m.build(0.4 * s);
}

function jet(bomber: boolean): Model {
  const m = new ModelBuilder();
  const s = bomber ? 1.5 : 1;
  m.tube('paint', P, 0.07 * s, 0.9 * s, [0, 0, 0], 8, 0.03 * s);
  m.wedge('paint', P2, 0.3 * s, 0.13 * s, 0.14 * s, [0.55 * s, 0, 0], [Math.PI / 2, 0, 0]);
  m.box('paint', P2, [0.32 * s, 0.025, bomber ? 1.4 * s : 0.9 * s], [-0.05 * s, -0.01, 0], [0, bomber ? 0 : 0, 0]);
  m.box('paint', P3, [0.16 * s, 0.02, 0.38 * s], [-0.38 * s, 0, 0]);
  m.box('paint', P2, [0.14 * s, 0.18 * s, 0.015], [-0.38 * s, 0.1 * s, 0], [0, 0, 0.5]);
  m.box('team', P, [0.1 * s, 0.026, bomber ? 1.41 * s : 0.91 * s], [-0.12 * s, -0.01, 0]);
  m.box('fixed', GLASS, [0.15 * s, 0.05 * s, 0.07 * s], [0.25 * s, 0.06 * s, 0]);
  m.cyl('glow', 0xffa060, 0.05 * s, 0.05 * s, 0.02, [-0.46 * s, 0, 0], [0, 0, Math.PI / 2]); // afterburner
  if (bomber)
    for (const z of [-0.35, 0.35]) m.tube('fixed', METAL, 0.05 * s, 0.22 * s, [0.02 * s, -0.06 * s, z * s], 8);
  return m.build(0.5 * s);
}

function drone(): Model {
  const m = new ModelBuilder();
  m.tube('paint', P, 0.035, 0.42, [0, 0, 0], 6, 0.02);
  m.box('paint', P2, [0.08, 0.012, 0.7], [0.02, 0.01, 0]);
  m.box('paint', P2, [0.06, 0.08, 0.01], [-0.18, 0.04, 0], [0, 0, 0.5]);
  m.box('team', P, [0.05, 0.013, 0.71], [0.02, 0.012, 0]);
  m.use('rotor', -0.23, 0, 0);
  m.box('fixed', 0x222222, [0.01, 0.12, 0.02], [0, 0, 0], [0, 0, 0]);
  return m.build(0.3);
}

function boat(kind: 'patrol' | 'destroyer' | 'landing' | 'sub'): Model {
  const m = new ModelBuilder();
  if (kind === 'sub') {
    m.sphere('paint', P3, 0.14, [0, 0, 0], [5, 0.9, 1], 10);
    m.box('paint', P2, [0.22, 0.2, 0.06], [0.12, 0.13, 0]);
    m.box('team', P, [0.12, 0.02, 0.065], [0.12, 0.2, 0]);
    m.box('paint', P3, [0.08, 0.015, 0.3], [0.13, 0.12, 0]);
    return m.build(0.6);
  }
  const L = kind === 'destroyer' ? 2.2 : kind === 'landing' ? 1.2 : 1.0;
  const W = kind === 'destroyer' ? 0.5 : kind === 'landing' ? 0.6 : 0.34;
  m.box('paint', P2, [L * 0.75, 0.16, W], [-L * 0.1, 0.03, 0]);
  m.wedge('paint', P2, L * 0.3, 0.16, W, [L * 0.375, 0.03, 0]);
  m.box('fixed', 0x7a2e24, [L * 0.95, 0.04, W * 0.96], [0, -0.06, 0]); // waterline
  m.box('team', P, [L * 0.2, 0.012, W * 0.6], [L * 0.25, 0.115, 0]);
  if (kind === 'landing') {
    m.box('paint', P3, [0.05, 0.2, W], [L * 0.45, 0.12, 0]); // ramp
    m.box('fixed', ASPHALT, [L * 0.6, 0.02, W * 0.8], [0, 0.11, 0]);
    m.box('paint', P, [0.16, 0.22, W * 0.5], [-L * 0.38, 0.22, 0]);
    return m.build(0.55);
  }
  m.box('paint', P, [L * 0.22, kind === 'destroyer' ? 0.3 : 0.18, W * 0.6], [-L * 0.05, 0.22, 0]); // bridge
  m.box('fixed', GLASS, [0.02, 0.05, W * 0.5], [L * 0.06, 0.28, 0]);
  m.box('glow', WARM, [0.01, 0.025, W * 0.45], [L * 0.065, 0.28, 0]);
  m.cyl('fixed', METAL, 0.012, 0.015, 0.4, [-L * 0.08, 0.5, 0]); // mast
  m.box('glow', RED, [0.03, 0.03, 0.03], [-L * 0.08, 0.71, 0]);
  if (kind === 'destroyer') {
    m.cyl('paint', P3, 0.07, 0.08, 0.2, [-L * 0.25, 0.3, 0]); // funnel
    m.cyl('paint', P2, 0.09, 0.1, 0.07, [-L * 0.38, 0.15, 0]);
    m.tube('fixed', GUN, 0.02, 0.24, [-L * 0.3, 0.18, 0]);
  }
  m.use('turret', L * 0.25, 0.14, 0);
  m.cyl('paint', P, 0.08, 0.1, 0.07, [0, 0.03, 0], undefined, 8);
  m.tube('fixed', GUN, kind === 'destroyer' ? 0.022 : 0.013, kind === 'destroyer' ? 0.3 : 0.18, [0.15, 0.05, 0]);
  return m.build(kind === 'destroyer' ? 0.9 : 0.5);
}

const unitCache = new Map<UnitTypeId, Model>();

export function unitModel(type: UnitTypeId): Model {
  let m = unitCache.get(type);
  if (m) return m;
  const def = UNITS[type];
  switch (type) {
    case 'main-battle-tank':
      m = tank(1, false);
      break;
    case 'heavy-tank':
      m = tank(1.18, true);
      break;
    case 'light-tank':
      m = tank(0.85, false);
      break;
    case 'recon-vehicle':
      m = truck((b) => {
        b.box('paint', P2, [0.5, 0.12, 0.38], [-0.12, 0.24, 0]);
        b.use('turret', -0.1, 0.32, 0);
        b.cyl('paint', P3, 0.06, 0.07, 0.05, [0, 0.02, 0]);
        b.tube('fixed', GUN, 0.012, 0.22, [0.13, 0.03, 0]);
      }, 0.85);
      break;
    case 'apc':
      m = apcLike(false, 'small');
      break;
    case 'ifv':
      m = apcLike(true, 'cannon');
      break;
    case 'mobile-artillery': {
      const b = new ModelBuilder();
      tracks(b, 1.0, 0.56, 0.16);
      b.box('paint', P2, [0.95, 0.14, 0.4], [0, 0.22, 0]);
      b.box('team', P, [0.06, 0.03, 0.41], [0.32, 0.27, 0]);
      b.use('turret', -0.15, 0.3, 0);
      b.box('paint', P, [0.5, 0.2, 0.42], [0, 0.1, 0]);
      b.tube('fixed', GUN, 0.035, 0.85, [0.55, 0.22, 0], 6, 0.028);
      m = b.build(0.45);
      break;
    }
    case 'rocket-launcher':
      m = truck((b) => {
        b.use('turret', -0.15, 0.22, 0);
        b.box('paint', P2, [0.46, 0.16, 0.34], [0, 0.12, 0], [0, 0, 0.35]);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 2; j++)
            b.cyl('fixed', 0x1d1d1a, 0.03, 0.03, 0.02, [0.22, 0.2 + j * 0.07, -0.1 + i * 0.1], [0, 0, Math.PI / 2 - 0.35]);
      });
      break;
    case 'missile-system':
      m = truck((b) => {
        b.use('turret', -0.1, 0.2, 0);
        b.box('fixed', 0x3a3a36, [0.1, 0.1, 0.3], [-0.2, 0.05, 0]);
        for (const z of [-0.08, 0.08]) b.tube('paint', P2, 0.06, 0.62, [0.05, 0.14, z], 8);
      }, 1.15);
      break;
    case 'mcv':
      m = truck((b) => {
        b.box('paint', P, [0.6, 0.3, 0.42], [-0.15, 0.32, 0]);
        b.box('paint', P2, [0.4, 0.08, 0.3], [-0.2, 0.51, 0]);
        b.cyl('fixed', METAL, 0.015, 0.015, 0.4, [-0.38, 0.65, 0.12]);
        b.use('spin', -0.05, 0.56, -0.08);
        b.box('fixed', WHITE, [0.02, 0.12, 0.16], [0, 0.06, 0]);
      }, 1.2);
      break;
    case 'attack-helicopter':
      m = heli('attack');
      break;
    case 'gunship':
      m = heli('gunship');
      break;
    case 'transport-helicopter':
      m = heli('transport');
      break;
    case 'recon-drone':
      m = drone();
      break;
    case 'fighter-jet':
      m = jet(false);
      break;
    case 'bomber':
      m = jet(true);
      break;
    case 'patrol-boat':
      m = boat('patrol');
      break;
    case 'destroyer':
      m = boat('destroyer');
      break;
    case 'landing-craft':
      m = boat('landing');
      break;
    case 'submarine':
      m = boat('sub');
      break;
    default:
      if (def.category === 'infantry') m = infantry(type);
      else if (def.look && def.look !== type) m = unitModel(def.look);
      else if (def.category === 'air') m = heli('attack');
      else if (def.category === 'naval') m = boat('patrol');
      else m = tank(0.9, false);
  }
  unitCache.set(type, m);
  return m;
}

// --------------------------------------------------------------------------------------------- buildings
/** Height in tiles from the isometric prism height (screen px). */
const bh = (px: number) => px * 0.026;

function windows(m: ModelBuilder, len: number, y: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / n) * (i + 0.5);
    m.box('glow', WARM, [len / n - 0.08, 0.06, 0.01], [x, y, z]);
  }
}

const buildingCache = new Map<BuildingTypeId, Model>();

export function buildingModel(type: BuildingTypeId): Model {
  let cached = buildingCache.get(type);
  if (cached) return cached;
  const def = BUILDINGS[type];
  const W = def.w;
  const D = def.h;
  const H = bh(def.height);
  const m = new ModelBuilder();
  if (type !== 'wall') m.box('fixed', CONCRETE, [W - 0.06, 0.08, D - 0.06], [0, 0.04, 0]); // foundation slab
  const flag = (x: number, z: number, h: number) => {
    m.cyl('fixed', METAL, 0.012, 0.012, h, [x, h / 2, z]);
    m.box('team', P, [0.22, 0.14, 0.01], [x + 0.12, h - 0.08, z]);
  };
  switch (type) {
    case 'headquarters':
      m.box('paint', P, [W * 0.72, H * 0.6, D * 0.72], [-0.1, 0.08 + H * 0.3, 0]);
      m.box('paint', P2, [W * 0.42, H * 0.35, D * 0.45], [-0.25, 0.08 + H * 0.6 + H * 0.175, 0]);
      m.box('team', P, [W * 0.73, 0.06, D * 0.73], [-0.1, 0.08 + H * 0.55, 0]);
      windows(m, W * 0.6, 0.08 + H * 0.35, D * 0.36 + 0.01, 4);
      windows(m, W * 0.6, 0.08 + H * 0.35, -D * 0.36 - 0.01, 4);
      m.box('fixed', ASPHALT, [0.6, 0.02, 0.6], [W * 0.3, 0.09, D * 0.25]); // helipad
      m.box('fixed', WHITE, [0.3, 0.025, 0.05], [W * 0.3, 0.095, D * 0.25]);
      m.cyl('fixed', METAL, 0.015, 0.02, 0.9, [-0.4, 0.08 + H + 0.4, 0.3]);
      m.box('glow', RED, [0.04, 0.04, 0.04], [-0.4, 0.08 + H + 0.86, 0.3]);
      m.use('spin', -0.1, 0.08 + H * 0.95 + 0.06, -0.25);
      m.box('fixed', WHITE, [0.04, 0.2, 0.3], [0, 0.1, 0]);
      break;
    case 'power-plant':
      for (const z of [-0.42, 0.42]) {
        m.cyl('fixed', 0xb9b7ae, 0.32, 0.4, H, [0.25, H / 2 + 0.08, z], undefined, 12);
        m.cyl('fixed', 0x55534d, 0.3, 0.3, 0.02, [0.25, H + 0.09, z], undefined, 12);
      }
      m.box('paint', P, [0.6, H * 0.45, D * 0.8], [-0.55, 0.08 + H * 0.225, 0]);
      m.box('team', P, [0.61, 0.05, D * 0.81], [-0.55, 0.08 + H * 0.4, 0]);
      windows(m, 0.5, 0.08 + H * 0.25, D * 0.4 + 0.01, 3);
      break;
    case 'resource-extractor':
    case 'oil-derrick': {
      m.box('paint', P2, [W * 0.5, H * 0.35, D * 0.4], [-0.35, 0.08 + H * 0.175, -0.4]);
      m.box('team', P, [W * 0.51, 0.04, D * 0.41], [-0.35, 0.08 + H * 0.3, -0.4]);
      for (const z of [0.35, -0.05]) m.cyl('fixed', 0x8a8478, 0.22, 0.22, H * 0.5, [-0.4, 0.08 + H * 0.25, z + 0.3], undefined, 10);
      // Derrick: four legs leaning together.
      const top = H * 1.4;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const len = Math.hypot(top, 0.28);
        m.box('fixed', 0x9c6a2a, [0.04, len, 0.04], [0.4 + x * 0.14, top / 2, 0.1 + z * 0.14], [z * -0.2, 0, x * 0.2]);
      }
      m.use('spin', 0.4, top * 0.55, 0.1);
      m.box('fixed', 0x5a5a5a, [0.4, 0.05, 0.05], [0, 0, 0]);
      m.box('fixed', 0x5a5a5a, [0.05, 0.05, 0.4], [0, 0, 0]);
      break;
    }
    case 'barracks':
      m.box('paint', P, [W * 0.82, H * 0.55, D * 0.62], [0, 0.08 + H * 0.275, -0.1]);
      m.roof('paint', P3, W * 0.86, H * 0.35, D * 0.7, [0, 0.08 + H * 0.55, -0.1]);
      m.box('team', P, [W * 0.83, 0.05, D * 0.63], [0, 0.08 + H * 0.5, -0.1]);
      windows(m, W * 0.7, 0.08 + H * 0.3, D * 0.21 + 0.01, 4);
      for (let i = 0; i < 5; i++) m.box('fixed', 0x8d7c58, [0.18, 0.08, 0.1], [-0.5 + i * 0.25, 0.12, D * 0.38]); // sandbags
      flag(W * 0.4, D * 0.4, 1.0);
      break;
    case 'war-factory':
    case 'repair-bay': {
      m.box('paint', P, [W * 0.86, H * 0.55, D * 0.8], [0, 0.08 + H * 0.275, 0]);
      const n = Math.max(2, Math.round(W));
      for (let i = 0; i < n; i++)
        m.wedge('paint', P3, H * 0.3, W * 0.86 / n, D * 0.8, [-W * 0.43 + (W * 0.86 / n) * (i + 0.5), 0.08 + H * 0.55 + H * 0.1, 0], [0, 0, Math.PI / 2]);
      m.box('fixed', 0x2c2e2b, [0.02, H * 0.42, D * 0.5], [W * 0.43 + 0.01, 0.08 + H * 0.21, 0]); // door
      m.box('team', P, [W * 0.87, 0.06, D * 0.81], [0, 0.08 + H * 0.5, 0]);
      m.box('glow', WARM, [0.02, 0.04, D * 0.5], [W * 0.43 + 0.02, 0.08 + H * 0.44, 0]);
      m.cyl('fixed', 0x6c6a64, 0.08, 0.1, H * 0.9, [-W * 0.3, 0.08 + H * 0.9, -D * 0.25]); // chimney
      if (type === 'repair-bay') {
        m.box('fixed', 0xd0a030, [0.08, H, 0.08], [W * 0.3, 0.08 + H, D * 0.3]);
        m.box('fixed', 0xd0a030, [0.08, 0.08, D * 0.7], [W * 0.3, 0.08 + H * 1.5, 0]);
      }
      break;
    }
    case 'airfield':
      m.box('fixed', ASPHALT, [W * 0.96, 0.03, D * 0.5], [0, 0.1, D * 0.15]);
      for (let i = 0; i < 4; i++) m.box('fixed', WHITE, [0.25, 0.035, 0.05], [-W * 0.35 + i * W * 0.22, 0.1, D * 0.15]);
      for (let i = 0; i < 6; i++) m.box('glow', i % 2 ? WARM : 0x7fd0ff, [0.04, 0.04, 0.04], [-W * 0.45 + i * W * 0.18, 0.12, D * 0.42]);
      m.box('paint', P, [W * 0.4, H * 0.45, D * 0.35], [-W * 0.2, 0.08 + H * 0.225, -D * 0.27]);
      m.roof('paint', P3, W * 0.4, H * 0.18, D * 0.36, [-W * 0.2, 0.08 + H * 0.45, -D * 0.27]);
      m.box('paint', P2, [0.3, H * 1.1, 0.3], [W * 0.3, 0.08 + H * 0.55, -D * 0.3]);
      m.box('fixed', GLASS, [0.42, 0.2, 0.42], [W * 0.3, 0.08 + H * 1.2, -D * 0.3]);
      m.box('glow', 0x9fe0ff, [0.43, 0.06, 0.43], [W * 0.3, 0.08 + H * 1.2, -D * 0.3]);
      m.box('team', P, [0.31, 0.06, 0.31], [W * 0.3, 0.08 + H * 0.95, -D * 0.3]);
      break;
    case 'naval-yard':
      m.box('fixed', 0x6f6d66, [W * 0.96, 0.12, D * 0.96], [0, 0.06, 0]);
      m.box('paint', P, [W * 0.35, H * 0.5, D * 0.4], [-W * 0.28, 0.08 + H * 0.25, -D * 0.25]);
      m.box('team', P, [W * 0.36, 0.05, D * 0.41], [-W * 0.28, 0.08 + H * 0.45, -D * 0.25]);
      m.box('fixed', 0xd0a030, [0.08, H * 1.4, 0.08], [W * 0.25, 0.08 + H * 0.7, D * 0.25]);
      m.box('fixed', 0xd0a030, [W * 0.6, 0.07, 0.07], [W * 0.05, 0.08 + H * 1.4, D * 0.25]);
      break;
    case 'research-center':
      m.box('paint', P, [W * 0.7, H * 0.5, D * 0.7], [0, 0.08 + H * 0.25, 0]);
      m.dome('fixed', 0xd8dbd8, Math.min(W, D) * 0.3, [0, 0.08 + H * 0.5, 0], 14);
      m.box('team', P, [W * 0.71, 0.05, D * 0.71], [0, 0.08 + H * 0.45, 0]);
      windows(m, W * 0.6, 0.08 + H * 0.25, D * 0.35 + 0.01, 4);
      break;
    case 'radar-station':
      m.box('paint', P, [W * 0.6, H * 0.4, D * 0.6], [0, 0.08 + H * 0.2, 0]);
      m.box('team', P, [W * 0.61, 0.05, D * 0.61], [0, 0.08 + H * 0.35, 0]);
      m.cyl('fixed', METAL, 0.05, 0.08, H * 0.6, [0, 0.08 + H * 0.7, 0]);
      m.use('spin', 0, 0.08 + H, 0);
      m.box('fixed', 0xdcdedb, [0.06, 0.5, 0.9], [0.05, 0.15, 0], [0, 0, 0.3]);
      m.box('glow', RED, [0.04, 0.04, 0.04], [0, 0.45, 0]);
      break;
    case 'defense-turret':
    case 'bastion':
    case 'howitzer':
    case 'sam-site':
    case 'missile-launcher': {
      const r = Math.min(W, D) * 0.38;
      m.cyl('fixed', CONCRETE, r, r * 1.15, H * 0.4, [0, 0.08 + H * 0.2, 0], undefined, 10);
      m.box('team', P, [r * 1.6, 0.04, r * 1.6], [0, 0.08 + H * 0.36, 0]);
      if (type === 'bastion') {
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
          m.box('fixed', CONCRETE, [0.35, H * 0.6, 0.35], [x * W * 0.35, 0.08 + H * 0.3, z * D * 0.35]);
      }
      m.use('turret', 0, 0.08 + H * 0.4, 0);
      if (type === 'sam-site' || type === 'missile-launcher') {
        m.box('paint', P2, [0.3, 0.1, 0.4], [0, 0.06, 0]);
        for (const z of [-0.12, 0.12])
          for (const y of [0.15, 0.27]) m.tube('paint', P, 0.05, 0.5, [0.05, y, z], 8);
      } else {
        m.box('paint', P, [r * 1.1, 0.2, r * 1.1], [0, 0.1, 0]);
        m.box('paint', P2, [0.15, 0.16, r], [r * 0.6, 0.08, 0], [0, 0, 0.4]);
        const big = type === 'howitzer';
        m.tube('fixed', GUN, big ? 0.05 : 0.035, big ? 1.0 : 0.6, [r * 0.55 + (big ? 0.5 : 0.3), 0.12, 0], 6);
      }
      break;
    }
    case 'wall':
      m.box('fixed', 0xa29f95, [W * 0.98, 0.42, D * 0.98], [0, 0.21, 0]);
      m.box('fixed', 0x8a877e, [W * 1.0, 0.05, D * 1.0], [0, 0.44, 0]);
      break;
    case 'bunker':
      m.box('fixed', 0x9a978c, [W * 0.8, H * 0.45, D * 0.8], [0, 0.08 + H * 0.225, 0]);
      m.box('fixed', 0x111111, [0.02, 0.06, D * 0.5], [W * 0.4 + 0.01, 0.08 + H * 0.3, 0]);
      m.box('team', P, [W * 0.81, 0.03, D * 0.81], [0, 0.08 + H * 0.3, 0]);
      for (let i = 0; i < 6; i++) m.box('fixed', 0x8d7c58, [0.16, 0.08, 0.1], [-0.4 + i * 0.16, 0.12, D * 0.45]);
      break;
    case 'field-hospital':
      m.roof('fixed', 0xdcd8c8, W * 0.8, H * 0.7, D * 0.7, [0, 0.08, 0]);
      m.box('fixed', RED, [0.3, 0.08, 0.02], [0, 0.08 + H * 0.4, D * 0.25]);
      m.box('fixed', RED, [0.08, 0.3, 0.02], [0, 0.08 + H * 0.4, D * 0.25]);
      flag(W * 0.4, -D * 0.4, 0.9);
      break;
    default:
      m.box('paint', P, [W * 0.8, H, D * 0.8], [0, 0.08 + H / 2, 0]);
      m.box('team', P, [W * 0.81, 0.05, D * 0.81], [0, 0.08 + H * 0.85, 0]);
  }
  cached = m.build(Math.max(W, D) / 2);
  buildingCache.set(type, cached);
  return cached;
}
