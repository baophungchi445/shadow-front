import type {
  BuildingTypeId,
  DayTime,
  Weather,
  Command,
  Difficulty,
  CommandResult,
  EntityId,
  GameEvent,
  MapDef,
  MatchConfig,
  MissionType,
  PlayerId,
  ResearchId,
  TeamId,
  UnitTypeId,
  WeaponDef,
} from '@shadow-front/shared-types';
import {
  BALANCE,
  BUILDINGS,
  FACTIONS,
  PLAYER_COLORS,
  RESEARCH_EFFECTS,
  SURVIVAL,
  UNIT_SUPPLY,
  UNIT_UPGRADE,
  WEATHER,
  DAY_NIGHT,
  UNITS,
  customMapErrors,
  getMap,
  mulberry32,
} from '@shadow-front/game-data';
import { NavGrid, type Nav, type WaterNav } from './grid';
import { FogOfWar } from './fog';
import { SpatialHash } from './spatial';
import type {
  Building,
  ControlPoint,
  Entity,
  Flag,
  Player,
  Projectile,
  SmokeCloud,
  SurvivalState,
  Unit,
} from './types';
import { executeCommand } from './commands';
import { updateEconomy, updatePower, updateConstruction, updateProduction } from './systems/economy';
import { updateMovement } from './systems/movement';
import { updateCombat, updateProjectiles } from './systems/combat';
import { updateControlPoints } from './systems/points';
import { frontOf } from './front';
import { updateRepair, updateResearch, updateUnitUpgrades, updateUpgrades } from './systems/research';
import { updateWaves } from './systems/waves';
import { updateSupport } from './systems/support';
import { updateBoarding } from './systems/transport';
import { updateFlags } from './systems/flags';

export class World {
  readonly map: MapDef;
  readonly grid: NavGrid;
  /** Water-only navigation for ships (v0.13). */
  readonly water: WaterNav;
  readonly fog: FogOfWar;
  readonly spatial: SpatialHash;
  readonly mission: MissionType;
  readonly players: Player[] = [];
  readonly entities = new Map<EntityId, Entity>();
  projectiles: Projectile[] = [];
  /** Remaining credits in each ore tile (0 for non-ore tiles). */
  readonly oreRemaining: Float32Array;
  readonly rng: () => number;
  /** Match seed (also seeds AI decision randomness). */
  readonly seed: number;
  tick = 0;
  winningTeam: TeamId | null = null;
  private nextId = 1;
  private pendingEvents: GameEvent[] = [];
  /** Capturable strategic points from the map. */
  readonly points: ControlPoint[];
  /** Capture the Flag: flags and captures per team (ctf mission only). */
  readonly flags: Flag[] = [];
  readonly captures = new Map<TeamId, number>();
  /** Domination score per team (domination mission only). */
  readonly scores = new Map<TeamId, number>();
  /** Population cap per player (0 = unlimited). */
  readonly unitCap: number;
  /** Active smoke screens. */
  smokes: SmokeCloud[] = [];
  /** Survival mode state (null in other missions). */
  readonly survival: SurvivalState | null = null;
  /** Remaining hit points of destructible tiles (forest, urban; 0 elsewhere), v0.12. */
  readonly terrainHp: Float32Array;
  /** Bumped whenever a tile changes (renderers refresh the minimap). */
  terrainVersion = 0;
  /** Weather and time of day (v0.11). */
  readonly weather: Weather;
  readonly dayTime: DayTime;

  constructor(config: MatchConfig) {
    let map: MapDef;
    if (config.mapId === 'custom') {
      if (!config.customMap) throw new Error('Custom map missing');
      const errors = customMapErrors(config.customMap);
      if (errors.length) throw new Error(`Custom map is not playable: ${errors[0]}`);
      map = config.customMap;
    } else {
      map =
        config.mapId === 'random'
          ? getMap('random', config.mapSeed ?? config.seed, !!config.mapSea)
          : getMap(config.mapId);
    }
    // Own copy of the tiles: destructible terrain changes them during the match (maps are cached / shared).
    this.map = { ...map, tiles: map.tiles.slice() };
    this.terrainHp = new Float32Array(this.map.tiles.length);
    this.map.tiles.forEach((t, i) => {
      if (t === 'forest') this.terrainHp[i] = BALANCE.forestHp;
      else if (t === 'urban') this.terrainHp[i] = BALANCE.urbanHp;
    });
    this.mission = config.mission;
    this.weather = config.weather && config.weather in WEATHER ? config.weather : 'clear';
    this.dayTime = config.dayTime === 'night' || config.dayTime === 'cycle' ? config.dayTime : 'day';
    this.unitCap = Math.max(0, Math.floor(config.unitCap ?? 0));
    this.seed = config.seed;
    this.rng = mulberry32(config.seed);
    this.grid = new NavGrid(this.map);
    this.water = this.grid.water();
    this.spatial = new SpatialHash(4, Math.ceil(this.map.width / 4));
    this.oreRemaining = new Float32Array(this.map.width * this.map.height);
    this.map.tiles.forEach((t, i) => {
      if (t === 'ore') this.oreRemaining[i] = this.map.oreAmount;
    });

    const survival = config.mission === 'survival';
    if (survival) {
      if (!config.survival) throw new Error('Survival mission requires survival settings');
      if (config.slots.some((s) => s.team !== config.slots[0].team))
        throw new Error('Survival: all commanders must be on the same team');
      if (config.slots.length >= this.map.spawns.length)
        throw new Error(
          `Survival on ${this.map.id} supports at most ${this.map.spawns.length - 1} commanders`,
        );
    }
    if (config.slots.length > this.map.spawns.length) {
      throw new Error(`Map ${this.map.id} supports at most ${this.map.spawns.length} players`);
    }
    const usedColors = new Set<number>();
    config.slots.forEach((slot, i) => {
      let color = slot.color ?? FACTIONS[slot.faction].color;
      if (usedColors.has(color)) color = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? color;
      usedColors.add(color);
      this.players.push({
        id: i,
        name: slot.name,
        team: slot.team,
        faction: slot.faction,
        color,
        isAI: slot.kind === 'ai',
        difficulty: slot.difficulty,
        personality: slot.personality,
        credits: config.startingCredits,
        powerProduced: 0,
        powerUsed: 0,
        defeated: false,
        spawnIndex: (globalThis as { __swap?: boolean }).__swap ? config.slots.length - 1 - i : i,
        stats: {
          unitsBuilt: 0,
          unitsLost: 0,
          buildingsBuilt: 0,
          buildingsLost: 0,
          kills: 0,
          creditsEarned: 0,
          creditsSpent: 0,
          byUnit: {},
        },
        lastUnderAttackTick: -1000,
        researched: [],
        unitUpgrades: [],
        raider: false,
      });
    });
    if (survival)
      this.survival = this.createRaider(config.survival!.difficulty, config.survival!.waves, usedColors);

    this.fog = new FogOfWar(this.map.width, this.map.height, [...new Set(this.players.map((p) => p.team))]);

    this.points = this.map.strategicPoints.map((sp, index) => ({
      index,
      name: sp.name,
      x: sp.x + 0.5,
      y: sp.y + 0.5,
      team: null,
      player: null,
      capTeam: null,
      progress: 0,
      contested: false,
    }));

    for (const p of this.players) if (!p.raider) this.setupStartingBase(p);
    if (config.mission === 'ctf') this.placeFlags();
    updatePower(this);
    this.updateFog();
  }

  // ---------------------------------------------------------------- setup

  private setupStartingBase(p: Player): void {
    const s = this.map.spawns[p.spawnIndex];
    const hq = this.createBuilding(p.id, 'headquarters', s.tx, s.ty, true);
    hq.rallyX = hq.x + 3;
    hq.rallyY = hq.y + 3;
    const towardCenter = {
      x: Math.sign(this.map.width / 2 - hq.x),
      y: Math.sign(this.map.height / 2 - hq.y),
    };
    const starting: UnitTypeId[] = ['rifleman', 'rifleman', 'rifleman', 'at-soldier', 'recon-vehicle'];
    const spots = this.grid.spreadTiles(
      Math.floor(hq.x + towardCenter.x * 3),
      Math.floor(hq.y + towardCenter.y * 3),
      starting.length,
    );
    starting.forEach((type, i) => {
      const t = spots[i] ?? { x: Math.floor(hq.x), y: Math.floor(hq.y + 3) };
      this.createUnit(p.id, type, t.x + 0.5, t.y + 0.5);
    });
  }

  /** One flag per team, a few tiles in front of the team's first HQ (toward the map centre). */
  private placeFlags(): void {
    const done = new Set<TeamId>();
    for (const p of this.players) {
      if (done.has(p.team)) continue;
      const hq = this.playerBuildings(p.id).find((b) => b.type === 'headquarters');
      if (!hq) continue;
      done.add(p.team);
      const dx = Math.sign(this.map.width / 2 - hq.x);
      const dy = Math.sign(this.map.height / 2 - hq.y);
      const t = this.grid.nearestWalkable(Math.floor(hq.x + dx * 3.5), Math.floor(hq.y + dy * 3.5)) ?? {
        x: Math.floor(hq.x),
        y: Math.floor(hq.y + 3),
      };
      const x = t.x + 0.5;
      const y = t.y + 0.5;
      this.flags.push({ team: p.team, homeX: x, homeY: y, x, y, carrier: null, atHome: true });
    }
  }

  /** Adds the Survival wave attacker (no base; entry points are the unused spawns). */
  private createRaider(difficulty: Difficulty, waves: number, usedColors: Set<number>): SurvivalState {
    const id = this.players.length;
    const color = usedColors.has(SURVIVAL.raiderColor)
      ? (PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? SURVIVAL.raiderColor)
      : SURVIVAL.raiderColor;
    this.players.push({
      id,
      name: SURVIVAL.raiderName,
      team: SURVIVAL.raiderTeam,
      faction: 'iron',
      color,
      isAI: true,
      credits: 0,
      powerProduced: 0,
      powerUsed: 0,
      defeated: false,
      spawnIndex: id,
      stats: {
        unitsBuilt: 0,
        unitsLost: 0,
        buildingsBuilt: 0,
        buildingsLost: 0,
        kills: 0,
        creditsEarned: 0,
        creditsSpent: 0,
        byUnit: {},
      },
      lastUnderAttackTick: -1000,
      researched: [],
      unitUpgrades: [],
      raider: true,
    });
    const entries = this.map.spawns.slice(id).map((s) => ({ x: s.tx + 1.5, y: s.ty + 1.5 }));
    return {
      difficulty,
      total: Math.max(1, Math.floor(waves)),
      wave: 0,
      nextWaveTick: SURVIVAL.firstWaveTick,
      nextEntry: entries[Math.floor(this.rng() * entries.length)],
      raider: id,
      entries,
    };
  }

  // ---------------------------------------------------------------- entity factory

  allocId(): number {
    return this.nextId++;
  }

  unitCost(playerId: PlayerId, type: UnitTypeId): number {
    const def = UNITS[type];
    const p = this.players[playerId];
    const mul = def.category === 'air' ? FACTIONS[p.faction].modifiers.airCost : 1;
    return Math.round(def.cost * mul);
  }

  createUnit(owner: PlayerId, type: UnitTypeId, x: number, y: number): Unit {
    const def = UNITS[type];
    const p = this.players[owner];
    const mods = FACTIONS[p.faction].modifiers;
    const vehicle = def.category === 'armored' || def.category === 'artillery' || def.category === 'naval';
    const armor = vehicle && this.hasResearch(owner, 'composite-armor') ? RESEARCH_EFFECTS.vehicleHp : 1;
    const optics = this.hasResearch(owner, 'advanced-optics') ? RESEARCH_EFFECTS.vision : 1;
    const medkits =
      def.category === 'infantry' && this.hasResearch(owner, 'combat-medkits')
        ? RESEARCH_EFFECTS.infantryHp
        : 1;
    const turbo = vehicle && this.hasResearch(owner, 'turbo-engines') ? RESEARCH_EFFECTS.vehicleSpeed : 1;
    const drilled = this.hasUnitUpgrade(owner, type);
    const hp = Math.round(def.hp * mods.unitHp * armor * medkits * (drilled ? UNIT_UPGRADE.hp : 1));
    const u: Unit = {
      id: this.allocId(),
      kind: 'unit',
      type,
      def,
      owner,
      team: p.team,
      x,
      y,
      prevX: x,
      prevY: y,
      hp,
      maxHp: hp,
      dead: false,
      damageMul: (mods.damage[def.category === 'naval' ? 'armored' : def.category] ?? 1) * (drilled ? UNIT_UPGRADE.damage : 1),
      cooldown: 0,
      targetId: null,
      turretFacing: Math.PI / 4,
      facing: Math.PI / 4,
      vision: def.vision * mods.vision * optics,
      lastFiredTick: -100,
      air: def.category === 'air',
      naval: def.category === 'naval',
      speed: def.speed * mods.speed * (vehicle ? mods.vehicleSpeed : 1) * turbo,
      radius: def.radius,
      order: { type: 'idle' },
      path: [],
      pathIndex: 0,
      pathVersion: 0,
      pathTick: -100,
      pathGoal: null,
      anchorX: x,
      anchorY: y,
      moving: false,
      stuckTicks: 0,
      lastDist: Infinity,
      xp: 0,
      rank: 0,
      passengers: [],
      burn: null,
      suppression: 0,
      smokeReadyTick: 0,
    };
    this.entities.set(u.id, u);
    return u;
  }

  createBuilding(
    owner: PlayerId,
    type: BuildingTypeId,
    tx: number,
    ty: number,
    complete: boolean,
    facing = 0,
  ): Building {
    const def = BUILDINGS[type];
    const p = this.players[owner];
    const mods = FACTIONS[p.faction].modifiers;
    const fort = this.hasResearch(owner, 'fortified-structures') ? RESEARCH_EFFECTS.buildingHp : 1;
    const maxHp = Math.round(def.hp * mods.buildingHp * fort);
    const b: Building = {
      id: this.allocId(),
      kind: 'building',
      type,
      def,
      owner,
      team: p.team,
      tx,
      ty,
      w: def.w,
      h: def.h,
      x: tx + def.w / 2,
      y: ty + def.h / 2,
      hp: complete ? maxHp : Math.max(1, Math.round(maxHp * 0.1)),
      maxHp,
      dead: false,
      damageMul: def.weapon ? (mods.damage.defense ?? 1) : 1,
      cooldown: 0,
      targetId: null,
      turretFacing: Math.PI / 4,
      vision: def.vision * mods.vision,
      lastFiredTick: -100,
      progress: complete ? 1 : 0,
      complete,
      queue: [],
      queueProgress: 0,
      rallyX: 0,
      rallyY: 0,
      facing: [0, 1, 2, 3].includes(facing) ? facing : 0,
      oreTiles: [],
      research: null,
      repairing: false,
      passengers: [],
      level: 1,
      upgrading: null,
      unitUpgrade: null,
      burn: null,
    };
    const front = frontOf(b, 1.5);
    b.rallyX = front.x + (b.facing % 2 === 0 ? 1 : 0);
    b.rallyY = front.y + (b.facing % 2 === 1 ? 1 : 0);
    if (def.needsOre) b.oreTiles = this.oreTilesNear(b.x, b.y);
    this.entities.set(b.id, b);
    this.grid.setOccupied(tx, ty, def.w, def.h, b.id);
    this.evictUnitsFrom(b);
    return b;
  }

  /** Pushes ground units out of a newly placed footprint. */
  private evictUnitsFrom(b: Building): void {
    for (const e of this.entities.values()) {
      if (e.kind !== 'unit' || e.air || e.naval || e.dead) continue;
      if (e.x >= b.tx && e.x < b.tx + b.w && e.y >= b.ty && e.y < b.ty + b.h) {
        const t = this.grid.nearestWalkable(Math.floor(e.x), Math.floor(e.y));
        if (t) {
          e.x = e.prevX = t.x + 0.5;
          e.y = e.prevY = t.y + 0.5;
          e.path = [];
        }
      }
    }
  }

  oreTilesNear(x: number, y: number): number[] {
    const out: number[] = [];
    const r = BALANCE.extractorRadius;
    const R = Math.ceil(r);
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const tx = Math.floor(x) + i;
        const ty = Math.floor(y) + j;
        if (!this.grid.inBounds(tx, ty)) continue;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
        const idx = this.grid.index(tx, ty);
        if (this.map.tiles[idx] === 'ore') out.push(idx);
      }
    return out;
  }

  // ---------------------------------------------------------------- population

  /** Supply used by a player's living units plus units queued in its producers. */
  supplyUsed(pid: PlayerId): number {
    let used = 0;
    for (const e of this.entities.values()) {
      if (e.dead || e.owner !== pid) continue;
      if (e.kind === 'unit') used += UNIT_SUPPLY[e.type];
      else for (const q of e.queue) used += UNIT_SUPPLY[q];
      for (const p of e.passengers) used += UNIT_SUPPLY[p.type];
    }
    return used;
  }

  /** True when queuing `type` would exceed the population cap. */
  overCap(pid: PlayerId, type: UnitTypeId): boolean {
    return this.unitCap > 0 && this.supplyUsed(pid) + UNIT_SUPPLY[type] > this.unitCap;
  }

  // ---------------------------------------------------------------- research

  hasResearch(pid: PlayerId, id: ResearchId): boolean {
    return this.players[pid]?.researched.includes(id) ?? false;
  }

  /** Damage multiplier from technology (applied when a shot is fired). */
  damageBonus(pid: PlayerId): number {
    return this.hasResearch(pid, 'improved-munitions') ? RESEARCH_EFFECTS.damage : 1;
  }

  /** Marks a technology complete and upgrades existing units where needed. */
  completeResearch(pid: PlayerId, id: ResearchId): void {
    const p = this.players[pid];
    if (p.researched.includes(id)) return;
    p.researched.push(id);
    for (const u of this.playerUnits(pid)) {
      if (id === 'composite-armor' && (u.def.category === 'armored' || u.def.category === 'artillery')) {
        u.maxHp = Math.round(u.maxHp * RESEARCH_EFFECTS.vehicleHp);
        u.hp *= RESEARCH_EFFECTS.vehicleHp;
      } else if (id === 'advanced-optics') {
        u.vision *= RESEARCH_EFFECTS.vision;
      } else if (id === 'combat-medkits' && u.def.category === 'infantry') {
        u.maxHp = Math.round(u.maxHp * RESEARCH_EFFECTS.infantryHp);
        u.hp *= RESEARCH_EFFECTS.infantryHp;
      } else if (id === 'turbo-engines' && (u.def.category === 'armored' || u.def.category === 'artillery')) {
        u.speed *= RESEARCH_EFFECTS.vehicleSpeed;
      }
    }
    if (id === 'fortified-structures')
      for (const b of this.playerBuildings(pid)) {
        b.maxHp = Math.round(b.maxHp * RESEARCH_EFFECTS.buildingHp);
        b.hp *= RESEARCH_EFFECTS.buildingHp;
      }
    this.emit({ type: 'researchComplete', player: pid, research: id });
  }

  /** True when `type` has been upgraded for this player. */
  hasUnitUpgrade(pid: PlayerId, type: UnitTypeId): boolean {
    return this.players[pid]?.unitUpgrades.includes(type) ?? false;
  }

  /** Marks a unit-type upgrade complete and improves every existing unit of that type (passengers too). */
  completeUnitUpgrade(pid: PlayerId, type: UnitTypeId): void {
    const p = this.players[pid];
    if (p.unitUpgrades.includes(type)) return;
    p.unitUpgrades.push(type);
    const apply = (u: Unit) => {
      if (u.owner !== pid || u.type !== type || u.dead) return;
      u.maxHp = Math.round(u.maxHp * UNIT_UPGRADE.hp);
      u.hp *= UNIT_UPGRADE.hp;
      u.damageMul *= UNIT_UPGRADE.damage;
    };
    for (const e of this.entities.values()) {
      if (e.kind === 'unit') apply(e);
      for (const q of e.passengers) apply(q);
    }
    this.emit({ type: 'unitUpgraded', player: pid, unit: type });
  }

  // ---------------------------------------------------------------- queries

  get(id: EntityId | null | undefined): Entity | undefined {
    if (id === null || id === undefined) return undefined;
    const e = this.entities.get(id);
    return e && !e.dead ? e : undefined;
  }

  units(): Unit[] {
    const out: Unit[] = [];
    for (const e of this.entities.values()) if (e.kind === 'unit' && !e.dead) out.push(e);
    return out;
  }

  buildings(): Building[] {
    const out: Building[] = [];
    for (const e of this.entities.values()) if (e.kind === 'building' && !e.dead) out.push(e);
    return out;
  }

  playerUnits(pid: PlayerId): Unit[] {
    return this.units().filter((u) => u.owner === pid);
  }

  playerBuildings(pid: PlayerId): Building[] {
    return this.buildings().filter((b) => b.owner === pid);
  }

  hasCompleted(pid: PlayerId, type: BuildingTypeId): boolean {
    for (const e of this.entities.values())
      if (e.kind === 'building' && !e.dead && e.owner === pid && e.type === type && e.complete) return true;
    return false;
  }

  requirementsMet(pid: PlayerId, reqs: BuildingTypeId[]): boolean {
    return reqs.every((r) => this.hasCompleted(pid, r));
  }

  isLowPower(pid: PlayerId): boolean {
    const p = this.players[pid];
    return p.powerUsed > p.powerProduced;
  }

  powerFactor(pid: PlayerId): number {
    return this.isLowPower(pid) ? BALANCE.lowPowerSpeed : 1;
  }

  areEnemies(a: TeamId, b: TeamId): boolean {
    return a !== b;
  }

  isVisibleTo(team: TeamId, e: Entity): boolean {
    if (e.team === team) return true;
    if (e.kind === 'unit' && e.def.submarine && !this.subDetected(team, e)) return false;
    if (e.kind === 'unit' && !e.air && this.smokes.length && this.inSmoke(e.x, e.y)) {
      // Hidden in smoke: only enemies right next to it can see it.
      let spotted = false;
      this.spatial.query(e.x, e.y, BALANCE.smokeSpotRange + 1, (o) => {
        if (!spotted && !o.dead && o.team === team && o.kind === 'unit')
          spotted = Math.hypot(o.x - e.x, o.y - e.y) <= BALANCE.smokeSpotRange;
      });
      if (!spotted) return false;
    }
    if (e.kind === 'building') {
      // A building is seen if any tile of its footprint is visible.
      for (let j = e.ty; j < e.ty + e.h; j++)
        for (let i = e.tx; i < e.tx + e.w; i++) if (this.fog.isVisible(team, i + 0.5, j + 0.5)) return true;
      return false;
    }
    return this.fog.isVisible(team, e.x, e.y);
  }

  /** v0.15: whether `team` currently detects the submarine `sub` (sonar, close range or a torpedo just fired). */
  subDetected(team: TeamId, sub: Unit): boolean {
    if (this.tick - sub.lastFiredTick < BALANCE.subRevealTicks) return true;
    let found = false;
    this.spatial.query(sub.x, sub.y, BALANCE.sonarRange + 1, (o) => {
      if (found || o.dead || o.team !== team) return;
      const d = Math.hypot(o.x - sub.x, o.y - sub.y);
      const sonar = o.kind === 'unit' && !!o.def.weapon?.antiSub;
      found = d <= (sonar ? BALANCE.sonarRange : BALANCE.subSpotRange);
    });
    return found;
  }

  /** Enemy entities currently visible to the given team (respects Fog of War). */
  visibleEnemies(team: TeamId): Entity[] {
    const out: Entity[] = [];
    for (const e of this.entities.values())
      if (!e.dead && this.areEnemies(team, e.team) && this.isVisibleTo(team, e)) out.push(e);
    return out;
  }

  // ---------------------------------------------------------------- placement

  /** Validates building placement; returns null if OK or a human-readable reason. */
  placementError(
    pid: PlayerId,
    type: BuildingTypeId,
    tx: number,
    ty: number,
    /** Deployed vehicles may unfold anywhere (no distance-to-base rule). */
    anywhere = false,
  ): string | null {
    const def = BUILDINGS[type];
    const team = this.players[pid].team;
    for (let j = ty; j < ty + def.h; j++)
      for (let i = tx; i < tx + def.w; i++) {
        if (!this.grid.inBounds(i, j)) return 'Out of map bounds';
        if (!this.grid.walkable(i, j)) return 'Blocked terrain';
        if (this.map.tiles[this.grid.index(i, j)] === 'ore') return 'Cannot build on ore';
        if (!this.fog.isExplored(team, i, j)) return 'Unexplored area';
      }
    // Enemy ground units standing in the footprint block placement.
    for (const e of this.entities.values()) {
      if (e.dead || e.kind !== 'unit' || e.air || !this.areEnemies(team, e.team)) continue;
      if (e.x >= tx - 0.3 && e.x < tx + def.w + 0.3 && e.y >= ty - 0.3 && e.y < ty + def.h + 0.3)
        return 'Enemy units in the way';
    }
    const cx = tx + def.w / 2;
    const cy = ty + def.h / 2;
    let near = anywhere;
    for (const b of this.playerBuildings(pid)) {
      if (Math.hypot(b.x - cx, b.y - cy) <= BALANCE.buildRadius + Math.max(b.w, b.h) / 2) {
        near = true;
        break;
      }
    }
    if (!near && !anywhere) return 'Too far from your base';
    if (def.needsOre) {
      const ore = this.oreTilesNear(cx, cy).reduce((s, i) => s + this.oreRemaining[i], 0);
      if (ore <= 0) return 'Must be placed next to an ore field';
    }
    if (def.needsWater && this.shoreWater(tx, ty, def.w, def.h) < BALANCE.shoreWaterTiles)
      return 'Must be built on the shore';
    return null;
  }

  /** Facing (see `Building.facing`) whose edge borders the most water — shipyards launch ships that way. */
  shoreFacing(tx: number, ty: number, w: number, h: number): number {
    const count = (xs: number[], ys: number[]) =>
      xs.reduce((s, x) => s + ys.filter((y) => this.grid.tile(x, y) === 'water').length, 0);
    const range = (a: number, n: number) => Array.from({ length: n }, (_, i) => a + i);
    const edges = [
      count(range(tx, w), [ty + h]),
      count([tx + w], range(ty, h)),
      count(range(tx, w), [ty - 1]),
      count([tx - 1], range(ty, h)),
    ];
    return edges.indexOf(Math.max(...edges));
  }

  /** Water tiles directly beside a footprint's edges (v0.13 shipyard placement). */
  shoreWater(tx: number, ty: number, w: number, h: number): number {
    let n = 0;
    for (let i = tx; i < tx + w; i++) {
      if (this.grid.tile(i, ty - 1) === 'water') n++;
      if (this.grid.tile(i, ty + h) === 'water') n++;
    }
    for (let j = ty; j < ty + h; j++) {
      if (this.grid.tile(tx - 1, j) === 'water') n++;
      if (this.grid.tile(tx + w, j) === 'water') n++;
    }
    return n;
  }

  // ---------------------------------------------------------------- commands & events

  issue(cmd: Command): CommandResult {
    if (this.winningTeam !== null) return { ok: false, reason: 'Match is over' };
    const p = this.players[cmd.player];
    if (!p) return { ok: false, reason: 'Unknown player' };
    if (p.defeated) return { ok: false, reason: 'Player defeated' };
    return executeCommand(this, cmd);
  }

  emit(e: GameEvent): void {
    this.pendingEvents.push(e);
  }

  /** Returns and clears events produced since the last call. */
  drainEvents(): GameEvent[] {
    const out = this.pendingEvents;
    this.pendingEvents = [];
    return out;
  }

  // ---------------------------------------------------------------- damage

  /** Grants veterancy XP to a unit for destroying `victim`. */
  private grantXp(u: Unit, victim: Entity): void {
    if (u.dead || u.rank >= 3) return;
    u.xp += victim.kind === 'unit' ? victim.def.cost : victim.def.cost * 0.5;
    const thresholds = BALANCE.veterancyThresholds;
    while (u.rank < 3 && u.xp >= thresholds[u.rank] * u.def.cost) {
      u.rank++;
      const gain = Math.round((u.maxHp / (1 + (u.rank - 1) * BALANCE.veterancyHp)) * BALANCE.veterancyHp);
      u.maxHp += gain;
      u.hp += gain;
      this.emit({ type: 'promoted', id: u.id, player: u.owner, rank: u.rank });
    }
  }

  /** Damage multiplier from a shooter's veterancy rank. */
  rankBonus(e: Entity): number {
    return e.kind === 'unit' ? 1 + e.rank * BALANCE.veterancyDamage : 1;
  }

  /**
   * Turns a deployable vehicle into its building, centred where it stands. The building starts 60% built
   * (a short unfolding phase) and the vehicle leaves the world without counting as lost.
   */
  deploy(u: Unit): Building | string {
    const type = u.def.deploysTo;
    if (!type) return 'This unit cannot deploy';
    const def = BUILDINGS[type];
    const tx = Math.round(u.x - def.w / 2);
    const ty = Math.round(u.y - def.h / 2);
    const err = this.placementError(u.owner, type, tx, ty, true);
    if (err) return err;
    u.dead = true;
    this.entities.delete(u.id);
    const b = this.createBuilding(u.owner, type, tx, ty, false);
    b.progress = 0.6;
    b.hp = Math.round(b.maxHp * 0.6);
    this.emit({ type: 'deployed', unit: u.id, building: b.id, player: u.owner, x: b.x, y: b.y });
    return b;
  }

  /** Removes a building without counting it as lost (sell / cancelled construction). */
  removeBuilding(b: Building): void {
    b.dead = true;
    b.hp = 0;
    this.grid.setOccupied(b.tx, b.ty, b.w, b.h, 0);
  }

  damage(target: Entity, amount: number, attacker: PlayerId, sourceId: EntityId | null = null): void {
    if (target.dead || amount <= 0) return;
    if (
      target.kind === 'unit' &&
      target.def.armor === 'heavy' &&
      this.hasResearch(target.owner, 'reactive-armor')
    )
      amount *= RESEARCH_EFFECTS.reactiveArmor;
    target.hp -= amount;
    const owner = this.players[target.owner];
    if (owner.lastUnderAttackTick + 100 < this.tick) {
      owner.lastUnderAttackTick = this.tick;
      this.emit({
        type: 'underAttack',
        player: owner.id,
        x: target.x,
        y: target.y,
        building: target.kind === 'building',
      });
    }
    if (target.hp <= 0) {
      this.players[attacker].stats.kills++;
      this.destroy(target);
      const src = this.get(sourceId);
      if (src && src.kind === 'unit') {
        this.grantXp(src, target);
        this.unitStat(src.owner, src.type).kills++;
      }
    }
  }

  /** Per-unit-type statistics record of a player (created on first use). */
  unitStat(pid: PlayerId, type: UnitTypeId): { built: number; kills: number } {
    const by = this.players[pid].stats.byUnit;
    return (by[type] ??= { built: 0, kills: 0 });
  }

  /** Capacity of a transport or bunker (0 when it carries nobody). */
  capacityOf(e: Entity): number {
    if (e.kind === 'unit') return e.def.transport?.capacity ?? 0;
    return e.complete ? (e.def.garrison?.capacity ?? 0) : 0;
  }

  /** Seats a passenger takes: infantry 1, ground vehicles `BALANCE.vehicleSeats` (v0.14). */
  seatsOf(u: Unit): number {
    return u.def.category === 'infantry' ? 1 : BALANCE.vehicleSeats;
  }

  /** Seats already taken inside a carrier. */
  seatsUsed(carrier: Entity): number {
    return carrier.passengers.reduce((s, p) => s + this.seatsOf(p), 0);
  }

  /** Whether `u` may ride in `carrier` at all (ignoring free seats): infantry anywhere, ground vehicles in a
   *  Landing Craft only. */
  canCarry(carrier: Entity, u: Unit): boolean {
    if (u.id === carrier.id || !this.capacityOf(carrier)) return false;
    if (u.def.category === 'infantry') return true;
    return (
      carrier.kind === 'unit' &&
      !!carrier.def.transport?.vehicles &&
      !u.air &&
      !u.naval &&
      (u.def.category === 'armored' || u.def.category === 'artillery')
    );
  }

  /** True when `u` still fits into `carrier`. */
  fits(carrier: Entity, u: Unit): boolean {
    return this.canCarry(carrier, u) && this.seatsUsed(carrier) + this.seatsOf(u) <= this.capacityOf(carrier);
  }

  /** Puts a unit inside a carrier: it leaves the world until unloaded. */
  board(u: Unit, carrier: Entity): boolean {
    if (!this.fits(carrier, u)) return false;
    u.order = { type: 'idle' };
    u.targetId = null;
    u.path = [];
    u.moving = false;
    carrier.passengers.push(u);
    this.entities.delete(u.id);
    this.emit({ type: 'boarded', id: u.id, carrier: carrier.id, player: u.owner });
    return true;
  }

  /** Everyone inside gets out on free tiles next to the carrier. */
  unloadAll(carrier: Entity): number {
    const out = carrier.passengers.splice(0);
    if (!out.length) return 0;
    const spots = this.grid.spreadTiles(Math.floor(carrier.x), Math.floor(carrier.y), out.length);
    out.forEach((u, i) => {
      const t = spots[i] ?? spots[0] ?? { x: Math.floor(carrier.x), y: Math.floor(carrier.y) };
      u.x = u.prevX = u.anchorX = t.x + 0.5;
      u.y = u.prevY = u.anchorY = t.y + 0.5;
      u.order = { type: 'idle' };
      u.path = [];
      u.moving = false;
      this.entities.set(u.id, u);
    });
    this.emit({ type: 'unloaded', carrier: carrier.id, player: carrier.owner, count: out.length });
    return out.length;
  }

  destroy(e: Entity): void {
    if (e.dead) return;
    // Bunker occupants escape; passengers of a destroyed vehicle die with it.
    if (e.kind === 'building') this.unloadAll(e);
    else
      for (const p of e.passengers.splice(0)) {
        p.dead = true;
        p.hp = 0;
        this.players[p.owner].stats.unitsLost++;
      }
    e.dead = true;
    e.hp = 0;
    const owner = this.players[e.owner];
    if (e.kind === 'building') {
      owner.stats.buildingsLost++;
      this.grid.setOccupied(e.tx, e.ty, e.w, e.h, 0);
      // Refund nothing; queued production is lost.
      this.emit({ type: 'destroyed', id: e.id, x: e.x, y: e.y, kind: 'building', big: e.w * e.h >= 4 });
    } else {
      owner.stats.unitsLost++;
      if (e.naval) owner.stats.shipsLost = (owner.stats.shipsLost ?? 0) + 1;
      this.emit({
        type: 'destroyed',
        id: e.id,
        x: e.x,
        y: e.y,
        kind: 'unit',
        big: e.def.category !== 'infantry',
      });
    }
  }

  // ---------------------------------------------------------------- tick

  step(): void {
    if (this.winningTeam !== null) return;
    this.tick++;
    this.spatial.clear();
    for (const e of this.entities.values()) if (!e.dead) this.spatial.insert(e);

    updatePower(this);
    updateConstruction(this);
    updateProduction(this);
    updateEconomy(this);
    updateMovement(this);
    updateCombat(this);
    updateProjectiles(this);
    updateResearch(this);
    updateRepair(this);
    updateUpgrades(this);
    updateUnitUpgrades(this);
    updateSupport(this);
    updateBoarding(this);
    updateFlags(this);
    if (this.tick % 10 === 0) updateControlPoints(this);
    updateWaves(this);
    this.updateConditions();

    if (this.tick % BALANCE.fogInterval === 0) this.updateFog();
    if (this.tick % 20 === 0) {
      for (const u of this.units()) {
        if (u.hp >= u.maxHp) continue;
        let regen = u.rank >= 3 ? BALANCE.heroicRegen : 0;
        if (u.def.category !== 'infantry' && this.hasResearch(u.owner, 'nano-repair'))
          regen += RESEARCH_EFFECTS.nanoRepair;
        if (regen > 0) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * regen);
      }
      this.checkVictory();
      this.cleanup();
    }
  }

  inSmoke(x: number, y: number): boolean {
    for (const s of this.smokes) if (Math.hypot(s.x - x, s.y - y) <= s.radius) return true;
    return false;
  }

  /** Throws a smoke grenade from `u` to (x, y). Returns an error message or null. */
  throwSmoke(u: Unit, x: number, y: number): string | null {
    if (!u.def.smoke) return `${u.def.name} has no smoke grenades`;
    if (this.tick < u.smokeReadyTick) return 'Smoke grenade not ready';
    if (Math.hypot(x - u.x, y - u.y) > BALANCE.smokeRange)
      return `Out of throwing range (${BALANCE.smokeRange} tiles)`;
    u.smokeReadyTick = this.tick + BALANCE.smokeCooldown;
    this.smokes.push({ x, y, radius: BALANCE.smokeRadius, until: this.tick + BALANCE.smokeTicks });
    this.emit({ type: 'smoke', x, y, player: u.owner });
    return null;
  }

  /** True when an infantry unit is pinned down by suppressive fire. */
  isSuppressed(u: Unit): boolean {
    return u.suppression >= BALANCE.suppressionThreshold;
  }

  /** Burning damage over time and suppression decay. */
  private updateConditions(): void {
    if (this.smokes.length) this.smokes = this.smokes.filter((s) => s.until > this.tick);
    for (const e of this.entities.values()) {
      if (e.dead) continue;
      if (e.kind === 'unit' && e.suppression > 0)
        e.suppression = Math.max(0, e.suppression - BALANCE.suppressionDecay);
      const b = e.burn;
      if (!b) continue;
      b.ticks--;
      if (b.ticks % 10 === 0) this.damage(e, b.dps / 2, b.owner);
      if (b.ticks <= 0 && !e.dead) e.burn = null;
    }
  }

  /** Called on a projectile hit: incendiary burn and infantry suppression. */
  applyHitEffects(target: Entity, weapon: WeaponDef, damage: number, owner: PlayerId): void {
    if (target.dead) return;
    if (weapon.burn && !(target.kind === 'unit' && target.air)) {
      const ticks = Math.round(weapon.burn.seconds * 20);
      // Re-ignition refreshes the duration and keeps the stronger fire.
      if (!target.burn || target.burn.ticks < ticks || target.burn.dps < weapon.burn.dps)
        target.burn = { ticks, dps: Math.max(weapon.burn.dps, target.burn?.dps ?? 0), owner };
    }
    if (
      target.kind === 'unit' &&
      target.def.category === 'infantry' &&
      (weapon.type === 'bullet' || weapon.type === 'artillery')
    )
      target.suppression = Math.min(BALANCE.suppressionMax, target.suppression + damage);
  }

  /** Daylight 0 (full night) .. 1 (full day). */
  daylight(): number {
    if (this.dayTime === 'day') return 1;
    if (this.dayTime === 'night') return 0;
    const c = DAY_NIGHT;
    const period = c.dayTicks + c.duskTicks + c.nightTicks + c.dawnTicks;
    const t = this.tick % period;
    if (t < c.dayTicks) return 1;
    if (t < c.dayTicks + c.duskTicks) return 1 - (t - c.dayTicks) / c.duskTicks;
    if (t < c.dayTicks + c.duskTicks + c.nightTicks) return 0;
    return (t - c.dayTicks - c.duskTicks - c.nightTicks) / c.dawnTicks;
  }

  /** Phase of the day for display. */
  dayPhase(): 'day' | 'dusk' | 'night' | 'dawn' {
    const l = this.daylight();
    if (l >= 1) return 'day';
    if (l <= 0) return 'night';
    const c = DAY_NIGHT;
    const t = this.tick % (c.dayTicks + c.duskTicks + c.nightTicks + c.dawnTicks);
    return t < c.dayTicks + c.duskTicks ? 'dusk' : 'dawn';
  }

  /** Vision multiplier from weather and darkness. */
  visionMul(): number {
    const night = DAY_NIGHT.nightVision + (1 - DAY_NIGHT.nightVision) * this.daylight();
    return WEATHER[this.weather].vision * night;
  }

  /**
   * Explosive damage to destructible terrain (v0.12) within `radius` of (x, y): woods burn down to grass, city blocks
   * collapse into walkable rubble (concrete). Opens new paths.
   */
  damageTerrain(x: number, y: number, radius: number, amount: number): void {
    const R = Math.ceil(radius + 1);
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    for (let j = -R; j <= R; j++)
      for (let i = -R; i <= R; i++) {
        const tx = cx + i;
        const ty = cy + j;
        if (!this.grid.inBounds(tx, ty)) continue;
        const idx = this.grid.index(tx, ty);
        if (this.terrainHp[idx] <= 0) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d > radius + 0.5) continue;
        this.terrainHp[idx] -= amount * (1 - 0.5 * Math.min(1, d / (radius + 0.5)));
        if (this.terrainHp[idx] > 0) continue;
        this.terrainHp[idx] = 0;
        const was = this.map.tiles[idx];
        const kind = was === 'forest' ? 'grass' : 'concrete';
        this.map.tiles[idx] = kind;
        this.grid.setTerrain(tx, ty, kind);
        this.terrainVersion++;
        this.emit({ type: 'terrainDestroyed', tx, ty, was, kind });
      }
  }

  /** Navigation layer a unit moves on: water for ships, the land grid for everything else (v0.13). */
  navFor(u: Unit): Nav {
    return u.naval ? this.water : this.grid;
  }

  /** True when a ground unit or a building stands on a hill tile (high ground, v0.12). */
  onHill(e: Entity): boolean {
    if (e.kind === 'unit' && e.air) return false;
    return this.grid.tile(Math.floor(e.x), Math.floor(e.y)) === 'hill';
  }

  /** Extra weapon range from high ground. */
  rangeBonus(e: Entity): number {
    return this.onHill(e) ? BALANCE.hillRange : 0;
  }

  /** Effective vision radius of an entity right now (weather, darkness, high ground). */
  visionOf(e: Entity, mul = this.visionMul()): number {
    const base = e.vision + (this.onHill(e) ? BALANCE.hillVision : 0);
    return Math.max(Math.min(base, DAY_NIGHT.minVision), base * mul);
  }

  /** Movement multiplier from weather (aircraft are unaffected). */
  weatherSpeed(u: Unit): number {
    if (u.air) return 1;
    const w = WEATHER[this.weather];
    return u.def.category === 'infantry' ? w.infantrySpeed : w.vehicleSpeed;
  }

  updateFog(): void {
    this.fog.beginUpdate();
    const mul = this.visionMul();
    for (const e of this.entities.values()) {
      if (e.dead) continue;
      this.fog.reveal(e.team, e.x, e.y, this.visionOf(e, mul));
    }
    for (const pt of this.points)
      if (pt.team !== null) this.fog.reveal(pt.team, pt.x, pt.y, BALANCE.pointVision);
    this.fog.endUpdate();
  }

  private cleanup(): void {
    for (const [id, e] of this.entities) if (e.dead && this.tick % 200 === 0) this.entities.delete(id);
  }

  private checkVictory(): void {
    const s = this.survival;
    for (const p of this.players) {
      if (p.defeated) continue;
      if (p.raider) {
        // The wave attacker is beaten once every wave has entered and been destroyed.
        if (s && s.wave >= s.total && this.playerUnits(p.id).length === 0) {
          p.defeated = true;
          this.emit({ type: 'playerDefeated', player: p.id });
        }
        continue;
      }
      const blds = this.playerBuildings(p.id);
      const units = this.playerUnits(p.id);
      let lost = blds.length === 0 && units.length === 0;
      if (!lost && blds.length === 0 && units.every((u) => !u.def.weapon)) lost = true;
      if (this.mission === 'decapitation' && !blds.some((b) => b.type === 'headquarters')) lost = true;
      if (lost) {
        p.defeated = true;
        for (const e of [...blds, ...units]) this.destroy(e);
        this.emit({ type: 'playerDefeated', player: p.id });
      }
    }
    if (this.mission === 'ctf') {
      const winner = [...this.captures].find(([, v]) => v >= BALANCE.ctfCaptures);
      if (winner) {
        this.winningTeam = winner[0];
        this.emit({ type: 'gameOver', winningTeam: winner[0] });
        return;
      }
    }
    if (this.mission === 'domination') {
      for (const pt of this.points)
        if (pt.team !== null)
          this.scores.set(pt.team, (this.scores.get(pt.team) ?? 0) + BALANCE.dominationRate);
      const leader = [...this.scores].find(([, v]) => v >= BALANCE.dominationTarget);
      if (leader) {
        this.winningTeam = leader[0];
        this.emit({ type: 'gameOver', winningTeam: leader[0] });
        return;
      }
    }
    const aliveTeams = new Set(this.players.filter((p) => !p.defeated).map((p) => p.team));
    if (aliveTeams.size <= 1) {
      this.winningTeam = aliveTeams.size === 1 ? [...aliveTeams][0] : -1;
      this.emit({ type: 'gameOver', winningTeam: this.winningTeam });
    }
  }
}

