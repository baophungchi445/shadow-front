import * as THREE from 'three';
import { World } from '@shadow-front/game-core';
import { AICommander } from '@shadow-front/game-ai';
import type { FactionId, MapId, UnitTypeId, Weather } from '@shadow-front/shared-types';
import { CameraRig } from './camera';
import { Effects } from './effects';
import { EntityRenderer } from './entities';
import { FogOfWarLayer } from './fow';
import { QUALITY_SETTINGS, Stage, type Mood, type Quality, type TimeOfDay } from './stage';
import { Terrain } from './terrain';

/**
 * SHADOW FRONT — 3D graphics prototype (v0.19).
 * A real match (World + AI commanders on both sides) drawn with Three.js, to judge the look and the frame rate before
 * deciding whether the game moves to 3D. Separate page: /proto3d.html. The Phaser game is untouched.
 */

const TICK_MS = 50;
const params = new URLSearchParams(location.search);
const opt = {
  map: (params.get('map') ?? 'river-crossing') as MapId,
  seed: Number(params.get('seed') ?? 7),
  /** Seconds of battle simulated before the first frame (armies already in the field). */
  skip: Number(params.get('t') ?? 300),
  quality: (params.get('q') ?? 'medium') as Quality,
  time: (params.get('time') ?? 'day') as TimeOfDay,
  weather: (params.get('weather') ?? 'clear') as Weather,
};

const MAPS: [MapId, string][] = [
  ['river-crossing', 'River Crossing'],
  ['desert-storm', 'Desert Storm'],
  ['forest-warfare', 'Forest Warfare'],
  ['highland-pass', 'Highland Pass'],
  ['urban-conflict', 'Urban Conflict'],
  ['snowfield', 'Snowfield'],
  ['coastal-front', 'Coastal Front'],
  ['island-conflict', 'Island Conflict'],
  ['industrial-zone', 'Industrial Zone'],
];

const FACTIONS: FactionId[] = ['western', 'eastern', 'desert', 'pacific'];

function createWorld(): { world: World; ais: AICommander[] } {
  const probe = new World({
    mapId: opt.map,
    mission: 'annihilation',
    startingCredits: 10000,
    seed: opt.seed,
    slots: [
      { kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: 'warlord' },
      { kind: 'ai', name: 'B', faction: 'eastern', team: 1, difficulty: 'hard', personality: 'warlord' },
    ],
  });
  const n = Math.min(4, probe.map.spawns.length);
  const world = new World({
    mapId: opt.map,
    mission: 'annihilation',
    startingCredits: 10000,
    seed: opt.seed,
    unitCap: 120,
    weather: opt.weather,
    dayTime: opt.time === 'night' ? 'night' : 'day',
    slots: Array.from({ length: n }, (_, i) => ({
      kind: 'ai' as const,
      name: `Commander ${i + 1}`,
      faction: FACTIONS[i % FACTIONS.length],
      team: i % 2,
      difficulty: 'hard' as const,
      personality: (['warlord', 'rush', 'eagle', 'fortress'] as const)[i % 4],
    })),
  });
  return { world, ais: world.players.map((p) => new AICommander(world, p.id)) };
}

function mood(world: World): Mood {
  const count = (k: string) => world.map.tiles.filter((t) => t === k).length / world.map.tiles.length;
  if (count('snow') > 0.15) return 'snow';
  if (count('sand') > 0.3) return 'desert';
  return 'temperate';
}

async function main(): Promise<void> {
  const host = document.getElementById('view')!;
  const loading = document.getElementById('loading')!;
  const { world, ais } = createWorld();

  // Fast-forward so both armies are in the field (in chunks, keeping the page responsive).
  const ticks = Math.round((opt.skip * 1000) / TICK_MS);
  for (let done = 0; done < ticks && world.winningTeam === null; ) {
    const chunk = Math.min(200, ticks - done);
    for (let i = 0; i < chunk; i++) {
      for (const ai of ais) ai.update();
      world.step();
    }
    world.drainEvents();
    done += chunk;
    loading.textContent = `Simulating the battle… ${Math.round((done / ticks) * 100)}%`;
    await new Promise((r) => setTimeout(r, 0));
  }
  loading.textContent = 'Building the scene…';
  await new Promise((r) => setTimeout(r, 0));

  const md = mood(world);
  const rig = new CameraRig(host, { w: world.map.width, h: world.map.height });
  const stage = new Stage(host, rig.camera);
  const fow = new FogOfWarLayer(world.map.width, world.map.height);
  const terrain = new Terrain(world.map, fow, md === 'snow');
  stage.scene.add(terrain.group);
  const entities = new EntityRenderer(world, terrain, fow);
  stage.scene.add(entities.group);
  let q = opt.quality;
  const qs = () => QUALITY_SETTINGS[q];
  const effects = new Effects(world, terrain, entities, fow, { particles: QUALITY_SETTINGS.high.particles, lights: qs().lights, keepEvery: qs().keepEvery });
  stage.scene.add(effects.group);
  effects.setWeather(opt.weather);
  let time = opt.time;
  stage.setWeather(opt.weather);
  stage.setLighting(time, md);
  stage.setQuality(q);

  let follow = true;
  rig.onManual = () => {
    follow = false;
    syncUi();
  };
  // Start over the middle of the map, where the armies meet.
  rig.lookAt(world.map.width / 2, world.map.height / 2, true);

  const resize = () => {
    rig.resize(host.clientWidth, host.clientHeight);
    stage.resize();
    effects.pointScale = (host.clientHeight * stage.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(rig.camera.fov / 2)));
  };
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------------ UI
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const mapSel = $<HTMLSelectElement>('map');
  for (const [id, name] of MAPS) mapSel.add(new Option(name, id, false, id === opt.map));
  $<HTMLSelectElement>('weather').value = opt.weather;
  $<HTMLSelectElement>('time').value = time;
  const reload = () => {
    const p = new URLSearchParams({
      map: mapSel.value,
      q,
      time,
      weather: $<HTMLSelectElement>('weather').value,
      seed: String(opt.seed),
      t: String(opt.skip),
    });
    location.search = p.toString();
  };
  mapSel.onchange = reload;
  $<HTMLSelectElement>('weather').onchange = reload;
  $<HTMLSelectElement>('time').onchange = (e) => {
    time = (e.target as HTMLSelectElement).value as TimeOfDay;
    stage.setLighting(time, md);
  };
  let speed = 1;
  const syncUi = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === q));
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === speed));
    $('fog').classList.toggle('on', fow.enabled);
    $('follow').classList.toggle('on', follow);
  };
  document.querySelectorAll<HTMLButtonElement>('[data-q]').forEach(
    (b) =>
      (b.onclick = () => {
        q = b.dataset.q as Quality;
        stage.setQuality(q);
        effects.setQuality({ particles: qs().particles, lights: qs().lights, keepEvery: qs().keepEvery });
        resize();
        syncUi();
      }),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(
    (b) =>
      (b.onclick = () => {
        speed = Number(b.dataset.speed);
        syncUi();
      }),
  );
  $('fog').onclick = () => {
    fow.enabled = !fow.enabled;
    syncUi();
  };
  $('follow').onclick = () => {
    follow = !follow;
    syncUi();
  };
  $('rotl').onclick = () => rig.turn(1);
  $('rotr').onclick = () => rig.turn(-1);
  $('stress').onclick = () => stress(world, rig.target);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') $('follow').click();
    if (e.key === 'v' || e.key === 'V') $('fog').click();
    if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('nohud');
  });
  syncUi();
  loading.remove();

  // ------------------------------------------------------------------ loop
  let last = performance.now();
  let acc = 0;
  let clock = 0;
  let frames = 0;
  let fpsT = 0;
  let worst = 0;
  let fowT = 0;
  let terrainVersion = world.terrainVersion;
  const stats = $('stats');
  stage.renderer.info.autoReset = false;
  const gl = stage.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown GPU';
  console.info('[proto3d] GPU:', gpu);
  $('gpu').textContent = gpu.replace(/^ANGLE \((.*)\)$/, '$1').slice(0, 60);
  const perf = { sim: 0, scene: 0, draw: 0 };
  const loop = (now: number) => {
    const dtMs = Math.min(100, now - last);
    const t0 = performance.now();
    last = now;
    const dt = dtMs / 1000;
    clock += dt;
    worst = Math.max(worst, dtMs);
    if (world.winningTeam === null) {
      acc += dtMs * speed;
      let steps = 0;
      while (acc >= TICK_MS && steps < 8 * speed) {
        effects.snapshot();
        for (const ai of ais) ai.update();
        world.step();
        acc -= TICK_MS;
        steps++;
        effects.handle(world.drainEvents(), clock);
      }
    }
    const t1 = performance.now();
    const alpha = world.winningTeam === null ? Math.min(1, acc / TICK_MS) : 1;
    if (world.terrainVersion !== terrainVersion) {
      terrainVersion = world.terrainVersion;
      terrain.refresh(world.map);
    }
    fowT -= dt;
    if (fowT <= 0 && fow.enabled) {
      fowT = 0.15;
      fow.update(world.fog.visibleGrid(entities.viewTeam), world.fog.exploredGrid(entities.viewTeam));
    }
    if (follow && effects.hotspot && clock - effects.hotspot.t < 1) {
      rig.lookAt(effects.hotspot.x, effects.hotspot.y);
      effects.hotspot = null;
    } else if (follow && Math.floor(clock) % 6 === 0 && Math.floor(clock - dt) % 6 !== 0) {
      const hot = busiest(world);
      if (hot) rig.lookAt(hot.x, hot.y);
    }
    rig.update(dt, effects.shake);
    stage.followShadow(rig.target, rig.distance);
    entities.glow.setScalar(stage.lighting.glow);
    entities.update(alpha, clock, rig.camera);
    effects.update(dt, alpha, clock, rig.target);
    terrain.update(clock);
    const t2 = performance.now();
    stage.renderer.info.reset();
    stage.render();
    const t3 = performance.now();
    perf.sim += t1 - t0;
    perf.scene += t2 - t1;
    perf.draw += t3 - t2;

    frames++;
    fpsT += dt;
    if (fpsT >= 0.5) {
      const info = stage.renderer.info.render;
      let units = 0;
      let buildings = 0;
      for (const e of world.entities.values())
        if (!e.dead) {
          if (e.kind === 'unit') units++;
          else buildings++;
        }
      stats.innerHTML =
        `<b>${Math.round(frames / fpsT)}</b> FPS · worst ${worst.toFixed(0)} ms<br>` +
        `${units} units · ${buildings} buildings · ${effects.particleCount} particles<br>` +
        `${info.calls} draw calls · ${(info.triangles / 1000).toFixed(0)}k tris<br>` +
        `cpu: sim ${(perf.sim / frames).toFixed(1)} · scene ${(perf.scene / frames).toFixed(1)} · gl ${(perf.draw / frames).toFixed(1)} ms<br>` +
        `tick ${world.tick} (${Math.floor(world.tick / 1200)}:${String(Math.floor((world.tick / 20) % 60)).padStart(2, '0')})` +
        (world.winningTeam !== null ? ` · <b>team ${world.winningTeam + 1} won</b>` : '');
      frames = 0;
      fpsT = 0;
      worst = 0;
      perf.sim = perf.scene = perf.draw = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Dev hook for automated checks.
  (window as unknown as { __p3d: unknown }).__p3d = {
    world,
    stage,
    rig,
    effects,
    entities,
    settings: QUALITY_SETTINGS,
    setFollow: (v: boolean) => (follow = v),
    /** Re-applies the current quality after editing `settings` (benchmarks). */
    reapply: () => {
      stage.setQuality(q);
      effects.setQuality({ particles: qs().particles, lights: qs().lights, keepEvery: qs().keepEvery });
      resize();
    },
  };
}

/** Point with the most fighting (projectiles in flight), for the auto camera. */
function busiest(world: World): { x: number; y: number } | null {
  const cells = new Map<number, number>();
  let best = -1;
  let at: { x: number; y: number } | null = null;
  for (const p of world.projectiles) {
    const k = Math.floor(p.x / 10) * 1000 + Math.floor(p.y / 10);
    const n = (cells.get(k) ?? 0) + 1;
    cells.set(k, n);
    if (n > best) {
      best = n;
      at = { x: Math.floor(p.x / 10) * 10 + 5, y: Math.floor(p.y / 10) * 10 + 5 };
    }
  }
  return at;
}

/** Spawns two armies facing each other around the camera target. */
function stress(world: World, c: THREE.Vector3): void {
  const types: UnitTypeId[] = ['main-battle-tank', 'rifleman', 'rifleman', 'apc', 'attack-helicopter', 'mobile-artillery', 'heavy-tank', 'at-soldier'];
  const teams = [0, 1].map((t) => world.players.find((p) => p.team === t && !p.defeated));
  teams.forEach((p, side) => {
    if (!p) return;
    const ids: number[] = [];
    for (let i = 0; i < 50; i++) {
      const type = types[i % types.length];
      const x = c.x + (side ? 7 : -7) + (Math.random() - 0.5) * 6;
      const y = c.z + (side ? -7 : 7) + (Math.random() - 0.5) * 6;
      const air = type === 'attack-helicopter';
      const spot = air ? { x: Math.floor(x), y: Math.floor(y) } : world.grid.nearestWalkable(Math.floor(x), Math.floor(y), 8);
      if (!spot) continue;
      ids.push(world.createUnit(p.id, type, spot.x + 0.5, spot.y + 0.5).id);
    }
    const foe = teams[1 - side];
    if (foe) world.issue({ type: 'move', player: p.id, units: ids, x: c.x + (side ? -9 : 9), y: c.z + (side ? 9 : -9), attackMove: true });
  });
}

main().catch((e) => {
  document.getElementById('loading')!.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  console.error(e);
});
