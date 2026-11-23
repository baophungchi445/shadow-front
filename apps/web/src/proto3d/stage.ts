import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type Quality = 'low' | 'medium' | 'high';
export type Mood = 'temperate' | 'desert' | 'snow';
export type TimeOfDay = 'day' | 'dusk' | 'night';

export const QUALITY_SETTINGS: Record<
  Quality,
  { pixelRatio: number; shadows: number; ao: boolean; bloom: boolean; msaa: number; particles: number; lights: number; keepEvery: number }
> = {
  // Measured on an Intel UHD 730 (v0.19): an MSAA half-float post chain and bloom cost about half the frame rate, so
  // only High uses post-processing; Low / Medium draw straight to the screen (native anti-aliasing).
  low: { pixelRatio: 0.85, shadows: 0, ao: false, bloom: false, msaa: 0, particles: 1200, lights: 0, keepEvery: 3 },
  medium: { pixelRatio: 1.25, shadows: 2048, ao: false, bloom: false, msaa: 0, particles: 3000, lights: 4, keepEvery: 2 },
  high: { pixelRatio: 2, shadows: 4096, ao: true, bloom: true, msaa: 4, particles: 6000, lights: 8, keepEvery: 1 },
};

interface Lighting {
  sun: number;
  sunI: number;
  sky: number;
  ground: number;
  hemiI: number;
  fog: number;
  env: number;
  exposure: number;
  /** Unlit light sources (windows, beacons) brightness. */
  glow: number;
  /** Colour grade: saturation, contrast, tint. */
  sat: number;
  contrast: number;
  tint: [number, number, number];
  sunElev: number;
}

const LIGHTING: Record<TimeOfDay, Record<Mood, Lighting>> = {
  day: {
    temperate: { sun: 0xfff1dc, sunI: 3.0, sky: 0xbcd4ec, ground: 0x5a4c36, hemiI: 0.9, fog: 0xb9c6cf, env: 0.45, exposure: 1.0, glow: 0.9, sat: 1.08, contrast: 1.06, tint: [1.0, 1.0, 1.0], sunElev: 48 },
    desert: { sun: 0xffe2b8, sunI: 3.4, sky: 0xd6dde4, ground: 0x7a5d3a, hemiI: 0.85, fog: 0xd9c9ac, env: 0.4, exposure: 1.0, glow: 0.9, sat: 1.05, contrast: 1.08, tint: [1.04, 1.0, 0.94], sunElev: 55 },
    snow: { sun: 0xf1f4ff, sunI: 2.6, sky: 0xc4d6ea, ground: 0x8892a0, hemiI: 1.0, fog: 0xc8d3dd, env: 0.5, exposure: 0.95, glow: 0.9, sat: 0.95, contrast: 1.05, tint: [0.97, 1.0, 1.05], sunElev: 32 },
  },
  dusk: {
    temperate: { sun: 0xffa45c, sunI: 2.4, sky: 0x8f8fb8, ground: 0x4a3626, hemiI: 0.8, fog: 0x8a7a80, env: 0.38, exposure: 1.05, glow: 1.5, sat: 1.12, contrast: 1.08, tint: [1.06, 0.98, 0.94], sunElev: 14 },
    desert: { sun: 0xff9a50, sunI: 2.6, sky: 0x9c8fa8, ground: 0x5a3e28, hemiI: 0.8, fog: 0xa68a78, env: 0.38, exposure: 1.05, glow: 1.5, sat: 1.12, contrast: 1.1, tint: [1.08, 0.98, 0.9], sunElev: 14 },
    snow: { sun: 0xffb27a, sunI: 2.0, sky: 0x8a96c0, ground: 0x6a6a80, hemiI: 0.85, fog: 0x9a9ab0, env: 0.4, exposure: 1.0, glow: 1.5, sat: 1.05, contrast: 1.06, tint: [1.02, 0.98, 1.02], sunElev: 12 },
  },
  night: {
    temperate: { sun: 0x9fb4ff, sunI: 1.3, sky: 0x3a4a70, ground: 0x15161c, hemiI: 0.9, fog: 0x121a2a, env: 0.3, exposure: 1.2, glow: 2.4, sat: 0.85, contrast: 1.1, tint: [0.9, 0.97, 1.12], sunElev: 40 },
    desert: { sun: 0xa8b8ff, sunI: 1.3, sky: 0x3c4466, ground: 0x1a1814, hemiI: 0.9, fog: 0x161c2a, env: 0.3, exposure: 1.2, glow: 2.4, sat: 0.85, contrast: 1.1, tint: [0.92, 0.97, 1.1], sunElev: 40 },
    snow: { sun: 0xb0c4ff, sunI: 1.3, sky: 0x40507a, ground: 0x283040, hemiI: 0.95, fog: 0x1a2232, env: 0.32, exposure: 1.15, glow: 2.4, sat: 0.85, contrast: 1.08, tint: [0.9, 0.97, 1.12], sunElev: 40 },
  },
};

/** Renderer, scene, lights, sky environment and post-processing chain. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private envTex: THREE.Texture | null = null;
  quality: Quality = 'medium';
  /** Weather haze: fog colour override and how close it starts (1 = clear air). */
  private haze: { color: number | null; k: number } = { color: null, k: 1 };
  lighting!: Lighting;
  private sunDir = new THREE.Vector3();

  constructor(
    private readonly host: HTMLElement,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.scene.fog = new THREE.Fog(0xffffff, 60, 160);
  }

  setLighting(time: TimeOfDay, mood: Mood): void {
    const L = (this.lighting = LIGHTING[time][mood]);
    this.sun.color.setHex(L.sun);
    this.sun.intensity = L.sunI;
    this.hemi.color.setHex(L.sky);
    this.hemi.groundColor.setHex(L.ground);
    this.hemi.intensity = L.hemiI;
    const fog = this.scene.fog as THREE.Fog;
    const fc = new THREE.Color(L.fog);
    if (this.haze.color !== null) fc.lerp(new THREE.Color(this.haze.color).multiplyScalar(time === 'night' ? 0.15 : time === 'dusk' ? 0.6 : 1), 0.8);
    fog.color.copy(fc);
    this.scene.background = fc.clone();
    this.renderer.toneMappingExposure = L.exposure;
    // Sun from the upper left of the default view (matches the 2D art's light direction).
    const elev = THREE.MathUtils.degToRad(L.sunElev);
    const az = THREE.MathUtils.degToRad(time === 'dusk' ? 200 : 160);
    this.sunDir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    this.buildEnvironment(L);
    this.applyGrade();
  }

  /** Rain / snow / sandstorm thicken the air. Call before `setLighting`. */
  setWeather(kind: 'clear' | 'rain' | 'snow' | 'sandstorm'): void {
    this.haze =
      kind === 'sandstorm'
        ? { color: 0xc49a62, k: 0.35 }
        : kind === 'rain'
          ? { color: 0x8a949c, k: 0.65 }
          : kind === 'snow'
            ? { color: 0xd4dce4, k: 0.6 }
            : { color: null, k: 1 };
  }

  /** Image-based ambient light and reflections from a gradient sky. */
  private buildEnvironment(L: Lighting): void {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const sky = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const top = new THREE.Color(L.sky);
    const horizon = new THREE.Color(L.fog);
    const ground = new THREE.Color(L.ground);
    const cols: number[] = [];
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 10;
      const c = y > 0 ? horizon.clone().lerp(top, Math.pow(y, 0.6)) : horizon.clone().lerp(ground, Math.min(1, -y * 3));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    sky.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.sun).multiplyScalar(L.sunI * 6) }));
    sunBall.position.copy(this.sunDir).multiplyScalar(9);
    sky.add(sunBall);
    const rt = pm.fromScene(sky, 0.02);
    this.envTex?.dispose();
    this.envTex = rt.texture;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = L.env;
    pm.dispose();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    const s = QUALITY_SETTINGS[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatio));
    this.renderer.shadowMap.enabled = s.shadows > 0;
    this.sun.castShadow = s.shadows > 0;
    if (s.shadows) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      this.sun.shadow.mapSize.set(s.shadows, s.shadows);
    }
    // Shadow toggling changes shader defines: force every material to recompile.
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
    });
    this.composer?.dispose();
    this.composer = null;
    this.gtao = null;
    this.bloom = null;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (s.bloom || s.ao) {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: s.msaa });
      const composer = new EffectComposer(this.renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));
      if (s.ao) {
        this.gtao = new GTAOPass(this.scene, this.camera, w, h);
        this.gtao.blendIntensity = 0.85;
        this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 });
        composer.addPass(this.gtao);
      }
      if (s.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.5, 1.05);
        composer.addPass(this.bloom);
      }
      composer.addPass(new OutputPass());
      this.composer = composer;
    }
    this.resize();
    this.applyGrade();
  }

  /** Colour grade + vignette as CSS on the canvas and an overlay (nearly free on the GPU, every quality level). */
  private applyGrade(): void {
    if (!this.lighting) return;
    const L = this.lighting;
    this.renderer.domElement.style.filter = `saturate(${L.sat}) contrast(${L.contrast})`;
    let v = this.host.querySelector<HTMLDivElement>('.grade');
    if (!v) {
      v = document.createElement('div');
      v.className = 'grade';
      v.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply';
      this.host.appendChild(v);
    }
    const [r, g, b] = L.tint.map((x) => Math.round(Math.min(1, x / Math.max(...L.tint)) * 255));
    v.style.background = `radial-gradient(ellipse at center, rgb(${r},${g},${b}) 55%, rgba(0,0,0,0.75) 140%)`;
  }

  resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
  }

  /** Keeps the shadow frustum around the camera target, snapped to shadow texels (no shimmering). */
  followShadow(target: THREE.Vector3, distance: number): void {
    const half = Math.min(60, distance * 0.95 + 6);
    const cam = this.sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 120;
    cam.updateProjectionMatrix();
    const texel = (half * 2) / (this.sun.shadow.mapSize.x || 1024);
    const t = target.clone();
    t.x = Math.round(t.x / texel) * texel;
    t.z = Math.round(t.z / texel) * texel;
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(this.sunDir, 50);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = distance * 1.6 * this.haze.k;
    fog.far = (distance * 4.5 + 30) * this.haze.k;
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
