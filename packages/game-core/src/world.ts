import type {
  BuildingTypeId,
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
} from '@shadow-front/shared-types';
import {
  BALANCE,
  BUILDINGS,
  FACTIONS,
  PLAYER_COLORS,
  RESEARCH_EFFECTS,
  SURVIVAL,
  UNITS,
  getMap,
  mulberry32,
} from '@shadow-front/game-data';
import { NavGrid } from './grid';
import { FogOfWar } from './fog';
import { SpatialHash } from './spatial';
import type { Building, ControlPoint, Entity, Player, Projectile, SurvivalState, Unit } from './types';
import { executeCommand } from './commands';
import { updateEconomy, updatePower, updateConstruction, updateProduction } from './systems/economy';
import { updateMovement } from './systems/movement';
import { updateCombat, updateProjectiles } from './systems/combat';
import { updateControlPoints } from './systems/points';
import { updateRepair, updateResearch } from './systems/research';
import { updateWaves } from './systems/waves';

export class World {
  readonly map: MapDef;
  readonly grid: NavGrid;
  readonly fog: FogOfWar;
  readonly spatial: SpatialHash;
  readonly mission: MissionType;
  readonly players: Player[] = [];
  readonly entities = new Map<EntityId, Entity>();
  projectiles: Projectile[] = [];
  /** Remaining credits in each ore tile (0 for non-ore tiles). */
  readonly oreRemaining: Float32Array;
  readonly rng: () => number;
  tick = 0;
  winningTeam: TeamId | null = null;
  private nextId = 1;
  private pendingEvents: GameEvent[] = [];
  /** Capturable strategic points from the map. */
  readonly points: ControlPoint[];
  /** Survival mode state (null in other missions). */
  readonly survival: SurvivalState | null = null;

  constructor(config: MatchConfig) {
    this.map = getMap(config.mapId);
    this.mission = config.mission;
    this.rng = mulberry32(config.seed);
    this.grid = new NavGrid(this.map);
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
      let color = FACTIONS[slot.faction].color;
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
        spawnIndex: i,
        stats: {
          unitsBuilt: 0,
          unitsLost: 0,
          buildingsBuilt: 0,
          buildingsLost: 0,
          kills: 0,
          creditsEarned: 0,
          creditsSpent: 0,
        },
        lastUnderAttackTick: -1000,
        researched: [],
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
      },
      lastUnderAttackTick: -1000,
      researched: [],
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
    const vehicle = def.category === 'armored' || def.category === 'artillery';
    const armor = vehicle && this.hasResearch(owner, 'composite-armor') ? RESEARCH_EFFECTS.vehicleHp : 1;
    const optics = this.hasResearch(owner, 'advanced-optics') ? RESEARCH_EFFECTS.vision : 1;
    const hp = Math.round(def.hp * mods.unitHp * armor);
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
      damageMul: mods.damage[def.category] ?? 1,
      cooldown: 0,
      targetId: null,
      turretFacing: Math.PI / 4,
      facing: Math.PI / 4,
      vision: def.vision * mods.vision * optics,
      lastFiredTick: -100,
      air: def.category === 'air',
      speed: def.speed * mods.speed * (vehicle ? mods.vehicleSpeed : 1),
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
    };
    this.entities.set(u.id, u);
    return u;
  }

  createBuilding(owner: PlayerId, type: BuildingTypeId, tx: number, ty: number, complete: boolean): Building {
    const def = BUILDINGS[type];
    const p = this.players[owner];
    const mods = FACTIONS[p.faction].modifiers;
    const maxHp = Math.round(def.hp * mods.buildingHp);
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
      rallyX: tx + def.w / 2 + 1,
      rallyY: ty + def.h + 1.5,
      oreTiles: [],
      research: null,
      repairing: false,
    };
    if (def.needsOre) b.oreTiles = this.oreTilesNear(b.x, b.y);
    this.entities.set(b.id, b);
    this.grid.setOccupied(tx, ty, def.w, def.h, b.id);
    this.evictUnitsFrom(b);
    return b;
  }

  /** Pushes ground units out of a newly placed footprint. */
  private evictUnitsFrom(b: Building): void {
    for (const e of this.entities.values()) {
      if (e.kind !== 'unit' || e.air || e.dead) continue;
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
      }
    }
    this.emit({ type: 'researchComplete', player: pid, research: id });
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
    if (e.kind === 'building') {
      // A building is seen if any tile of its footprint is visible.
      for (let j = e.ty; j < e.ty + e.h; j++)
        for (let i = e.tx; i < e.tx + e.w; i++) if (this.fog.isVisible(team, i + 0.5, j + 0.5)) return true;
      return false;
    }
    return this.fog.isVisible(team, e.x, e.y);
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
  placementError(pid: PlayerId, type: BuildingTypeId, tx: number, ty: number): string | null {
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
    let near = false;
    for (const b of this.playerBuildings(pid)) {
      if (Math.hypot(b.x - cx, b.y - cy) <= BALANCE.buildRadius + Math.max(b.w, b.h) / 2) {
        near = true;
        break;
      }
    }
    if (!near) return 'Too far from your base';
    if (def.needsOre) {
      const ore = this.oreTilesNear(cx, cy).reduce((s, i) => s + this.oreRemaining[i], 0);
      if (ore <= 0) return 'Must be placed next to an ore field';
    }
    return null;
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

  damage(target: Entity, amount: number, attacker: PlayerId): void {
    if (target.dead || amount <= 0) return;
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
    }
  }

  destroy(e: Entity): void {
    if (e.dead) return;
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
    if (this.tick % 10 === 0) updateControlPoints(this);
    updateWaves(this);

    if (this.tick % BALANCE.fogInterval === 0) this.updateFog();
    if (this.tick % 20 === 0) {
      this.checkVictory();
      this.cleanup();
    }
  }

  updateFog(): void {
    this.fog.beginUpdate();
    for (const e of this.entities.values()) {
      if (e.dead) continue;
      this.fog.reveal(e.team, e.x, e.y, e.vision);
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
    const aliveTeams = new Set(this.players.filter((p) => !p.defeated).map((p) => p.team));
    if (aliveTeams.size <= 1) {
      this.winningTeam = aliveTeams.size === 1 ? [...aliveTeams][0] : -1;
      this.emit({ type: 'gameOver', winningTeam: this.winningTeam });
    }
  }
}
