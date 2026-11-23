import * as THREE from 'three';
import type { Building, Entity, Unit, World } from '@shadow-front/game-core';
import type { FactionId, UnitTypeId } from '@shadow-front/shared-types';
import { buildingModel, unitModel, type Model, type ModelPart } from './models';
import type { FogOfWarLayer } from './fow';
import { WATER_Y, type Terrain } from './terrain';

/** Flight altitude (tiles) of air units. */
const ALTITUDE: Partial<Record<UnitTypeId, number>> = {
  'attack-helicopter': 2.2,
  gunship: 2.5,
  'transport-helicopter': 2.3,
  'recon-drone': 3.0,
  'fighter-jet': 3.8,
  bomber: 3.5,
};

/** Faction camouflage (multiplied into `paint` parts). */
const CAMO: Record<FactionId, number> = {
  western: 0x6b7346,
  eastern: 0x55634f,
  pacific: 0x5f6f78,
  desert: 0xb39a6a,
  iron: 0x5b5d60,
};
const BUILDING_PAINT: Record<FactionId, number> = {
  western: 0xa8aa94,
  eastern: 0x98a094,
  pacific: 0x9ea8ae,
  desert: 0xcbb994,
  iron: 0x8e9094,
};

export interface EntityPos {
  x: number;
  y: number;
  /** World Y (height). */
  h: number;
}

const WHITE = new THREE.Color(1, 1, 1);
const WRECK = new THREE.Color(0.13, 0.12, 0.11);
const _m = new THREE.Matrix4();
const _p = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);

class PartBatch {
  mesh: THREE.InstancedMesh;
  count = 0;

  constructor(
    readonly part: ModelPart,
    private readonly material: THREE.Material,
    private readonly parent: THREE.Object3D,
    private capacity = 16,
    shadows = true,
  ) {
    this.mesh = this.make(shadows);
  }

  private make(shadows: boolean): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(this.part.geometry, this.material, this.capacity);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.setColorAt(0, WHITE);
    im.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.castShadow = shadows && this.part.tint !== 'glow';
    im.receiveShadow = this.part.tint !== 'glow';
    im.count = 0;
    this.parent.add(im);
    return im;
  }

  push(matrix: THREE.Matrix4, color: THREE.Color): void {
    if (this.count >= this.capacity) {
      const old = this.mesh;
      this.capacity *= 2;
      this.mesh = this.make(old.castShadow || old.receiveShadow);
      this.mesh.instanceMatrix.array.set(old.instanceMatrix.array);
      this.mesh.instanceColor!.array.set(old.instanceColor!.array);
      this.parent.remove(old);
      old.dispose();
    }
    this.mesh.setMatrixAt(this.count, matrix);
    this.mesh.setColorAt(this.count, color);
    this.count++;
  }

  end(): void {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.count = 0;
  }
}

class ModelBatch {
  readonly parts: PartBatch[];
  constructor(model: Model, mats: Record<ModelPart['tint'], THREE.Material>, parent: THREE.Object3D) {
    this.parts = model.parts.map((p) => new PartBatch(p, mats[p.tint], parent));
  }

  /**
   * `base` places the model; turret parts turn by `turret` (relative yaw), rotors by `rotor`.
   * `colors` = paint / team / fixed colour (wrecks pass dark colours).
   */
  push(base: THREE.Matrix4, turret: number, rotor: number, paint: THREE.Color, team: THREE.Color, fixed: THREE.Color, glow: THREE.Color): void {
    for (const pb of this.parts) {
      const p = pb.part;
      let m = base;
      if (p.pivot !== 'hull') {
        const a = p.pivot === 'turret' ? turret : p.pivot === 'spin' ? rotor * 0.08 : p.pivot === 'rotor2' ? -rotor : rotor;
        _q.setFromAxisAngle(Y, a);
        _p.compose(p.origin, _q, _s);
        m = _m.multiplyMatrices(base, _p);
      }
      pb.push(m, p.tint === 'paint' ? paint : p.tint === 'team' ? team : p.tint === 'glow' ? glow : fixed);
    }
  }

  end(): void {
    for (const p of this.parts) p.end();
  }
}

interface Wreck {
  type: UnitTypeId;
  x: number;
  h: number;
  y: number;
  yaw: number;
  turret: number;
  until: number;
  tilt: number;
}

/** Draws units, buildings, wrecks, team rings and health bars. */
export class EntityRenderer {
  readonly group = new THREE.Group();
  private batches = new Map<string, ModelBatch>();
  private readonly mats: Record<ModelPart['tint'], THREE.Material>;
  private rings: PartBatch;
  private barBg: PartBatch;
  private barFg: PartBatch;
  private wrecks: Wreck[] = [];
  private teamColors: THREE.Color[] = [];
  private paints: THREE.Color[] = [];
  private bPaints: THREE.Color[] = [];
  readonly glow = new THREE.Color(1, 1, 1);
  /** Ground units hidden by the fog are skipped when fog is on. */
  viewTeam = 0;
  /** Positions of entities drawn this frame (effects use them for muzzle flashes). */
  readonly positions = new Map<number, EntityPos>();

  constructor(
    private readonly world: World,
    private readonly terrain: Terrain,
    private readonly fow: FogOfWarLayer,
  ) {
    const lit = (o: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardMaterial(o);
      fow.patch(m);
      return m;
    };
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    fow.patch(glowMat);
    this.mats = {
      paint: lit({ vertexColors: true, roughness: 0.72, metalness: 0.15, flatShading: true }),
      team: lit({ vertexColors: true, roughness: 0.55, metalness: 0.1, flatShading: true }),
      fixed: lit({ vertexColors: true, roughness: 0.6, metalness: 0.35, flatShading: true }),
      glow: glowMat,
    };
    for (const p of world.players) {
      this.teamColors[p.id] = new THREE.Color(p.color);
      this.paints[p.id] = new THREE.Color(CAMO[p.faction] ?? CAMO.western);
      this.bPaints[p.id] = new THREE.Color(BUILDING_PAINT[p.faction] ?? BUILDING_PAINT.western);
    }
    // Team ring under units: flat ring, unlit, drawn over the ground.
    const ringGeo = new THREE.RingGeometry(0.82, 1, 24).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });
    fow.patch(ringMat);
    this.rings = new PartBatch({ pivot: 'hull', tint: 'team', origin: new THREE.Vector3(), geometry: ringGeo }, ringMat, this.group, 64, false);
    this.rings.mesh.receiveShadow = false;
    this.rings.mesh.renderOrder = 2;
    const barGeo = new THREE.PlaneGeometry(1, 1);
    const barMat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, toneMapped: false });
    this.barBg = new PartBatch({ pivot: 'hull', tint: 'fixed', origin: new THREE.Vector3(), geometry: barGeo }, barMat, this.group, 32, false);
    this.barFg = new PartBatch({ pivot: 'hull', tint: 'fixed', origin: new THREE.Vector3(), geometry: barGeo }, barMat, this.group, 32, false);
    this.barBg.mesh.receiveShadow = this.barFg.mesh.receiveShadow = false;
    this.barBg.mesh.renderOrder = 10;
    this.barFg.mesh.renderOrder = 11;
  }

  private batch(key: string, model: () => Model): ModelBatch {
    let b = this.batches.get(key);
    if (!b) {
      b = new ModelBatch(model(), this.mats, this.group);
      this.batches.set(key, b);
    }
    return b;
  }

  /** Units drawn recently (destroyed units are already gone from the world when the event arrives). */
  private readonly lastUnits = new Map<number, Unit>();

  addWreck(id: number, time: number): void {
    const u = this.lastUnits.get(id);
    this.lastUnits.delete(id);
    if (!u || u.air || u.def.category === 'infantry' || u.naval) return;
    const p = this.positions.get(u.id);
    this.wrecks.push({
      type: u.type,
      x: u.x,
      y: u.y,
      h: p?.h ?? this.terrain.heightAt(u.x, u.y),
      yaw: u.facing,
      turret: u.turretFacing - u.facing + 0.6,
      until: time + 14,
      tilt: (Math.random() - 0.5) * 0.25,
    });
    if (this.wrecks.length > 80) this.wrecks.shift();
  }

  get activeWrecks(): readonly Wreck[] {
    return this.wrecks;
  }

  altitude(u: Unit): number {
    return u.air ? (ALTITUDE[u.type] ?? 2.5) : 0;
  }

  update(alpha: number, time: number, camera: THREE.Camera): void {
    const w = this.world;
    const fogOn = this.fow.enabled;
    this.positions.clear();
    if (this.lastUnits.size > 4000) this.lastUnits.clear();
    let nRing = 0;
    const barQ = camera.quaternion;
    for (const e of w.entities.values()) {
      if (e.dead) continue;
      const visible = !fogOn || e.team === this.viewTeam || this.isVisible(e);
      if (e.kind === 'unit') {
        const u = e;
        const x = u.prevX + (u.x - u.prevX) * alpha;
        const y = u.prevY + (u.y - u.prevY) * alpha;
        let h: number;
        let pitch = 0;
        let roll = 0;
        const moving = u.x !== u.prevX || u.y !== u.prevY;
        if (u.air) {
          h = Math.max(0, this.terrain.heightAt(x, y)) + this.altitude(u) + Math.sin(time * 1.7 + u.id) * 0.06;
          if (u.def.category === 'air' && moving && u.type !== 'fighter-jet' && u.type !== 'bomber') pitch = -0.18;
          if (u.type === 'fighter-jet' || u.type === 'bomber') roll = Math.sin(time * 0.8 + u.id) * 0.12;
        } else if (u.naval) {
          h = WATER_Y + (u.def.submarine ? -0.08 : 0.02) + Math.sin(time * 1.4 + u.id * 1.3) * 0.02;
          roll = Math.sin(time * 1.1 + u.id) * 0.04;
        } else {
          h = this.terrain.heightAt(x, y);
          // Tilt with the slope.
          const ahead = this.terrain.heightAt(x + Math.cos(u.facing) * 0.4, y + Math.sin(u.facing) * 0.4);
          pitch = Math.atan2(ahead - h, 0.4);
          if (u.def.category === 'infantry' && moving) h += Math.abs(Math.sin(time * 9 + u.id)) * 0.025;
        }
        this.positions.set(u.id, { x, y, h });
        this.lastUnits.set(u.id, u);
        if (!visible) continue;
        _q.setFromEuler(new THREE.Euler(roll, -u.facing, pitch, 'YXZ'));
        _m.compose(_v.set(x, h, y), _q, _s);
        const rotor = time * (u.def.category === 'air' ? 28 : 1);
        const glow = this.glow;
        this.batch(`u:${u.type}`, () => unitModel(u.type)).push(
          _m.clone(),
          -(u.turretFacing - u.facing),
          rotor,
          this.paints[u.owner],
          this.teamColors[u.owner],
          WHITE,
          glow,
        );
        const r = unitModel(u.type).radius;
        const gh = u.air ? Math.max(this.terrain.heightAt(x, y), u.naval ? WATER_Y : 0) : u.naval ? WATER_Y : h;
        this.rings.push(_m.compose(_v.set(x, gh + 0.03, y), _q.identity(), _s.set(r, 1, r)), this.teamColors[u.owner]);
        _s.set(1, 1, 1);
        nRing++;
        if (u.hp < u.maxHp) this.bar(x, h + (u.air ? 0.5 : u.def.category === 'infantry' ? 0.6 : 0.75), y, Math.max(0.4, r * 1.6), u.hp / u.maxHp, barQ);
      } else {
        const b = e as Building;
        const h = this.terrain.heightAt(b.x, b.y);
        this.positions.set(b.id, { x: b.x, y: b.y, h });
        if (fogOn && b.team !== this.viewTeam && !this.explored(b)) continue;
        const square = b.w === b.h;
        const yaw = square ? [Math.PI / 2, 0, -Math.PI / 2, Math.PI][b.facing] ?? 0 : b.facing >= 2 ? Math.PI : 0;
        const grow = b.complete ? 1 : Math.max(0.08, b.progress);
        _q.setFromAxisAngle(Y, -yaw);
        _m.compose(_v.set(b.x, h, b.y), _q, _s.set(1, grow, 1));
        _s.set(1, 1, 1);
        this.batch(`b:${b.type}`, () => buildingModel(b.type)).push(
          _m.clone(),
          -(b.turretFacing - yaw),
          b.complete ? time * 3 : 0,
          this.bPaints[b.owner],
          // Construction sites are bare concrete: no team markings yet.
          b.complete ? this.teamColors[b.owner] : this.bPaints[b.owner],
          WHITE,
          b.complete ? this.glow : WRECK,
        );
        if (b.hp < b.maxHp && b.complete && visible)
          this.bar(b.x, h + 1.6, b.y, Math.min(2, b.w * 0.6), b.hp / b.maxHp, barQ);
      }
    }
    // Wrecks: burnt-out hulls that sink into the ground before they disappear.
    this.wrecks = this.wrecks.filter((wk) => wk.until > time);
    for (const wk of this.wrecks) {
      const sink = Math.max(0, 2 - (wk.until - time)) * 0.12;
      _q.setFromEuler(new THREE.Euler(wk.tilt, -wk.yaw, wk.tilt * 0.5, 'YXZ'));
      _m.compose(_v.set(wk.x, wk.h - sink, wk.y), _q, _s);
      this.batch(`u:${wk.type}`, () => unitModel(wk.type)).push(_m.clone(), wk.turret, 0, WRECK, WRECK, WRECK, WRECK);
    }
    for (const b of this.batches.values()) b.end();
    this.rings.end();
    this.barBg.end();
    this.barFg.end();
    void nRing;
  }

  private bar(x: number, h: number, y: number, w: number, frac: number, q: THREE.Quaternion): void {
    const bg = _c.setRGB(0.02, 0.02, 0.02);
    this.barBg.push(_m.compose(_v.set(x, h, y), q, _s.set(w + 0.04, 0.09, 1)), bg);
    _c.setRGB(frac < 0.5 ? 1 : 2 * (1 - frac), frac < 0.5 ? frac * 2 : 1, 0.15).multiplyScalar(0.9);
    // Left-anchored fill: shift along the camera's right vector.
    const right = _v.set(1, 0, 0).applyQuaternion(q).multiplyScalar(-(w * (1 - frac)) / 2);
    this.barFg.push(_m.compose(right.add(new THREE.Vector3(x, h, y)), q, _s.set(w * frac, 0.06, 1)), _c);
    _s.set(1, 1, 1);
  }

  private isVisible(e: Entity): boolean {
    return this.world.fog.isVisible(this.viewTeam, e.x, e.y);
  }

  private explored(b: Building): boolean {
    return this.world.fog.isExplored(this.viewTeam, Math.floor(b.x), Math.floor(b.y));
  }

  /** Number of draw calls used by entity batches (for the stats panel). */
  get batchCount(): number {
    let n = 0;
    for (const b of this.batches.values()) n += b.parts.filter((p) => p.mesh.count > 0).length;
    return n;
  }
}
