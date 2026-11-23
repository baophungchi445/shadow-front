import * as THREE from 'three';
import type { GameEvent, Weather, WeaponType } from '@shadow-front/shared-types';
import type { World } from '@shadow-front/game-core';
import type { EntityRenderer } from './entities';
import type { FogOfWarLayer } from './fow';
import type { Terrain } from './terrain';

// ------------------------------------------------------------------------------------------- particles
/**
 * CPU-simulated point sprites in one draw call. Additive systems (fire, sparks, flashes) use HDR colours above 1 so
 * the bloom pass picks them up; the alpha system draws smoke and dust.
 */
class Particles {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly s0: Float32Array;
  private readonly s1: Float32Array;
  private readonly c0: Float32Array;
  private readonly c1: Float32Array;
  private readonly drag: Float32Array;
  private readonly grav: Float32Array;
  private n = 0;

  constructor(
    readonly max: number,
    additive: boolean,
    texture: THREE.Texture,
  ) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: texture }, uScale: { value: 600 } },
      vertexShader: `
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        varying vec4 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a);
          if (gl_FragColor.a < 0.004) discard;
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  get count(): number {
    return this.n;
  }

  set scale(v: number) {
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = v;
  }

  /** Adds one particle; colours are [r, g, b, a] at birth and death. */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size0: number,
    size1: number,
    c0: readonly number[],
    c1: readonly number[],
    drag = 1,
    grav = 0,
  ): void {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = size0;
    this.s1[i] = size1;
    this.c0.set(c0, i * 4);
    this.c1.set(c1, i * 4);
    this.drag[i] = drag;
    this.grav[i] = grav;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.pow(this.drag[i], dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.grav[i] > 0 && this.pos[i * 3 + 1] < -0.1) this.life[i] = 0;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(t);
      for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    for (const a of ['position', 'aColor', 'aSize']) (g.getAttribute(a) as THREE.BufferAttribute).needsUpdate = true;
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    const mv = (arr: Float32Array, k: number) => arr.copyWithin(i * k, j * k, j * k + k);
    mv(this.pos, 3);
    mv(this.vel, 3);
    mv(this.col, 4);
    mv(this.c0, 4);
    mv(this.c1, 4);
    for (const a of [this.life, this.maxLife, this.s0, this.s1, this.drag, this.grav, this.size]) a[i] = a[j];
  }
}

function blobTexture(soft: number, noisy: boolean): THREE.Texture {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const dx = (i + 0.5) / S - 0.5;
      const dy = (j + 0.5) / S - 0.5;
      let d = Math.hypot(dx, dy) * 2;
      if (noisy) {
        const a = Math.atan2(dy, dx);
        d *= 1 + 0.18 * Math.sin(a * 5 + 1.3) * Math.sin(a * 3 - 0.7) + 0.08 * Math.sin(a * 11);
      }
      const v = Math.max(0, 1 - d);
      const k = (j * S + i) * 4;
      const shade = noisy ? 200 + 55 * Math.max(0, 1 - Math.hypot(dx + 0.12, dy + 0.15) * 2.2) : 255;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = shade;
      img.data[k + 3] = Math.round(255 * Math.pow(v, soft));
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function scorchTexture(): THREE.Texture {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(S, S);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const dx = (i + 0.5) / S - 0.5;
      const dy = (j + 0.5) / S - 0.5;
      const a = Math.atan2(dy, dx);
      const d = Math.hypot(dx, dy) * 2 * (1 + 0.1 * Math.sin(a * 5) * Math.sin(a * 3 + 1));
      const v = Math.max(0, 1 - d);
      const k = (j * S + i) * 4;
      img.data[k] = 18;
      img.data[k + 1] = 15;
      img.data[k + 2] = 12;
      img.data[k + 3] = Math.round(190 * Math.pow(Math.min(1, v * 1.6), 1.4));
    }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

// ------------------------------------------------------------------------------------------- effects
export interface EffectQuality {
  particles: number;
  lights: number;
  /** Keep 1 of every N optional particles. */
  keepEvery: number;
}

const FIRE0 = [6, 3.6, 1.2, 1];
const FIRE1 = [1.2, 0.25, 0.05, 0];
const FLASH0 = [9, 7, 4, 1];
const FLASH1 = [3, 1.5, 0.4, 0];
const SPARK0 = [7, 5, 2, 1];
const SPARK1 = [2, 0.6, 0.1, 0];

export class Effects {
  readonly group = new THREE.Group();
  private add: Particles;
  private smoke: Particles;
  private lights: { light: THREE.PointLight; life: number; max: number; power: number }[] = [];
  private proj: THREE.InstancedMesh;
  private projPrev = new Map<number, { x: number; y: number }>();
  private decals: THREE.InstancedMesh;
  private decalList: { x: number; y: number; h: number; s: number; r: number; until: number }[] = [];
  private optional = 0;
  /** Recent large events the camera may follow. */
  hotspot: { x: number; y: number; t: number } | null = null;
  shake = 0;
  private weather: THREE.LineSegments | THREE.Points | null = null;
  private weatherKind: Weather = 'clear';
  private weatherVel = new Float32Array(0);

  constructor(
    private readonly world: World,
    private readonly terrain: Terrain,
    private readonly entities: EntityRenderer,
    private readonly fow: FogOfWarLayer,
    private q: EffectQuality,
  ) {
    this.add = new Particles(q.particles, true, blobTexture(1.6, false));
    this.smoke = new Particles(q.particles, false, blobTexture(1.2, true));
    this.group.add(this.add.points, this.smoke.points);
    for (let i = 0; i < 8; i++) {
      const light = new THREE.PointLight(0xffa860, 0, 7, 2);
      this.lights.push({ light, life: 0, max: 1, power: 0 });
      this.group.add(light);
    }
    this.setLightCount(q.lights);
    const pg = new THREE.CapsuleGeometry(0.03, 0.22, 2, 4).rotateZ(Math.PI / 2);
    this.proj = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff }), 512);
    this.proj.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.proj.frustumCulled = false;
    this.proj.count = 0;
    this.proj.setColorAt(0, new THREE.Color());
    this.group.add(this.proj);
    const dm = new THREE.MeshStandardMaterial({
      map: scorchTexture(),
      transparent: true,
      depthWrite: false,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    fow.patch(dm);
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), dm, 160);
    this.decals.frustumCulled = false;
    this.decals.receiveShadow = true;
    this.decals.count = 0;
    this.decals.renderOrder = 1;
    this.group.add(this.decals);
  }

  setQuality(q: EffectQuality): void {
    this.q = q;
    this.setLightCount(q.lights);
  }

  /** Light count is fixed per quality (changing it would recompile every shader); unused lights stay at 0. */
  private setLightCount(n: number): void {
    this.lights.forEach((l, i) => (l.light.visible = i < n));
  }

  get particleCount(): number {
    return this.add.count + this.smoke.count;
  }

  set pointScale(v: number) {
    this.add.scale = v;
    this.smoke.scale = v;
  }

  private keep(): boolean {
    return this.optional++ % this.q.keepEvery === 0;
  }

  private visible(x: number, y: number): boolean {
    return !this.fow.enabled || this.world.fog.isVisible(this.entities.viewTeam, x, y);
  }

  private flashLight(x: number, h: number, y: number, power: number, life: number, color = 0xffa860): void {
    const n = this.q.lights;
    if (!n) return;
    let best = this.lights[0];
    for (let i = 0; i < n; i++) if (this.lights[i].life <= 0 || this.lights[i].power * this.lights[i].life < best.power * best.life) best = this.lights[i];
    best.light.position.set(x, h, y);
    best.light.color.setHex(color);
    best.life = life;
    best.max = life;
    best.power = power;
  }

  /** Remembers projectile positions before a simulation tick (for smooth interpolation). */
  snapshot(): void {
    this.projPrev.clear();
    for (const p of this.world.projectiles) this.projPrev.set(p.id, { x: p.x, y: p.y });
  }

  // ------------------------------------------------------------------ events
  handle(events: GameEvent[], time: number): void {
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.muzzle(e.from, e.tx, e.ty, e.weapon);
          break;
        case 'hit':
          if (this.visible(e.x, e.y)) this.impact(e.x, e.y, e.weapon, e.splash);
          break;
        case 'destroyed': {
          if (e.kind === 'unit') this.entities.addWreck(e.id, time);
          if (this.visible(e.x, e.y)) this.explosion(e.x, e.y, e.big ? (e.kind === 'building' ? 2.2 : 1.4) : 0.6, time);
          break;
        }
        case 'smoke':
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 2;
            const x = e.x + Math.cos(a) * r;
            const y = e.y + Math.sin(a) * r;
            this.smoke.emit(x, this.terrain.heightAt(x, y) + 0.2, y, 0, 0.05, 0, 9 + Math.random() * 4, 1.2, 2.6, [0.8, 0.82, 0.8, 0.7], [0.75, 0.75, 0.75, 0], 0.9);
          }
          break;
      }
    }
  }

  private muzzle(from: number, tx: number, ty: number, weapon: WeaponType): void {
    const p = this.entities.positions.get(from);
    const ent = this.world.entities.get(from);
    if (!p || !ent || !this.visible(p.x, p.y)) return;
    const a = Math.atan2(ty - p.y, tx - p.x);
    const air = ent.kind === 'unit' && ent.air;
    const reach = ent.kind === 'building' ? 0.9 : ent.kind === 'unit' && ent.def.category === 'infantry' ? 0.18 : 0.55;
    const x = p.x + Math.cos(a) * reach;
    const y = p.y + Math.sin(a) * reach;
    const h = p.h + (air ? -0.05 : ent.kind === 'unit' && ent.def.category === 'infantry' ? 0.27 : 0.38);
    const big = weapon === 'shell' || weapon === 'artillery';
    const s = weapon === 'bullet' ? 0.25 : big ? 0.8 : 0.45;
    this.add.emit(x, h, y, 0, 0, 0, 0.06, s, s * 1.4, FLASH0, FLASH1);
    if (weapon !== 'bullet') {
      for (let i = 0; i < (big ? 5 : 2); i++)
        if (this.keep())
          this.smoke.emit(x, h, y, Math.cos(a) * 0.6 + (Math.random() - 0.5) * 0.4, 0.3, Math.sin(a) * 0.6 + (Math.random() - 0.5) * 0.4, 1.2 + Math.random(), 0.25, big ? 1.2 : 0.7, [0.6, 0.58, 0.55, 0.45], [0.5, 0.5, 0.5, 0], 0.4);
      this.flashLight(x, h + 0.3, y, big ? 3 : 1.5, 0.08, 0xffb070);
    }
  }

  private impact(x: number, y: number, weapon: WeaponType, splash: number): void {
    const g = Math.max(0, this.terrain.heightAt(x, y));
    if (weapon === 'bullet') {
      for (let i = 0; i < 3; i++)
        this.add.emit(x, g + 0.2, y, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.2, 0.08, 0.02, SPARK0, SPARK1, 0.5, 4);
      if (this.keep()) this.smoke.emit(x, g + 0.1, y, 0, 0.25, 0, 0.7, 0.15, 0.45, [0.55, 0.5, 0.42, 0.5], [0.55, 0.5, 0.42, 0], 0.5);
      return;
    }
    this.explosion(x, y, Math.max(0.35, Math.min(1.2, 0.35 + splash * 0.5)), -1);
  }

  /** Fireball, flash, sparks, smoke column, debris and a scorch mark. `size` ≈ 0.5 small .. 2 building. */
  private explosion(x: number, y: number, size: number, time: number): void {
    const water = this.terrain.isWater(x, y);
    const g = water ? -0.1 : Math.max(0, this.terrain.heightAt(x, y));
    this.add.emit(x, g + 0.3 * size, y, 0, 0, 0, 0.12, 1.4 * size, 2.6 * size, FLASH0, FLASH1);
    const n = Math.round(10 * size);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.6 + Math.random()) * size;
      this.add.emit(x, g + 0.15 * size, y, Math.cos(a) * v, (0.6 + Math.random() * 1.2) * size, Math.sin(a) * v, 0.35 + Math.random() * 0.3, 0.6 * size, 1.1 * size, FIRE0, FIRE1, 0.08);
    }
    for (let i = 0; i < n; i++)
      if (this.keep()) {
        const a = Math.random() * Math.PI * 2;
        this.add.emit(x, g + 0.2, y, Math.cos(a) * 4 * size, (2 + Math.random() * 3) * size, Math.sin(a) * 4 * size, 0.6 + Math.random() * 0.4, 0.07, 0.03, SPARK0, SPARK1, 0.6, 9);
      }
    const sn = Math.round(8 * size);
    for (let i = 0; i < sn; i++)
      if (this.keep()) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * 0.5 * size;
        const c = water ? [0.85, 0.9, 0.92, 0.7] : [0.2, 0.18, 0.16, 0.75];
        this.smoke.emit(x, g + 0.25 * size, y, Math.cos(a) * v, (0.4 + Math.random() * 0.6) * size, Math.sin(a) * v, 2.2 + Math.random() * 2, 0.7 * size, 2.4 * size, c, water ? [0.9, 0.92, 0.95, 0] : [0.35, 0.33, 0.31, 0], 0.55);
      }
    if (!water) {
      for (let i = 0; i < Math.round(6 * size); i++)
        if (this.keep()) {
          const a = Math.random() * Math.PI * 2;
          this.smoke.emit(x, g + 0.2, y, Math.cos(a) * 2.5 * size, (2.5 + Math.random() * 2) * size, Math.sin(a) * 2.5 * size, 1.1, 0.09, 0.07, [0.08, 0.07, 0.06, 1], [0.08, 0.07, 0.06, 0.8], 0.8, 9);
        }
      this.decal(x, y, g, 0.9 * size + 0.3);
    }
    this.flashLight(x, g + 0.8 * size, y, 4 * size, 0.35 + 0.2 * size);
    if (size >= 1.3) {
      this.hotspot = { x, y, t: time };
      this.shake = Math.min(1, this.shake + 0.25 * size);
    }
  }

  private decal(x: number, y: number, h: number, s: number): void {
    if (this.decalList.length >= 150) this.decalList.shift();
    this.decalList.push({ x, y, h: h + 0.015, s, r: Math.random() * 6.28, until: performance.now() / 1000 + 45 });
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number, alpha: number, time: number, camTarget: THREE.Vector3): void {
    // Projectiles: glowing slugs; rockets and missiles leave a smoke trail.
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    for (const p of this.world.projectiles) {
      if (n >= 512) break;
      const prev = this.projPrev.get(p.id) ?? { x: p.startX, y: p.startY };
      const x = prev.x + (p.x - prev.x) * alpha;
      const y = prev.y + (p.y - prev.y) * alpha;
      if (!this.visible(x, y)) continue;
      const total = Math.hypot(p.tx - p.startX, p.ty - p.startY) || 1;
      const t = Math.min(1, Math.hypot(x - p.startX, y - p.startY) / total);
      const src = this.entities.positions.get(p.sourceId);
      const h0 = (src?.h ?? this.terrain.heightAt(p.startX, p.startY)) + 0.35;
      const tgtEnt = p.targetId !== null ? this.entities.positions.get(p.targetId) : undefined;
      const h1 = (tgtEnt?.h ?? Math.max(0, this.terrain.heightAt(p.tx, p.ty))) + (p.air ? 0 : 0.25);
      const h = h0 + (h1 - h0) * t + 4 * p.apex * 0.5 * t * (1 - t);
      const dh = (h1 - h0) / total + 4 * p.apex * 0.5 * (1 - 2 * t) / total;
      const yaw = Math.atan2(p.ty - p.startY, p.tx - p.startX);
      const w = p.weapon.type;
      const len = w === 'bullet' ? 1.6 : w === 'artillery' || w === 'shell' ? 0.7 : 1;
      const thick = w === 'bullet' ? 0.6 : w === 'artillery' ? 1.6 : 1.2;
      e.set(0, -yaw, Math.atan(dh), 'YXZ');
      m.compose(v.set(x, h, y), q.setFromEuler(e), sc.set(len, thick, thick));
      this.proj.setMatrixAt(n, m);
      if (w === 'bullet') c.setRGB(6, 4.2, 1.6);
      else if (w === 'rocket' || w === 'missile') c.setRGB(8, 4, 1.2);
      else c.setRGB(4, 2.4, 1);
      this.proj.setColorAt(n, c);
      n++;
      if ((w === 'rocket' || w === 'missile') && this.keep())
        this.smoke.emit(x, h, y, (Math.random() - 0.5) * 0.1, 0.1, (Math.random() - 0.5) * 0.1, 1 + Math.random() * 0.6, 0.12, 0.55, [0.75, 0.73, 0.7, 0.5], [0.7, 0.7, 0.7, 0], 0.5);
      if (w === 'rocket' || w === 'missile') this.add.emit(x, h, y, 0, 0, 0, 0.05, 0.25, 0.1, FIRE0, FIRE1);
    }
    this.proj.count = n;
    this.proj.instanceMatrix.needsUpdate = true;
    if (this.proj.instanceColor) this.proj.instanceColor.needsUpdate = true;

    // Burning wrecks and damaged buildings smoke.
    for (const wk of this.entities.activeWrecks) {
      const left = wk.until - time;
      if (left > 2 && Math.random() < dt * 6 && this.visible(wk.x, wk.y)) {
        this.smoke.emit(wk.x, wk.h + 0.35, wk.y, 0.15, 0.35, 0.05, 2.5 + Math.random(), 0.25, 1.3, [0.12, 0.11, 0.1, 0.6], [0.3, 0.3, 0.3, 0], 0.85);
        if (left > 7 && Math.random() < 0.5) this.add.emit(wk.x, wk.h + 0.3, wk.y, 0, 0.5, 0, 0.35, 0.3, 0.1, FIRE0, FIRE1);
      }
    }
    for (const b of this.world.entities.values()) {
      if (b.kind !== 'building' || b.dead || !b.complete) continue;
      const pos = this.entities.positions.get(b.id);
      if (!pos) continue;
      const hurt = 1 - b.hp / b.maxHp;
      if (hurt > 0.4 && Math.random() < dt * 8 * hurt && this.visible(b.x, b.y)) {
        const x = b.x + (Math.random() - 0.5) * b.w * 0.6;
        const y = b.y + (Math.random() - 0.5) * b.h * 0.6;
        this.smoke.emit(x, pos.h + 0.9, y, 0.1, 0.4, 0, 3, 0.35, 1.6, [0.1, 0.09, 0.08, 0.65], [0.3, 0.3, 0.3, 0], 0.85);
        if (hurt > 0.65) this.add.emit(x, pos.h + 0.7, y, 0, 0.6, 0, 0.4, 0.45, 0.15, FIRE0, FIRE1);
      }
      // Power plant cooling towers steam.
      if (b.type === 'power-plant' && Math.random() < dt * 3 && this.visible(b.x, b.y)) {
        const yawOff = 0.25;
        for (const z of [-0.42, 0.42])
          this.smoke.emit(b.x + yawOff, pos.h + 1.0, b.y + z, 0.12, 0.45, 0.04, 4, 0.4, 1.6, [0.95, 0.95, 0.95, 0.35], [0.9, 0.9, 0.92, 0], 0.9);
      }
    }

    this.add.update(dt);
    this.smoke.update(dt);

    for (const l of this.lights) {
      if (l.life > 0) l.life -= dt;
      const k = Math.max(0, l.life / l.max);
      l.light.intensity = l.power * k * k * 6;
    }

    // Scorch decals shrink away at the end of their life.
    const now = performance.now() / 1000;
    this.decalList = this.decalList.filter((d) => d.until > now);
    this.decalList.forEach((d, i) => {
      const k = Math.min(1, (d.until - now) / 3);
      m.compose(v.set(d.x, d.h, d.y), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.r), sc.set(d.s * k, 1, d.s * k));
      this.decals.setMatrixAt(i, m);
    });
    this.decals.count = this.decalList.length;
    this.decals.instanceMatrix.needsUpdate = true;

    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.updateWeather(dt, camTarget);
  }

  // ------------------------------------------------------------------ weather
  setWeather(kind: Weather): void {
    if (this.weather) {
      this.group.remove(this.weather);
      this.weather.geometry.dispose();
    }
    this.weather = null;
    this.weatherKind = kind;
    if (kind === 'clear') return;
    const N = kind === 'rain' ? 3500 : kind === 'snow' ? 3000 : 2500;
    if (kind === 'rain') {
      const pos = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) {
        const x = (Math.random() - 0.5) * 40;
        const y = Math.random() * 14;
        const z = (Math.random() - 0.5) * 40;
        pos.set([x, y, z, x + 0.05, y + 0.45, z + 0.03], i * 6);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.weather = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35, depthWrite: false }),
      );
    } else {
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 40, Math.random() * 14, (Math.random() - 0.5) * 40], i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      this.weather = new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: kind === 'snow' ? 0xffffff : 0xc9a66b,
          size: kind === 'snow' ? 0.09 : 0.06,
          map: blobTexture(1.5, false),
          transparent: true,
          opacity: kind === 'snow' ? 0.9 : 0.55,
          depthWrite: false,
        }),
      );
    }
    this.weatherVel = new Float32Array(N);
    for (let i = 0; i < N; i++) this.weatherVel[i] = 0.8 + Math.random() * 0.4;
    this.weather.frustumCulled = false;
    this.group.add(this.weather);
  }

  private updateWeather(dt: number, c: THREE.Vector3): void {
    if (!this.weather) return;
    this.weather.position.set(c.x, 0, c.z);
    const attr = this.weather.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = attr.array as Float32Array;
    const kind = this.weatherKind;
    const N = this.weatherVel.length;
    const t = performance.now() / 1000;
    if (kind === 'rain') {
      for (let i = 0; i < N; i++) {
        const fall = 16 * this.weatherVel[i] * dt;
        a[i * 6 + 1] -= fall;
        a[i * 6 + 4] -= fall;
        a[i * 6] -= fall * 0.1;
        a[i * 6 + 3] -= fall * 0.1;
        if (a[i * 6 + 1] < 0) {
          const x = (Math.random() - 0.5) * 40;
          const z = (Math.random() - 0.5) * 40;
          a.set([x, 14, z, x + 0.05, 14.45, z + 0.03], i * 6);
        }
      }
    } else {
      const speed = kind === 'snow' ? 0.9 : 0.5;
      const wind = kind === 'sandstorm' ? 7 : 0.4;
      for (let i = 0; i < N; i++) {
        a[i * 3 + 1] -= speed * this.weatherVel[i] * dt;
        a[i * 3] += (wind + Math.sin(t + i) * 0.4) * dt;
        a[i * 3 + 2] += Math.cos(t * 0.7 + i) * 0.3 * dt;
        if (a[i * 3 + 1] < 0 || a[i * 3] > 20) {
          a[i * 3] = kind === 'sandstorm' ? -20 + Math.random() * 6 : (Math.random() - 0.5) * 40;
          a[i * 3 + 1] = kind === 'sandstorm' ? Math.random() * 6 : 14;
          a[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
      }
    }
    attr.needsUpdate = true;
  }
}
