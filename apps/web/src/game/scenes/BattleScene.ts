import Phaser from 'phaser';
import type { BuildingTypeId, EntityId, UnitTypeId } from '@shadow-front/shared-types';
import { BALANCE, BUILDINGS, RESEARCH, UNITS } from '@shadow-front/game-data';
import { actionFor, type HotkeyAction } from '../keybinds';
import { frontOf, mapScreenBounds, screenToWorld, worldToScreen, type Entity } from '@shadow-front/game-core';
import type { GameController } from '../GameController';
import { buildTerrain, type TerrainLayer } from '../render/terrain';
import { FogLayer } from '../render/fog';
import { Effects } from '../render/effects';
import { BuildingView, UnitView } from '../render/views';
import { drawBuilding } from '../render/shapes';
import { footprint } from '../render/draw';
import { QUALITY, type GraphicsQuality } from '../render/quality';
import { WeatherLayer } from '../render/weather';

export interface SceneSettings {
  edgeScroll: boolean;
  scrollSpeed: number;
  keybinds: Record<HotkeyAction, string>;
  graphicsQuality: GraphicsQuality;
  zoomSpeed: number;
  panSensitivity: number;
}

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
const DRAG_THRESHOLD = 6;

/**
 * Renders the World and converts player input into controller commands.
 * Holds no gameplay rules: everything goes through GameController → World.issue().
 */
export class BattleScene extends Phaser.Scene {
  private ctrl!: GameController;
  private settings!: SceneSettings;
  private terrain!: TerrainLayer;
  private fog!: FogLayer;
  private fx!: Effects;
  private ground!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private smokeLayer!: Phaser.GameObjects.Graphics;
  private weather!: WeatherLayer;
  private pointViews: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; key: string }[] = [];
  /** Capture the Flag: one graphics object per flag (stand + flag). */
  private flagViews: Phaser.GameObjects.Graphics[] = [];
  private projectiles!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private unitViews = new Map<EntityId, UnitView>();
  private buildingViews = new Map<EntityId, BuildingView>();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private panDrag: { x: number; y: number } | null = null;
  /** Edge scrolling only after the pointer has actually entered the canvas. */
  private pointerInside = false;
  private lastClick = { time: 0, id: -1 };
  private lastGroupKey = { n: -1, time: 0 };
  private alpha = 0;
  private hoverEnemy = false;
  private lastFrameTime = 0;
  private frame = 0;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super('battle');
  }

  create(): void {
    this.ctrl = this.registry.get('controller') as GameController;
    this.settings = this.registry.get('settings') as SceneSettings;
    const world = this.ctrl.world;

    this.cameras.main.setBackgroundColor('#0b0e11');
    this.terrain = buildTerrain(this, world);
    this.ground = this.add.graphics().setDepth(-5000);
    this.ghost = this.add.graphics().setDepth(25000).setAlpha(0.7);
    this.projectiles = this.add.graphics().setDepth(19000);
    this.overlay = this.add.graphics().setDepth(40000);
    this.smokeLayer = this.add.graphics().setDepth(30000);
    this.fx = new Effects(this);
    this.fog = new FogLayer(this, world, this.ctrl.team);
    this.weather = new WeatherLayer(this, world);
    for (const pt of world.points) {
      const s = worldToScreen(pt.x, pt.y);
      const g = this.add.graphics({ x: s.x, y: s.y }).setDepth(s.y);
      const label = this.add
        .text(s.x, s.y + 30, pt.name.toUpperCase(), {
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#e8ecef',
          stroke: '#0b0e11',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(-4500);
      this.pointViews.push({ g, label, key: '' });
    }

    for (let i = 0; i < world.flags.length; i++) this.flagViews.push(this.add.graphics());

    const b = mapScreenBounds(world.map.width, world.map.height);
    this.cameras.main.setBounds(b.x - 240, b.y - 160, b.w + 480, b.h + 420);
    this.cameras.main.setZoom(1.25);

    this.setupInput();
    this.unsubscribe.push(
      this.ctrl.events.on('centerCamera', ({ x, y }) => {
        const p = worldToScreen(x, y);
        this.cameras.main.centerOn(p.x, p.y);
      }),
    );
    this.ctrl.centerOnBase();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private cleanup(): void {
    this.unsubscribe.forEach((u) => u());
    this.unsubscribe = [];
    this.input.keyboard?.removeAllListeners();
    window.removeEventListener('keydown', this.onKeyDom);
    this.game.canvas?.removeEventListener('pointerleave', this.onLeave);
    this.game.canvas?.removeEventListener('pointerenter', this.onEnter);
  }

  private onKeyDom = (e: KeyboardEvent) => this.onKey(e);

  private onLeave = () => {
    this.pointerInside = false;
  };
  // Edge scrolling starts on the first pointer move inside the canvas: when the canvas appears under a still
  // mouse, `pointerenter` fires but Phaser still reports the pointer at (0, 0), which would scroll left.
  private onEnter = () => undefined;

  // ---------------------------------------------------------------- input

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>;
    this.game.canvas.addEventListener('pointerleave', this.onLeave);
    this.game.canvas.addEventListener('pointerenter', this.onEnter);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) =>
      this.onWheel(p, dy),
    );

    // Discrete hotkeys use a native listener: Phaser's keyboard queue can re-emit the same
    // keydown several times when focus is outside the canvas (e.g. right after clicking a HUD button).
    window.addEventListener('keydown', this.onKeyDom);
  }

  private worldAt(p: Phaser.Input.Pointer): { x: number; y: number } {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return screenToWorld(wp.x, wp.y);
  }

  private onKey(e: KeyboardEvent): void {
    const c = this.ctrl;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (e.repeat || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (this.ctrl.paused) return;
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const n = Number(digit[1]);
      if (e.ctrlKey) {
        e.preventDefault();
        c.setGroup(n);
      } else if (c.recallGroup(n)) {
        const now = this.time.now;
        if (this.lastGroupKey.n === n && now - this.lastGroupKey.time < 350) {
          const u = c.selectedOwnUnits()[0];
          if (u) c.centerOn(u.x, u.y);
        }
        this.lastGroupKey = { n, time: now };
      }
      return;
    }
    const action = actionFor(this.settings.keybinds, e.code);
    // While placing a building, the Retreat key (R) rotates it instead.
    if (c.placing && action === 'retreat') {
      c.rotatePlacement();
      return;
    }
    switch (action) {
      case 'attackMove':
        if (c.selectedOwnUnits().length) c.commandMode = 'attackMove';
        return;
      case 'patrol':
        if (c.selectedOwnUnits().length) c.commandMode = 'patrol';
        return;
      case 'unload':
        c.unloadSelected();
        c.deploySelected();
        return;
      case 'formation':
        c.nextFormation();
        return;
      case 'smoke':
        if (c.selectedOwnUnits().some((u) => u.def.smoke)) c.commandMode = 'smoke';
        return;
      case 'stop':
        c.stopSelected();
        return;
      case 'hold':
        c.holdSelected();
        return;
      case 'retreat':
        c.retreatSelected();
        return;
      case 'selectArmy':
        if (!e.ctrlKey && !e.shiftKey) c.selectAllArmy();
        return;
      case 'alert':
        e.preventDefault();
        c.jumpToAlertOrBase();
        return;
      default:
        break;
    }
    switch (e.code) {
      case 'Minus':
      case 'NumpadSubtract':
        c.stepSpeed(-1);
        break;
      case 'Equal':
      case 'NumpadAdd':
        c.stepSpeed(1);
        break;
      case 'Escape':
        if (c.placing) c.cancelPlacement();
        else if (c.commandMode !== 'none') c.commandMode = 'none';
        else c.setSelection([]);
        break;
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const c = this.ctrl;
    c.sfx.unlock();
    if (p.middleButtonDown()) {
      this.panDrag = { x: p.x, y: p.y };
      return;
    }
    if (p.rightButtonDown()) {
      if (c.placing) {
        c.cancelPlacement();
        return;
      }
      if (c.commandMode !== 'none') {
        c.commandMode = 'none';
        return;
      }
      this.issueContextCommand(p, false);
      return;
    }
    if (!p.leftButtonDown()) return;
    if (c.placing) {
      const tile = this.placementTile(p, c.placing);
      const shift = (p.event as MouseEvent).shiftKey;
      if (c.place(tile.tx, tile.ty, shift)) {
        const s = worldToScreen(tile.tx + BUILDINGS[c.placing ?? 'power-plant'].w / 2, tile.ty);
        this.fx.marker(s.x, s.y, 0x7fb24a);
      }
      return;
    }
    if (c.commandMode === 'attackMove') {
      this.issueContextCommand(p, true);
      c.commandMode = 'none';
      return;
    }
    if (c.commandMode === 'smoke') {
      const w = this.worldAt(p);
      c.smokeSelected(w.x, w.y);
      c.commandMode = 'none';
      return;
    }
    if (c.commandMode === 'patrol') {
      const w = this.worldAt(p);
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      if (c.patrolSelected(w.x, w.y)) this.fx.marker(wp.x, wp.y, 0x6fc3ff);
      c.commandMode = 'none';
      return;
    }
    this.dragStart = { x: p.x, y: p.y };
    this.dragging = false;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.pointerInside = true;
    if (this.panDrag) {
      const cam = this.cameras.main;
      const k = this.settings.panSensitivity / cam.zoom;
      cam.scrollX -= (p.x - this.panDrag.x) * k;
      cam.scrollY -= (p.y - this.panDrag.y) * k;
      this.panDrag = { x: p.x, y: p.y };
    }
    if (this.dragStart && !this.dragging) {
      if (Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > DRAG_THRESHOLD) this.dragging = true;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.panDrag && !p.middleButtonDown()) this.panDrag = null;
    if (!this.dragStart) return;
    const shift = (p.event as MouseEvent).shiftKey;
    if (this.dragging) this.boxSelect(this.dragStart, { x: p.x, y: p.y }, shift);
    else this.clickSelect(p, shift);
    this.dragStart = null;
    this.dragging = false;
  }

  private onWheel(p: Phaser.Input.Pointer, dy: number): void {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(p.x, p.y);
    const step = 0.1 * this.settings.zoomSpeed;
    const zoom = Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 1 - step : 1 + step), MIN_ZOOM, MAX_ZOOM);
    cam.setZoom(zoom);
    cam.preRender();
    const after = cam.getWorldPoint(p.x, p.y);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  /** Right-click (or attack-move click): attack a visible enemy, otherwise move. */
  private issueContextCommand(p: Phaser.Input.Pointer, attackMove: boolean): void {
    const c = this.ctrl;
    const target = this.pick(p);
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    if (
      target &&
      target.owner === c.humanId &&
      c.world.capacityOf(target) > 0 &&
      c.selectedOwnUnits().some((u) => u.def.category === 'infantry')
    ) {
      if (c.loadInto(target.id)) this.fx.marker(wp.x, wp.y, 0x6fc3ff);
      return;
    }
    if (
      target &&
      target.team !== c.team &&
      c.world.isVisibleTo(c.team, target) &&
      c.selectedOwnUnits().length
    ) {
      if (c.attackTarget(target.id)) this.fx.marker(wp.x, wp.y, 0xe04848);
      return;
    }
    const w = this.worldAt(p);
    if (w.x < 0 || w.y < 0 || w.x >= c.world.map.width || w.y >= c.world.map.height) return;
    if (c.moveSelected(w.x, w.y, attackMove)) this.fx.marker(wp.x, wp.y, attackMove ? 0xe98a2b : 0x7fb24a);
  }

  /** Entity under the pointer (units first, then buildings). Only returns entities the player can see. */
  private pick(p: Phaser.Input.Pointer): Entity | null {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const v of this.unitViews.values()) {
      if (!v.visible || v.unit.dead) continue;
      const cy = v.sy - v.altitude - (v.unit.def.category === 'infantry' ? 10 : 6);
      const d = Math.hypot(wp.x - v.sx, wp.y - cy);
      const r = 10 + v.unit.radius * 22;
      if (d < r && d < bestD) {
        bestD = d;
        best = v.unit;
      }
    }
    if (best) return best;
    for (const v of this.buildingViews.values()) {
      const b = v.building;
      if (b.dead || !v.body.visible) continue;
      const height = b.def.height + 4;
      for (let k = 0; k <= height; k += 4) {
        const w = screenToWorld(wp.x, wp.y + k);
        if (w.x >= b.tx && w.x < b.tx + b.w && w.y >= b.ty && w.y < b.ty + b.h) return b;
      }
    }
    return null;
  }

  private clickSelect(p: Phaser.Input.Pointer, shift: boolean): void {
    const c = this.ctrl;
    const e = this.pick(p);
    if (!e) {
      if (!shift) c.setSelection([]);
      return;
    }
    const now = this.time.now;
    if (
      e.kind === 'unit' &&
      e.owner === c.humanId &&
      this.lastClick.id === e.id &&
      now - this.lastClick.time < 320
    ) {
      // Double click: select all own units of this type on screen.
      const view = this.cameras.main.worldView;
      const ids = [...this.unitViews.values()]
        .filter(
          (v) =>
            v.unit.owner === c.humanId && v.unit.type === e.type && !v.unit.dead && view.contains(v.sx, v.sy),
        )
        .map((v) => v.unit.id);
      c.setSelection(ids, shift);
    } else if (shift && e.kind === 'unit' && e.owner === c.humanId) {
      c.toggleSelection(e.id);
    } else {
      c.setSelection([e.id]);
    }
    this.lastClick = { time: now, id: e.id };
  }

  private boxSelect(a: { x: number; y: number }, b: { x: number; y: number }, shift: boolean): void {
    const cam = this.cameras.main;
    const p1 = cam.getWorldPoint(Math.min(a.x, b.x), Math.min(a.y, b.y));
    const p2 = cam.getWorldPoint(Math.max(a.x, b.x), Math.max(a.y, b.y));
    const ids: number[] = [];
    for (const v of this.unitViews.values()) {
      const u = v.unit;
      if (u.dead || u.owner !== this.ctrl.humanId) continue;
      const y = v.sy - v.altitude - 6;
      if (v.sx >= p1.x && v.sx <= p2.x && y >= p1.y && y <= p2.y) ids.push(u.id);
    }
    if (ids.length || !shift) this.ctrl.setSelection(ids, shift);
  }

  private placementTile(p: Phaser.Input.Pointer, type: BuildingTypeId): { tx: number; ty: number } {
    const w = this.worldAt(p);
    const def = BUILDINGS[type];
    return { tx: Math.round(w.x - def.w / 2), ty: Math.round(w.y - def.h / 2) };
  }

  // ---------------------------------------------------------------- frame

  override update(): void {
    this.frame++;
    // Real wall-clock delta: Phaser's smoothed delta under-reports on slow machines,
    // which would make the fixed-step simulation run slower than real time.
    const now = performance.now();
    const delta = this.lastFrameTime ? now - this.lastFrameTime : 16;
    this.lastFrameTime = now;
    this.fx.quality = this.settings.graphicsQuality;
    this.alpha = this.ctrl.update(delta);
    this.updateCamera(delta);
    this.syncViews();
    this.consumeEvents();
    this.drawProjectiles();
    this.drawOverlays();
    this.drawPlacementGhost();
    this.drawControlPoints();
    this.drawFlags();
    this.fx.update();
    this.fog.update();
    this.weather.quality = this.settings.graphicsQuality;
    this.weather.update(delta);
    if (this.frame % 30 === 0) this.terrain.updateOre(this.ctrl.world);
    this.publishCameraView();
  }

  private updateCamera(delta: number): void {
    const cam = this.cameras.main;
    const speed = (0.9 * delta * this.settings.scrollSpeed) / cam.zoom;
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) dx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) dx += 1;
    if (k.W.isDown || k.UP.isDown) dy -= 1;
    if (k.S.isDown || k.DOWN.isDown) dy += 1;
    if (this.settings.edgeScroll && this.pointerInside && !this.panDrag && !this.dragStart) {
      const p = this.input.activePointer;
      const m = 14;
      if (p.x < m) dx -= 1;
      if (p.x > this.scale.width - m) dx += 1;
      if (p.y < m) dy -= 1;
      if (p.y > this.scale.height - m) dy += 1;
    }
    cam.scrollX += dx * speed;
    cam.scrollY += dy * speed;
  }

  private colorOf(owner: number): number {
    return this.ctrl.world.players[owner]?.color ?? 0xffffff;
  }

  private syncViews(): void {
    const world = this.ctrl.world;
    const team = this.ctrl.team;
    const tick = world.tick;
    for (const e of world.entities.values()) {
      if (e.dead) continue;
      if (e.kind === 'unit') {
        if (!this.unitViews.has(e.id)) this.unitViews.set(e.id, new UnitView(this, e, this.colorOf(e.owner)));
      } else if (!this.buildingViews.has(e.id)) {
        this.buildingViews.set(e.id, new BuildingView(this, e, this.colorOf(e.owner)));
      }
    }
    for (const [id, v] of this.unitViews) {
      if (v.unit.dead || !world.entities.has(id)) {
        v.destroy();
        this.unitViews.delete(id);
        continue;
      }
      v.sync(this.alpha, tick, world.isVisibleTo(team, v.unit));
      if (v.visible && v.unit.burn && this.frame % 4 === 0) this.fx.flames(v.sx, v.sy - 6 - v.altitude, 10);
    }
    for (const [id, v] of this.buildingViews) {
      const b = v.building;
      const visible = !b.dead && world.isVisibleTo(team, b);
      if (visible) v.seen = true;
      // Dead buildings: own/visible ones vanish now, enemy ghosts persist until the area is re-scouted.
      if (b.dead || !world.entities.has(id)) {
        const areaVisible = world.fog.isVisible(team, b.x, b.y) || b.team === team;
        if (!v.seen || areaVisible) {
          v.destroy();
          this.buildingViews.delete(id);
        }
        continue;
      }
      v.sync(tick, visible, v.seen);
      if (visible && b.burn && this.frame % 3 === 0)
        this.fx.flames(v.sx, v.sy - b.def.height * 0.6, b.w * 18);
      // Damaged buildings smoke.
      if (visible && b.complete && b.hp < b.maxHp * 0.5 && this.frame % 10 === 0)
        this.fx.smokePuff(v.sx, v.sy - b.def.height, b.hp < b.maxHp * 0.25);
    }
  }

  /** Distance attenuation relative to the camera centre (1 = on screen centre, 0 = far away). */
  private audibility(x: number, y: number): number {
    const cam = this.cameras.main;
    const s = worldToScreen(x, y);
    const d = Math.hypot(s.x - cam.midPoint.x, s.y - cam.midPoint.y) * cam.zoom;
    const r = Math.max(this.scale.width, this.scale.height) * 0.75;
    return Math.max(0, 1 - d / r);
  }

  private consumeEvents(): void {
    const world = this.ctrl.world;
    const team = this.ctrl.team;
    const sfx = this.ctrl.sfx;
    for (const e of this.ctrl.drainRenderEvents()) {
      switch (e.type) {
        case 'shot': {
          if (!world.fog.isVisible(team, e.x, e.y)) break;
          sfx.play(e.weapon, this.audibility(e.x, e.y));
          const uv = this.unitViews.get(e.from);
          const bv = this.buildingViews.get(e.from);
          const m = uv ? uv.muzzle() : bv ? bv.muzzle() : null;
          if (m) this.fx.muzzle(m.x, m.y, e.weapon !== 'bullet');
          break;
        }
        case 'hit': {
          if (!world.fog.isVisible(team, e.x, e.y)) break;
          const s = worldToScreen(e.x, e.y);
          this.fx.impact(s.x, s.y, e.weapon, e.splash);
          break;
        }
        case 'terrainDestroyed': {
          // The ground changes for everyone (it is terrain, not a unit); the dust is only shown where visible.
          this.terrain.destroyTile(e.tx, e.ty, e.kind);
          if (!world.fog.isVisible(team, e.tx + 0.5, e.ty + 0.5)) break;
          const s = worldToScreen(e.tx + 0.5, e.ty + 0.5);
          if (e.was === 'forest') this.fx.flames(s.x, s.y - 8, 14);
          for (let k = 0; k < 3; k++) this.fx.smokePuff(s.x + (k - 1) * 8, s.y - 10, e.was === 'forest');
          break;
        }
        case 'crit': {
          if (!world.fog.isVisible(team, e.x, e.y)) break;
          const s = worldToScreen(e.x, e.y);
          this.fx.marker(s.x, s.y - 8, 0xffe14a);
          break;
        }
        case 'smoke': {
          if (!world.fog.isVisible(team, e.x, e.y)) break;
          sfx.play('explosion', this.audibility(e.x, e.y) * 0.3);
          break;
        }
        case 'destroyed': {
          if (!world.fog.isVisible(team, e.x, e.y)) break;
          const s = worldToScreen(e.x, e.y);
          const air = this.unitViews.get(e.id)?.altitude ?? 0;
          this.fx.explosion(s.x, s.y - air, e.kind === 'building' ? 2 : e.big ? 1.1 : 0.45);
          sfx.play(
            e.kind === 'building' ? 'explosionBig' : 'explosion',
            this.audibility(e.x, e.y) * (e.big ? 1 : 0.5),
          );
          const scorch = QUALITY[this.settings.graphicsQuality].scorch;
          if (
            scorch === 'all'
              ? e.kind === 'building' || e.big
              : scorch === 'buildings' && e.kind === 'building'
          )
            this.terrain.scorch(e.x, e.y, e.kind === 'building' ? 46 : 18);
          break;
        }
      }
    }
  }

  private drawProjectiles(): void {
    const g = this.projectiles;
    g.clear();
    const world = this.ctrl.world;
    const team = this.ctrl.team;
    for (const p of world.projectiles) {
      const total = Math.hypot(p.tx - p.startX, p.ty - p.startY) || 1;
      const t = 1 - Math.min(1, Math.hypot(p.tx - p.x, p.ty - p.y) / total);
      // Ballistic shells: mark the landing zone (red = incoming enemy fire) so units can be moved out of it.
      if (p.weapon.type === 'artillery' && world.fog.isVisible(team, p.tx, p.ty)) {
        const m = worldToScreen(p.tx, p.ty);
        const r = Math.max(0.8, p.weapon.splash ?? 0.8) * 32;
        const enemy = p.team !== team;
        g.lineStyle(1.5, enemy ? 0xff4a3a : 0xffffff, (enemy ? 0.35 : 0.15) + 0.4 * t);
        g.strokeEllipse(m.x, m.y, r * (1.2 - 0.4 * t), r * 0.5 * (1.2 - 0.4 * t));
      }
      if (!world.fog.isVisible(team, p.x, p.y)) continue;
      const s = worldToScreen(p.x, p.y);
      let z = 12 + (p.air ? 28 * t : 0);
      // Parabolic arc (≈26 px of height per tile of apex); bombs fall from altitude.
      if (p.weapon.type === 'artillery')
        z = p.apex > 0 ? 14 + 4 * p.apex * t * (1 - t) * 26 : 14 + 34 * (1 - t);
      const dir = worldToScreen(p.tx - p.x, p.ty - p.y);
      const dl = Math.hypot(dir.x, dir.y) || 1;
      const ux = dir.x / dl;
      const uy = dir.y / dl;
      switch (p.weapon.type) {
        case 'bullet':
          g.lineStyle(1.5, 0xffe9a0, 0.95);
          g.lineBetween(s.x - ux * 9, s.y - z - uy * 9, s.x, s.y - z);
          break;
        case 'shell':
          g.lineStyle(2, 0xffb35a, 0.6);
          g.lineBetween(s.x - ux * 12, s.y - z - uy * 12, s.x, s.y - z);
          g.fillStyle(0xfff0c0, 1);
          g.fillRect(s.x - 1.5, s.y - z - 1.5, 3, 3);
          break;
        case 'rocket':
        case 'missile':
          if (this.frame % 2 === 0) this.fx.trail(s.x - ux * 4, s.y - z - uy * 4);
          g.fillStyle(0xdddddd, 1);
          g.fillRect(s.x - 1.5, s.y - z - 1.5, 3, 3);
          g.fillStyle(0xff7030, 1);
          g.fillRect(s.x - ux * 3 - 1.2, s.y - z - uy * 3 - 1.2, 2.4, 2.4);
          break;
        case 'artillery':
          if (this.frame % 3 === 0) this.fx.trail(s.x, s.y - z);
          g.fillStyle(0x2a2a2a, 1);
          g.fillRect(s.x - 2, s.y - z - 2, 4, 4);
          g.fillStyle(0x000000, 0.25);
          g.fillRect(s.x - 3, s.y - 1, 6, 2);
          break;
      }
    }
  }

  private drawOverlays(): void {
    const g = this.ground;
    const o = this.overlay;
    g.clear();
    o.clear();
    const c = this.ctrl;
    const world = c.world;

    // Smoke screens: soft layered grey ellipses that thin out as they expire.
    const sm = this.smokeLayer;
    sm.clear();
    for (const s of world.smokes) {
      if (!world.fog.isExplored(c.team, Math.floor(s.x), Math.floor(s.y))) continue;
      const fade = Math.min(1, (s.until - world.tick) / 80);
      const p = worldToScreen(s.x, s.y);
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + world.tick * 0.004;
        const r = s.radius * (k === 0 ? 0 : 0.45);
        const q = worldToScreen(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
        sm.fillStyle(k % 2 ? 0xb8b6b0 : 0x9a9892, 0.32 * fade);
        sm.fillEllipse(q.x, q.y - 14, s.radius * 52, s.radius * 30);
      }
      sm.fillStyle(0xd0cec8, 0.25 * fade);
      sm.fillEllipse(p.x, p.y - 20, s.radius * 70, s.radius * 38);
    }

    for (const id of c.selection) {
      const e = world.get(id);
      if (!e) continue;
      const own = e.owner === c.humanId;
      const col = own ? 0x9cf06a : e.team === c.team ? 0xf2d04a : 0xff5050;
      if (e.kind === 'unit') {
        const v = this.unitViews.get(id);
        if (!v || !v.visible) continue;
        const r = 12 + e.radius * 22;
        g.lineStyle(1.5, col, 0.95);
        g.strokeEllipse(v.sx, v.sy, r * 1.6, r * 0.8);
        // Path preview for own moving units.
        if (own && e.moving && e.pathIndex < e.path.length) {
          g.lineStyle(1, col, 0.3);
          let prev = { x: v.sx, y: v.sy };
          for (let i = e.pathIndex; i < e.path.length; i++) {
            const s = worldToScreen(e.path[i].x, e.path[i].y);
            g.lineBetween(prev.x, prev.y, s.x, s.y);
            prev = s;
          }
          g.fillStyle(col, 0.5);
          g.fillCircle(prev.x, prev.y, 2.5);
        }
      } else {
        const v = this.buildingViews.get(id);
        if (!v) continue;
        const fp = footprint(e.w + 0.3, e.h + 0.3).map((pt) => ({ x: pt.x + v.sx, y: pt.y + v.sy }));
        g.lineStyle(1.5, col, 0.9);
        g.strokePoints(fp, true);
        if (own && e.def.produces) {
          const r = worldToScreen(e.rallyX, e.rallyY);
          g.lineStyle(1, 0x9cf06a, 0.5);
          g.lineBetween(v.sx, v.sy, r.x, r.y);
          g.lineStyle(1.5, 0x222222, 1);
          g.lineBetween(r.x, r.y, r.x, r.y - 14);
          g.fillStyle(0x9cf06a, 1);
          g.fillRect(r.x, r.y - 14, 8, 5);
        }
      }
    }

    // Health / progress bars.
    const drawBar = (x: number, y: number, w: number, frac: number, color: number) => {
      o.fillStyle(0x000000, 0.7);
      o.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
      o.fillStyle(color, 1);
      o.fillRect(x - w / 2, y, w * Math.max(0, frac), 3);
    };
    for (const v of this.unitViews.values()) {
      const u = v.unit;
      if (!v.visible || u.dead) continue;
      const top = u.def.category === 'infantry' ? 26 : 22;
      // Veterancy chevrons (always shown for own and visible units).
      if (u.rank > 0) {
        o.fillStyle(u.rank >= 3 ? 0xffd34d : 0xe9c46a, 1);
        for (let r = 0; r < u.rank; r++) {
          const cx = v.sx - (u.rank - 1) * 3 + r * 6;
          const cy = v.sy - v.altitude - top - 7;
          o.fillTriangle(cx - 2.5, cy + 2, cx + 2.5, cy + 2, cx, cy - 2);
        }
      }
      if (!c.selection.has(u.id) && u.hp >= u.maxHp) continue;
      const f = u.hp / u.maxHp;
      const w = 14 + u.radius * 24;
      drawBar(v.sx, v.sy - v.altitude - top, w, f, hpColor(f));
    }
    for (const v of this.buildingViews.values()) {
      const b = v.building;
      if (b.dead || !v.body.visible || v.body.alpha < 1) continue;
      const w = 22 + b.w * 12;
      const y = v.sy - b.def.height - (b.h * 16) / 2 - 18;
      if (!b.complete) drawBar(v.sx, y - 6, w, b.progress, 0xe2b23a);
      if (c.selection.has(b.id) || b.hp < b.maxHp * 0.999)
        drawBar(v.sx, y, w, b.hp / b.maxHp, hpColor(b.hp / b.maxHp));
      if (b.owner === c.humanId && b.queue.length)
        drawBar(v.sx, y + 6, w, b.queueProgress / qTime(b.queue[0]), 0x6fc3ff);
      if (b.owner === c.humanId && b.research)
        drawBar(v.sx, y + 6, w, b.research.progress / RESEARCH[b.research.id].time, 0xa78bfa);
      if (b.repairing) {
        // Pulsing green repair cross.
        const a = 0.55 + 0.45 * Math.sin(this.frame * 0.15);
        o.fillStyle(0x6fd24a, a);
        o.fillRect(v.sx + w / 2 + 4, y - 7, 4, 12);
        o.fillRect(v.sx + w / 2, y - 3, 12, 4);
      }
    }

    // Drag box.
    if (this.dragging && this.dragStart) {
      const cam = this.cameras.main;
      const p = this.input.activePointer;
      const a = cam.getWorldPoint(this.dragStart.x, this.dragStart.y);
      const b2 = cam.getWorldPoint(p.x, p.y);
      o.lineStyle(1 / cam.zoom, 0x9cf06a, 0.9);
      o.fillStyle(0x9cf06a, 0.08);
      o.fillRect(Math.min(a.x, b2.x), Math.min(a.y, b2.y), Math.abs(a.x - b2.x), Math.abs(a.y - b2.y));
      o.strokeRect(Math.min(a.x, b2.x), Math.min(a.y, b2.y), Math.abs(a.x - b2.x), Math.abs(a.y - b2.y));
    }

    // Cursor feedback.
    let cursor = 'default';
    if (c.placing) cursor = 'copy';
    else if (c.commandMode === 'attackMove' || c.commandMode === 'patrol' || c.commandMode === 'smoke')
      cursor = 'crosshair';
    else if (c.selectedOwnUnits().length) {
      if (this.frame % 4 === 0) {
        const t = this.pick(this.input.activePointer);
        this.hoverEnemy = !!t && t.team !== c.team;
      }
      if (this.hoverEnemy) cursor = 'crosshair';
    }
    const canvas = this.game.canvas;
    if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  }

  private drawPlacementGhost(): void {
    const g = this.ghost;
    g.clear();
    const c = this.ctrl;
    if (!c.placing) return;
    const type = c.placing;
    const def = BUILDINGS[type];
    const { tx, ty } = this.placementTile(this.input.activePointer, type);
    const err = c.world.placementError(c.humanId, type, tx, ty);
    const ok = !err && c.human.credits >= def.cost;
    for (let j = ty; j < ty + def.h; j++)
      for (let i = tx; i < tx + def.w; i++) {
        const s = worldToScreen(i + 0.5, j + 0.5);
        const walk = c.world.grid.walkable(i, j) && c.world.map.tiles[j * c.world.map.width + i] !== 'ore';
        g.fillStyle(walk && ok ? 0x7fb24a : 0xe04848, 0.35);
        g.fillPoints(
          [
            { x: s.x, y: s.y - 16 },
            { x: s.x + 32, y: s.y },
            { x: s.x, y: s.y + 16 },
            { x: s.x - 32, y: s.y },
          ],
          true,
        );
      }
    const center = worldToScreen(tx + def.w / 2, ty + def.h / 2);
    const facing = c.placingFacing;
    g.save();
    g.translateCanvas(center.x, center.y);
    if (facing % 2 === 1) g.scaleCanvas(-1, 1);
    drawBuilding(g, type, this.colorOf(c.humanId), 1, 0);
    g.restore();
    // Front arrow: where units come out / the default rally side.
    const front = frontOf({ tx, ty, w: def.w, h: def.h, facing }, 0.9);
    const tip = worldToScreen(front.x, front.y);
    const [dx, dy] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ][facing];
    const base = worldToScreen(front.x - dx * 0.9, front.y - dy * 0.9);
    g.lineStyle(3, 0xf0d060, 0.9);
    g.lineBetween(base.x, base.y, tip.x, tip.y);
    const ang = Math.atan2(tip.y - base.y, tip.x - base.x);
    g.fillStyle(0xf0d060, 0.95);
    g.fillTriangle(
      tip.x + Math.cos(ang) * 8,
      tip.y + Math.sin(ang) * 8,
      tip.x + Math.cos(ang + 2.4) * 8,
      tip.y + Math.sin(ang + 2.4) * 8,
      tip.x + Math.cos(ang - 2.4) * 8,
      tip.y + Math.sin(ang - 2.4) * 8,
    );
    if (def.needsOre) {
      // Highlight extraction radius.
      g.lineStyle(1, 0xf0c040, 0.6);
      g.strokeEllipse(center.x, center.y, 3.5 * 2 * 64 * 0.72, 3.5 * 2 * 32 * 0.72);
    }
  }

  /** Ground ring, flag and capture progress of every strategic point. */
  /** Flags (public information in CTF): stand at home, flag at its current position (carried or dropped). */
  private drawFlags(): void {
    const world = this.ctrl.world;
    world.flags.forEach((f, i) => {
      const g = this.flagViews[i];
      const color = world.players.find((p) => p.team === f.team)?.color ?? 0xffffff;
      g.clear();
      const home = worldToScreen(f.homeX, f.homeY);
      g.setPosition(0, 0);
      g.setDepth(home.y + 1);
      // Stand: team-coloured ring on the ground.
      g.lineStyle(2, color, 0.9);
      g.strokeEllipse(home.x, home.y, 54, 27);
      g.fillStyle(color, 0.15);
      g.fillEllipse(home.x, home.y, 54, 27);
      const c = f.carrier !== null ? world.get(f.carrier) : undefined;
      const carrier = c?.kind === 'unit' ? c : undefined;
      const fx = carrier ? carrier.prevX + (carrier.x - carrier.prevX) * this.alpha : f.x;
      const fy = carrier ? carrier.prevY + (carrier.y - carrier.prevY) * this.alpha : f.y;
      const p = worldToScreen(fx, fy);
      const top = carrier ? 54 : 44;
      g.lineStyle(2, 0xe8ecef, 1);
      g.lineBetween(p.x, p.y, p.x, p.y - top);
      const wav = Math.sin(this.frame * 0.15) * 3;
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          { x: p.x + 1, y: p.y - top },
          { x: p.x + 24, y: p.y - top + 5 + wav },
          { x: p.x + 1, y: p.y - top + 12 },
        ],
        true,
      );
      if (!f.atHome && !carrier) {
        // Dropped flag: blinking marker.
        g.lineStyle(1.5, 0xffd04a, (this.frame >> 4) % 2 ? 1 : 0.3);
        g.strokeCircle(p.x, p.y - 4, 14);
      }
      g.setDepth(Math.max(home.y, p.y) + 2);
    });
  }

  private drawControlPoints(): void {
    const world = this.ctrl.world;
    const R = BALANCE.pointRadius;
    world.points.forEach((pt, i) => {
      const view = this.pointViews[i];
      const owner = pt.player !== null ? world.players[pt.player].color : null;
      const cap =
        pt.capTeam !== null ? (world.players.find((p) => p.team === pt.capTeam)?.color ?? 0xffffff) : null;
      const wave = Math.floor(this.frame / 3) % 40;
      const key = `${owner}|${cap}|${pt.progress.toFixed(2)}|${pt.contested}|${wave}`;
      if (key === view.key) return;
      view.key = key;
      const g = view.g;
      g.clear();
      const col = owner ?? 0xc8ccd0;
      const rx = R * 2 * 45.25;
      const ry = rx / 2;
      g.fillStyle(col, owner !== null ? 0.12 : 0.06);
      g.fillEllipse(0, 0, rx, ry);
      g.lineStyle(2, col, 0.75);
      g.strokeEllipse(0, 0, rx, ry);
      // Animated inner ring when contested / capturing.
      if (pt.contested || pt.progress > 0) {
        const t = wave / 40;
        g.lineStyle(1.5, pt.contested ? 0xffd04a : (cap ?? col), 1 - t);
        g.strokeEllipse(0, 0, rx * t, ry * t);
      }
      // Concrete pad + flag pole.
      g.fillStyle(0x7d7f7a, 1);
      g.fillPoints(
        [
          { x: 0, y: -10 },
          { x: 20, y: 0 },
          { x: 0, y: 10 },
          { x: -20, y: 0 },
        ],
        true,
      );
      g.lineStyle(2, 0x2a2e33, 1);
      g.lineBetween(0, 0, 0, -46);
      const wav = Math.sin(this.frame * 0.1) * 2;
      g.fillStyle(col, 1);
      g.fillPoints(
        [
          { x: 1, y: -46 },
          { x: 22, y: -42 + wav },
          { x: 1, y: -34 },
        ],
        true,
      );
      // Capture progress bar.
      if (pt.progress > 0 && cap !== null) {
        g.fillStyle(0x000000, 0.7);
        g.fillRect(-21, -58, 42, 6);
        g.fillStyle(pt.team !== null ? 0xe04848 : cap, 1);
        g.fillRect(-20, -57, 40 * pt.progress, 4);
      }
    });
  }

  private publishCameraView(): void {
    const v = this.cameras.main.worldView;
    this.ctrl.cameraView = [
      screenToWorld(v.x, v.y),
      screenToWorld(v.right, v.y),
      screenToWorld(v.right, v.bottom),
      screenToWorld(v.x, v.bottom),
    ];
  }
}

function hpColor(f: number): number {
  return f > 0.6 ? 0x6fd24a : f > 0.3 ? 0xf2c94a : 0xe04848;
}

function qTime(t: UnitTypeId): number {
  return UNITS[t].buildTime;
}
