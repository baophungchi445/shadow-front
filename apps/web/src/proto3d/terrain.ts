import * as THREE from 'three';
import type { MapDef, TileKind } from '@shadow-front/shared-types';
import type { FogOfWarLayer } from './fow';

/** Height of a hill plateau above the plain (tiles). */
export const HILL_H = 0.6;
/** Depth of the sea bed below the plain. */
const WATER_DEPTH = 0.55;
/** Water surface height. */
export const WATER_Y = -0.12;
/** Vertices per tile edge. */
const RES = 2;

const GROUND: Record<TileKind, number> = {
  sand: 0xc2a26c,
  grass: 0x5d7b38,
  road: 0x4e4c47,
  concrete: 0x86867f,
  rock: 0x7b6a52,
  water: 0x6c6a52,
  urban: 0x5d5d5a,
  ore: 0x8a7048,
  snow: 0xe6ecf0,
  forest: 0x3d5627,
  hill: 0x8b7a52,
};

/** Deterministic hash noise in [0, 1). */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number): number {
  return valueNoise(x, y) * 0.55 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.15;
}

export class Terrain {
  readonly group = new THREE.Group();
  private mesh!: THREE.Mesh;
  private decor: THREE.InstancedMesh[] = [];
  private water!: THREE.Mesh;
  private waterUniforms = { uTime: { value: 0 }, uShore: { value: null as THREE.DataTexture | null } };

  constructor(
    private map: MapDef,
    private readonly fow: FogOfWarLayer,
    private readonly snowy: boolean,
  ) {
    this.build();
  }

  private tile(tx: number, ty: number): TileKind {
    const m = this.map;
    const x = Math.min(m.width - 1, Math.max(0, tx));
    const y = Math.min(m.height - 1, Math.max(0, ty));
    return m.tiles[y * m.width + x];
  }

  /** Bilinear mask of a tile kind sampled between tile centres. */
  private mask(x: number, y: number, test: (k: TileKind) => boolean): number {
    const fx = x - 0.5;
    const fy = y - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = fx - x0;
    const ay = fy - y0;
    const v = (tx: number, ty: number) => (test(this.tile(tx, ty)) ? 1 : 0);
    return (
      v(x0, y0) * (1 - ax) * (1 - ay) + v(x0 + 1, y0) * ax * (1 - ay) + v(x0, y0 + 1) * (1 - ax) * ay + v(x0 + 1, y0 + 1) * ax * ay
    );
  }

  /** Ground height for units (no surface noise). */
  heightAt(x: number, y: number): number {
    const hill = this.mask(x, y, (k) => k === 'hill');
    const h = hill * hill * (3 - 2 * hill) * HILL_H;
    const water = this.mask(x, y, (k) => k === 'water');
    return h - water * WATER_DEPTH;
  }

  isWater(x: number, y: number): boolean {
    return this.tile(Math.floor(x), Math.floor(y)) === 'water';
  }

  /** Rebuilds after the map changed (destroyed forest / city tiles). */
  refresh(map: MapDef): void {
    this.map = map;
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.groundGeometry();
    for (const d of this.decor) {
      this.group.remove(d);
      d.dispose();
    }
    this.decor = this.buildDecor();
    this.decor.forEach((d) => this.group.add(d));
  }

  update(time: number): void {
    this.waterUniforms.uTime.value = time;
  }

  private build(): void {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      map: detailTexture(),
    });
    this.fow.patch(mat);
    this.mesh = new THREE.Mesh(this.groundGeometry(), mat);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    // Land outside the map (a frame of four strips), so the camera never shows the void at the edges.
    const skirtMat = new THREE.MeshStandardMaterial({ color: this.snowy ? 0x9aa3a8 : 0x4a4535, roughness: 1 });
    this.fow.patch(skirtMat);
    const { width: MW, height: MH } = this.map;
    const B = 80;
    for (const [x, z, w, d] of [
      [MW / 2, -B / 2, MW + 2 * B, B],
      [MW / 2, MH + B / 2, MW + 2 * B, B],
      [-B / 2, MH / 2, B, MH],
      [MW + B / 2, MH / 2, B, MH],
    ]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), skirtMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, -0.03, z);
      strip.receiveShadow = true;
      this.group.add(strip);
    }

    if (this.map.tiles.includes('water')) this.buildWater();
    this.decor = this.buildDecor();
    this.decor.forEach((d) => this.group.add(d));
  }

  private groundGeometry(): THREE.BufferGeometry {
    const { width: W, height: H } = this.map;
    const nx = W * RES + 1;
    const ny = H * RES + 1;
    const pos = new Float32Array(nx * ny * 3);
    const col = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    const c = new THREE.Color();
    const acc = new THREE.Color();
    const kinds = Object.keys(GROUND) as TileKind[];
    const palette = new Map(kinds.map((k) => [k, new THREE.Color(GROUND[k])]));
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = i / RES;
        const y = j / RES;
        const k = j * nx + i;
        const n = fbm(x * 0.35, y * 0.35);
        const land = 1 - this.mask(x, y, (t) => t === 'water');
        let h = this.heightAt(x, y) + (n - 0.5) * 0.12 * land;
        // Rock tiles are rough little outcrops.
        h += this.mask(x, y, (t) => t === 'rock') * (0.1 + hash(i, j) * 0.18);
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = y;
        uv[k * 2] = x / 3;
        uv[k * 2 + 1] = y / 3;
        // Colour: weighted blend of the four surrounding tiles, sharpened so roads stay crisp.
        acc.setRGB(0, 0, 0);
        let wsum = 0;
        const fx = x - 0.5;
        const fy = y - 0.5;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const ax = fx - x0;
        const ay = fy - y0;
        for (const [dx, dy, w0] of [
          [0, 0, (1 - ax) * (1 - ay)],
          [1, 0, ax * (1 - ay)],
          [0, 1, (1 - ax) * ay],
          [1, 1, ax * ay],
        ] as const) {
          const t = this.tile(x0 + dx, y0 + dy);
          const w = w0 * w0 * w0 * (t === 'road' || t === 'concrete' ? 2 : 1);
          acc.r += palette.get(t)!.r * w;
          acc.g += palette.get(t)!.g * w;
          acc.b += palette.get(t)!.b * w;
          wsum += w;
        }
        c.setRGB(acc.r / wsum, acc.g / wsum, acc.b / wsum);
        // Large-scale variation (patches of dry / lush ground) and fine grain.
        const v = 0.82 + n * 0.32 + (hash(i * 3.1, j * 1.7) - 0.5) * 0.06;
        c.multiplyScalar(v);
        // Darker, damp ground near water.
        const wet = this.mask(x, y, (t) => t === 'water');
        if (wet > 0 && wet < 1) c.multiplyScalar(1 - wet * 0.35);
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
    const idx: number[] = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private buildWater(): void {
    const { width: W, height: H } = this.map;
    // Shore texture: 1 near land, fading to 0 in open water (foam + shallow colour).
    const S = 4;
    const data = new Uint8Array(W * S * H * S);
    for (let j = 0; j < H * S; j++)
      for (let i = 0; i < W * S; i++) {
        const x = (i + 0.5) / S;
        const y = (j + 0.5) / S;
        let d = 9;
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            if (this.tile(tx + dx, ty + dy) === 'water') continue;
            const cx = Math.max(tx + dx, Math.min(x, tx + dx + 1));
            const cy = Math.max(ty + dy, Math.min(y, ty + dy + 1));
            d = Math.min(d, Math.hypot(x - cx, y - cy));
          }
        data[j * W * S + i] = Math.round(255 * Math.max(0, 1 - d / 2));
      }
    const shore = new THREE.DataTexture(data, W * S, H * S, THREE.RedFormat, THREE.UnsignedByteType);
    shore.magFilter = THREE.LinearFilter;
    shore.minFilter = THREE.LinearFilter;
    shore.needsUpdate = true;
    this.waterUniforms.uShore.value = shore;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
    });
    const u = this.waterUniforms;
    const size = { uWaterSize: { value: new THREE.Vector2(W, H) } };
    this.fow.patch(mat, (shader) => {
      Object.assign(shader.uniforms, u, size);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uTime;
uniform sampler2D uShore;
uniform vec2 uWaterSize;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  float shoreV = texture2D(uShore, vWPos.xz / uWaterSize).r;
  vec3 deep = vec3(0.01, 0.05, 0.075);
  vec3 shallow = vec3(0.03, 0.17, 0.17);
  diffuseColor.rgb = mix(deep, shallow, smoothstep(0.3, 1.0, shoreV));
  // Thin, broken foam line right at the shore.
  float foamN = sin(vWPos.x * 9.0 + uTime * 1.7) * sin(vWPos.z * 8.3 - uTime * 1.3);
  float lap = sin(uTime * 1.6 - shoreV * 14.0) * 0.5 + 0.5;
  float band = smoothstep(0.9, 0.985, shoreV + foamN * 0.02 + lap * 0.025) * (0.4 + 0.6 * foamN * foamN);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.76, 0.76), band * 0.55);
  diffuseColor.a = mix(0.9, 0.55, smoothstep(0.6, 1.0, shoreV));`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
  {
    vec2 p = vWPos.xz;
    float t = uTime;
    vec2 g = vec2(0.0);
    g += vec2(cos(p.x * 1.7 + t * 1.3), cos(p.y * 1.9 + t * 1.1)) * 0.10;
    g += vec2(cos(p.x * 4.1 - p.y * 2.3 + t * 2.1), cos(p.y * 3.7 + p.x * 1.9 + t * 1.7)) * 0.06;
    g += vec2(cos(p.x * 9.3 + p.y * 5.1 - t * 3.0), cos(p.y * 8.7 - p.x * 4.4 + t * 2.6)) * 0.03;
    normal = normalize(normal + (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz);
  }`,
        );
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.02, H + 0.02, 1, 1), mat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(W / 2, WATER_Y, H / 2);
    this.water.receiveShadow = true;
    this.water.renderOrder = 1;
    this.group.add(this.water);
  }

  private buildDecor(): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    const { width: W, height: H } = this.map;
    const trees: THREE.Matrix4[] = [];
    const treeCol: THREE.Color[] = [];
    const rocks: THREE.Matrix4[] = [];
    const blocks: THREE.Matrix4[] = [];
    const blockCol: THREE.Color[] = [];
    const crystals: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const put = (list: THREE.Matrix4[], x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number, rx = 0) => {
      q.setFromEuler(e.set(rx, ry, 0));
      list.push(m.clone().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
    };
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        const t = this.tile(tx, ty);
        const r = (k: number) => hash(tx * 13.7 + k * 3.3, ty * 7.9 + k * 1.1);
        if (t === 'forest') {
          const n = 3 + Math.floor(r(0) * 2);
          for (let i = 0; i < n; i++) {
            const x = tx + 0.15 + r(i + 1) * 0.7;
            const y = ty + 0.15 + r(i + 7) * 0.7;
            const s = 0.75 + r(i + 3) * 0.55;
            put(trees, x, this.heightAt(x, y), y, s, s * (0.9 + r(i + 4) * 0.4), s, r(i + 5) * 6.28);
            const c = new THREE.Color().setHSL(0.24 + r(i + 6) * 0.06, 0.35 + r(i + 2) * 0.2, 0.75 + r(i + 8) * 0.25);
            if (this.snowy) c.lerp(new THREE.Color(1.6, 1.65, 1.7), 0.45);
            treeCol.push(c);
          }
        } else if (t === 'rock') {
          for (let i = 0; i < 2; i++) {
            const x = tx + 0.2 + r(i) * 0.6;
            const y = ty + 0.2 + r(i + 4) * 0.6;
            const s = 0.1 + r(i + 2) * 0.13;
            put(rocks, x, this.heightAt(x, y) + s * 0.3, y, s * 1.3, s * 0.8, s, r(i + 9) * 6.28, r(i + 5));
          }
        } else if (t === 'urban') {
          const h = 0.35 + r(1) * r(2) * 1.6;
          const inset = 0.08 + r(3) * 0.08;
          const x = tx + 0.5;
          const y = ty + 0.5;
          put(blocks, x, this.heightAt(x, y) + h / 2, y, 1 - inset * 2, h, 1 - inset * 2, 0);
          const g = 0.55 + r(4) * 0.35;
          blockCol.push(new THREE.Color(g, g * (0.96 + r(5) * 0.06), g * (0.92 + r(6) * 0.08)));
        } else if (t === 'ore') {
          const n = 4 + Math.floor(r(0) * 3);
          for (let i = 0; i < n; i++) {
            const x = tx + 0.15 + r(i + 1) * 0.7;
            const y = ty + 0.15 + r(i + 7) * 0.7;
            const s = 0.06 + r(i + 3) * 0.08;
            put(crystals, x, this.heightAt(x, y) + s, y, s, s * 2.2, s, r(i) * 6.28, (r(i + 2) - 0.5) * 0.6);
          }
        }
      }

    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cols?: THREE.Color[]) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      cols?.forEach((c, i) => im.setColorAt(i, c));
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      out.push(im);
    };
    const lit = (o: THREE.MeshStandardMaterialParameters) => {
      const mat = new THREE.MeshStandardMaterial(o);
      this.fow.patch(mat);
      return mat;
    };
    mk(treeGeometry(), lit({ vertexColors: true, roughness: 0.9, flatShading: true }), trees, treeCol);
    mk(new THREE.DodecahedronGeometry(1, 0), lit({ color: this.snowy ? 0xb5b8b8 : 0x857860, roughness: 0.95, flatShading: true }), rocks);
    mk(cityBlockGeometry(), lit({ vertexColors: true, roughness: 0.85 }), blocks, blockCol);
    mk(
      new THREE.OctahedronGeometry(1, 0),
      lit({ color: 0xe0b040, emissive: 0x8a5a10, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.3, flatShading: true }),
      crystals,
    );
    return out;
  }
}

function coloured(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0;
  for (const p of parts) total += p.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.getAttribute('position').array as Float32Array, o * 3);
    col.set(p.getAttribute('color').array as Float32Array, o * 3);
    o += p.getAttribute('position').count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function treeGeometry(): THREE.BufferGeometry {
  const trunk = coloured(new THREE.CylinderGeometry(0.03, 0.045, 0.25, 5).translate(0, 0.125, 0), 0x5a4330);
  const low = coloured(new THREE.ConeGeometry(0.26, 0.45, 7).translate(0, 0.42, 0), 0x3f6a2c);
  const high = coloured(new THREE.ConeGeometry(0.19, 0.38, 7).translate(0, 0.66, 0), 0x4a7a33);
  return merge([trunk, low, high]);
}

function cityBlockGeometry(): THREE.BufferGeometry {
  // Unit box (scaled per instance) with a darker roof cap and a rooftop unit.
  const body = coloured(new THREE.BoxGeometry(1, 1, 1), 0xb8b4aa);
  const cap = coloured(new THREE.BoxGeometry(1.02, 0.04, 1.02).translate(0, 0.5, 0), 0x6a6862);
  const unit = coloured(new THREE.BoxGeometry(0.25, 0.06, 0.2).translate(0.15, 0.53, -0.1), 0x8a8880);
  return merge([body, cap, unit]);
}

/** Tiling grain texture multiplied into the ground colour. */
function detailTexture(): THREE.Texture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  // Tileable value noise: lattice coordinates wrap at each octave's period.
  const per = (x: number, y: number, p: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hash(((a % p) + p) % p, ((b % p) + p) % p);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const u = i / S;
      const v0 = j / S;
      const n = per(u * 8, v0 * 8, 8) * 0.45 + per(u * 32, v0 * 32, 32) * 0.35 + per(u * 128, v0 * 128, 128) * 0.2;
      const v = Math.round(255 * (0.62 + n * 0.55));
      const k = (j * S + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.min(255, v);
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
