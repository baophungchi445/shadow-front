import type Phaser from 'phaser';
import { worldToScreen, type Building, type Unit } from '@shadow-front/game-core';
import { AIR_ALTITUDE, drawBuilding, drawTurretHead, drawUnitBody, drawUnitTop, hasTop } from './shapes';
import { cachedTexture, dirAngle, dirIndex } from './texcache';

/** Unit texture frame: ground point at (UX, UY) inside a UW×UH texture (room for aircraft altitude). */
const UW = 128;
const UH = 128;
const UX = 64;
const UY = 92;
const VEHICLE_DIRS = 32;
const INFANTRY_DIRS = 16;
const ROTOR_FRAMES = 6;

/** Visual for one unit: a cached body sprite plus an optional cached turret / rotor sprite. */
export class UnitView {
  private readonly body: Phaser.GameObjects.Image;
  private readonly top: Phaser.GameObjects.Image | null;
  private readonly infantry: boolean;
  /** Screen position (ground point) used for picking and overlays. */
  sx = 0;
  sy = 0;
  readonly altitude: number;
  /** Model used for rendering (faction units reuse a base model). */
  readonly look: Unit['type'];
  visible = true;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly unit: Unit,
    readonly color: number,
  ) {
    this.look = unit.def.look ?? unit.type;
    this.altitude = AIR_ALTITUDE[this.look] ?? 0;
    this.infantry = unit.def.category === 'infantry';
    this.body = scene.add.image(0, 0, this.bodyKey(0)).setOrigin(UX / UW, UY / UH);
    this.top = hasTop(this.look) ? scene.add.image(0, 0, this.topKey(0)).setOrigin(UX / UW, UY / UH) : null;
  }

  private bodyKey(dir: number): string {
    const type = this.look;
    const steps = this.infantry ? INFANTRY_DIRS : VEHICLE_DIRS;
    return cachedTexture(this.scene, `ub:${type}:${this.color}:${dir}`, UW, UH, UX, UY, (g) =>
      drawUnitBody(g, type, this.color, dirAngle(dir, steps)),
    );
  }

  private topKey(frame: number): string {
    const type = this.look;
    const rotor = type === 'attack-helicopter';
    const angle = rotor ? (frame * Math.PI) / ROTOR_FRAMES : dirAngle(frame, VEHICLE_DIRS);
    return cachedTexture(this.scene, `ut:${type}:${this.color}:${frame}`, UW, UH, UX, UY, (g) =>
      drawUnitTop(g, type, this.color, angle),
    );
  }

  sync(alpha: number, tick: number, visible: boolean): void {
    const u = this.unit;
    const x = u.prevX + (u.x - u.prevX) * alpha;
    const y = u.prevY + (u.y - u.prevY) * alpha;
    const p = worldToScreen(x, y);
    this.sx = p.x;
    this.sy = p.y;
    this.visible = visible;
    this.body.setVisible(visible);
    this.top?.setVisible(visible);
    if (!visible) return;

    const depth = p.y + (u.air ? 10000 : 0);
    // Infantry: one sprite facing where it aims (or walks), with a walking bob.
    const facing = this.infantry ? u.turretFacing : u.facing;
    const bodyDir = dirIndex(facing, this.infantry ? INFANTRY_DIRS : VEHICLE_DIRS);
    const bob = this.infantry && u.moving ? Math.abs(Math.sin(tick * 0.4)) * 1.5 : 0;
    this.body
      .setTexture(this.bodyKey(bodyDir))
      .setPosition(p.x, p.y - bob)
      .setDepth(depth);

    if (this.top) {
      if (this.look === 'attack-helicopter') {
        this.top.setTexture(this.topKey(tick % ROTOR_FRAMES)).setPosition(p.x, p.y);
      } else {
        // Recoil: kick the turret sprite back along the barrel for a few ticks after firing.
        const recoil = Math.max(0, 1 - (tick - u.lastFiredTick) / 6);
        const back = worldToScreen(
          Math.cos(u.turretFacing) * recoil * 0.06,
          Math.sin(u.turretFacing) * recoil * 0.06,
        );
        this.top
          .setTexture(this.topKey(dirIndex(u.turretFacing, VEHICLE_DIRS)))
          .setPosition(p.x - back.x, p.y - back.y);
      }
      this.top.setDepth(depth + 0.01);
    }
  }

  /** Screen-space muzzle position (for flashes). */
  muzzle(): { x: number; y: number } {
    const u = this.unit;
    const d = worldToScreen(Math.cos(u.turretFacing) * 0.5, Math.sin(u.turretFacing) * 0.5);
    const z = this.infantry ? 11 : this.altitude ? this.altitude : 12;
    return { x: this.sx + d.x, y: this.sy + d.y - z };
  }

  destroy(): void {
    this.body.destroy();
    this.top?.destroy();
  }
}

const ANIM_FRAMES = 12;
const TURRET_DIRS = 32;

/** Visual for one building: cached body sprite (construction steps / animation frames) + turret head. */
export class BuildingView {
  readonly body: Phaser.GameObjects.Image;
  readonly head: Phaser.GameObjects.Image | null;
  /** Has the local team ever seen this building (enemy ghosts remain in explored fog). */
  seen = false;
  readonly sx: number;
  readonly sy: number;
  private readonly animated: boolean;
  private readonly fw: number;
  private readonly fh: number;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly building: Building,
    readonly color: number,
  ) {
    const p = worldToScreen(building.x, building.y);
    this.sx = p.x;
    this.sy = p.y;
    const { w, h, height } = building.def;
    this.fw = (w + h) * 32 + 32;
    const above = (w + h) * 8 + height + 64;
    const below = (w + h) * 8 + 10;
    this.fh = above + below;
    this.ox = this.fw / 2;
    this.oy = above;
    this.animated = ['headquarters', 'power-plant', 'resource-extractor', 'radar-station'].includes(
      building.type,
    );
    this.body = scene.add
      .image(p.x, p.y, this.bodyKey(building.complete ? 'c0' : 'p0'))
      .setOrigin(this.ox / this.fw, this.oy / this.fh)
      .setDepth(p.y);
    this.head = building.def.weapon
      ? scene.add
          .image(p.x, p.y, this.headKey(0))
          .setOrigin(this.ox / this.fw, this.oy / this.fh)
          .setDepth(p.y + 0.5)
      : null;
  }

  /** state: `p<step>` (construction 0..10) or `c<frame>` (complete, animation frame). */
  private bodyKey(state: string): string {
    const b = this.building;
    const step = state[0] === 'p' ? Number(state.slice(1)) : -1;
    const frame = state[0] === 'c' ? Number(state.slice(1)) : 0;
    return cachedTexture(
      this.scene,
      `bb:${b.type}:${this.color}:${state}`,
      this.fw,
      this.fh,
      this.ox,
      this.oy,
      (g) => drawBuilding(g, b.type, this.color, step >= 0 ? step / 10 : 1, frame / ANIM_FRAMES),
    );
  }

  private headKey(dir: number): string {
    const b = this.building;
    return cachedTexture(
      this.scene,
      `bh:${b.type}:${this.color}:${dir}`,
      this.fw,
      this.fh,
      this.ox,
      this.oy,
      (g) => drawTurretHead(g, b.type, this.color, dirAngle(dir, TURRET_DIRS), 0),
    );
  }

  get visible(): boolean {
    return this.body.visible;
  }

  sync(tick: number, visible: boolean, ghost: boolean): void {
    const b = this.building;
    const show = visible || ghost;
    this.body.setVisible(show);
    this.head?.setVisible(show && b.complete);
    if (!show) return;
    this.body.setAlpha(ghost && !visible ? 0.65 : 1);
    this.head?.setAlpha(ghost && !visible ? 0.65 : 1);
    if (ghost && !visible) return; // Frozen last-seen state.
    const state = b.complete
      ? `c${this.animated ? Math.floor(tick / 4) % ANIM_FRAMES : 0}`
      : `p${Math.min(9, Math.floor(b.progress * 10))}`;
    this.body.setTexture(this.bodyKey(state));
    if (this.head && b.complete) {
      const recoil = Math.max(0, 1 - (tick - b.lastFiredTick) / 6);
      const back = worldToScreen(
        Math.cos(b.turretFacing) * recoil * 0.06,
        Math.sin(b.turretFacing) * recoil * 0.06,
      );
      this.head
        .setTexture(this.headKey(dirIndex(b.turretFacing, TURRET_DIRS)))
        .setPosition(this.sx - back.x, this.sy - back.y);
    }
  }

  muzzle(): { x: number; y: number } {
    const b = this.building;
    const d = worldToScreen(Math.cos(b.turretFacing) * 0.6, Math.sin(b.turretFacing) * 0.6);
    return { x: this.sx + d.x, y: this.sy + d.y - 17 };
  }

  destroy(): void {
    this.body.destroy();
    this.head?.destroy();
  }
}
