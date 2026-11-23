import * as THREE from 'three';

/**
 * RTS camera: looks at a ground target from a fixed pitch; pans (WASD / arrows / screen edge / middle or right drag),
 * zooms (wheel) and turns in 90° steps (Q / E) with easing.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  distance = 22;
  private distanceGoal = 22;
  /** Azimuth: 45° looks along the map diagonal like the isometric view. */
  private yaw = Math.PI / 4;
  private yawGoal = Math.PI / 4;
  private readonly pitch = THREE.MathUtils.degToRad(52);
  private keys = new Set<string>();
  private drag: { x: number; y: number } | null = null;
  private mouse = { x: -1, y: -1 };
  /** Set when the player moves the camera (stops auto-follow). */
  onManual: () => void = () => {};
  edgePan = true;

  constructor(
    private readonly dom: HTMLElement,
    private readonly bounds: { w: number; h: number },
  ) {
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === 'q') this.turn(1);
      if (k === 'e') this.turn(-1);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) this.onManual();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2 || e.button === 0) {
        this.drag = { x: e.clientX, y: e.clientY };
        dom.setPointerCapture(e.pointerId);
      }
    });
    dom.addEventListener('pointermove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag = { x: e.clientX, y: e.clientY };
      const k = this.distance / dom.clientHeight;
      this.panScreen(-dx * k * 1.15, -dy * k * 1.6);
      if (Math.abs(dx) + Math.abs(dy) > 0) this.onManual();
    });
    dom.addEventListener('pointerup', () => (this.drag = null));
    dom.addEventListener('pointerleave', () => (this.mouse = { x: -1, y: -1 }));
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.distanceGoal = THREE.MathUtils.clamp(this.distanceGoal * Math.pow(1.0015, e.deltaY), 7, 70);
      },
      { passive: false },
    );
  }

  turn(dir: number): void {
    this.yawGoal += (dir * Math.PI) / 2;
  }

  lookAt(x: number, y: number, instant = false): void {
    this.goal.set(x, 0, y);
    if (instant) this.target.copy(this.goal);
  }

  /** Pans in screen directions (right, down) in tiles. */
  private panScreen(right: number, down: number): void {
    const fx = -Math.cos(this.yaw);
    const fz = -Math.sin(this.yaw);
    // Screen up = ground forward f (away from the camera); screen right = f × up = (−fz, fx).
    this.goal.x += -fz * right - fx * down;
    this.goal.z += fx * right - fz * down;
    this.clamp();
    this.target.copy(this.goal);
  }

  private clamp(): void {
    this.goal.x = THREE.MathUtils.clamp(this.goal.x, -2, this.bounds.w + 2);
    this.goal.z = THREE.MathUtils.clamp(this.goal.z, -2, this.bounds.h + 2);
  }

  update(dt: number, shake: number): void {
    const speed = this.distance * 1.1 * dt;
    let r = 0;
    let d = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) r -= speed;
    if (this.keys.has('d') || this.keys.has('arrowright')) r += speed;
    if (this.keys.has('w') || this.keys.has('arrowup')) d -= speed;
    if (this.keys.has('s') || this.keys.has('arrowdown')) d += speed;
    if (this.edgePan && this.mouse.x >= 0 && !this.drag) {
      const m = 6;
      const W = this.dom.clientWidth;
      const H = this.dom.clientHeight;
      if (this.mouse.x < m) r -= speed;
      if (this.mouse.x > W - m) r += speed;
      if (this.mouse.y < m) d -= speed;
      if (this.mouse.y > H - m) d += speed;
      if (this.mouse.x < m || this.mouse.x > W - m || this.mouse.y < m || this.mouse.y > H - m) this.onManual();
    }
    if (r || d) this.panScreen(r, d);
    const k = 1 - Math.pow(0.004, dt);
    this.target.lerp(this.goal, k * 0.6);
    this.distance += (this.distanceGoal - this.distance) * k;
    this.yaw += (this.yawGoal - this.yaw) * k;
    const c = this.camera;
    const flat = Math.cos(this.pitch) * this.distance;
    c.position.set(
      this.target.x + Math.cos(this.yaw) * flat,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.sin(this.yaw) * flat,
    );
    if (shake > 0) {
      const s = shake * shake * 0.12;
      c.position.x += (Math.random() - 0.5) * s;
      c.position.y += (Math.random() - 0.5) * s;
      c.position.z += (Math.random() - 0.5) * s;
    }
    c.lookAt(this.target);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
