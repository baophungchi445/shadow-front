import type { ArmorClass, BuildingTypeId, PlayerId, TeamId, UnitTypeId } from '@shadow-front/shared-types';
import {
  BUILDINGS,
  RESEARCH,
  RESEARCH_IDS,
  DIFFICULTY,
  PERSONALITIES,
  UNITS,
  availableTo,
  factionBuilding,
  mulberry32,
  unitUpgradeCost,
  type DifficultyProfile,
  type PersonalityProfile,
} from '@shadow-front/game-data';
import type { Building, Unit, World } from '@shadow-front/game-core';
import { findExtractorSite, findPlacement } from './placement';

export type AIState = 'opening' | 'buildup' | 'attack' | 'defend';

/** Buildings an under-defended commander may still place (economy, power, production). */
const ESSENTIAL = new Set<BuildingTypeId>([
  'power-plant',
  'resource-extractor',
  'barracks',
  'war-factory',
  'defense-turret',
  'bunker',
]);

/** A team-wide call posted by one AI commander for its allies (attack target / base under attack). */
interface TeamCall {
  x: number;
  y: number;
  tick: number;
  from: PlayerId;
}

/** Allied AI commanders coordinate through these per-world boards (team id → latest call). */
const attackCalls = new WeakMap<World, Map<TeamId, TeamCall>>();
const helpCalls = new WeakMap<World, Map<TeamId, TeamCall>>();

function board(store: WeakMap<World, Map<TeamId, TeamCall>>, w: World): Map<TeamId, TeamCall> {
  let m = store.get(w);
  if (!m) store.set(w, (m = new Map()));
  return m;
}

interface Squad {
  ids: Set<number>;
  startHp: number;
  target: { x: number; y: number } | null;
  /** Infantry are boarding the squad's APCs until this tick; the APCs wait for them. */
  mountUntil?: number;
}

interface KnownBuilding {
  id: number;
  x: number;
  y: number;
  type: BuildingTypeId;
}

/**
 * AI Commander for one player.
 *
 * Strategy FSM (opening → buildup ↔ attack / defend) + utility-scored production.
 * It only perceives enemies through the team's fog of war and only acts via `world.issue()`,
 * so it pays the same costs and obeys the same rules as a human player.
 */
export class AICommander {
  readonly diff: DifficultyProfile;
  readonly pers: PersonalityProfile;
  state: AIState = 'opening';
  private readonly rnd: () => number;
  private readonly known = new Map<number, KnownBuilding>();
  private readonly seenArmor: Record<ArmorClass, number> = {
    infantry: 0,
    light: 0,
    heavy: 0,
    air: 0,
    building: 0,
  };
  private lastBuildTick = -10000;
  /** Decaying estimate of the largest enemy army value seen (credits). */
  private enemyArmy = 0;
  /** Share of armored (light / heavy) units among the enemies currently attacking our base (0..1). */
  private threatArmor = 0;
  private scoutId: number | null = null;
  private scoutTargets: { x: number; y: number }[] = [];
  private squads: Squad[] = [];
  private lastAttackTick = 0;
  private lastHelpTick = -10000;
  private lastSmokeTick = -10000;
  /** Forward-base expansion: where the Mobile Command Vehicle is heading. */
  private expansionTarget: { x: number; y: number } | null = null;
  /** Transport-helicopter drop raid: target and the tick loading started. */
  private drop: { heli: number; loadTick: number; target: { x: number; y: number } | null } | null = null;
  /** Small squad sent to capture a strategic point. */
  private captureIds: number[] = [];
  private captureTarget: number | null = null;
  /** Capture the Flag raid squad. */
  private flagRaid: number[] = [];
  /** Set once the personality build order has been completed. */
  private openingDone = false;
  /** Debug/telemetry: last decision made, shown in dev overlay. */
  lastDecision = '';

  constructor(
    private readonly world: World,
    readonly playerId: PlayerId,
  ) {
    const p = world.players[playerId];
    this.diff = DIFFICULTY[p.difficulty ?? 'normal'];
    this.pers = PERSONALITIES[p.personality ?? 'warlord'];
    this.rnd = mulberry32((world.seed ^ 0x5eed) + playerId * 7919);
    // Spawn locations are public map knowledge (like reading the map before a match).
    const own = world.map.spawns[p.spawnIndex];
    this.scoutTargets = world.map.spawns
      .filter((s) => s !== own)
      .map((s) => ({ x: s.tx + 1.5, y: s.ty + 1.5 }))
      .sort((a, b) => Math.hypot(a.x - own.tx, a.y - own.ty) - Math.hypot(b.x - own.tx, b.y - own.ty));
  }

  private get player() {
    return this.world.players[this.playerId];
  }

  /** Call once per simulation tick. Decisions run every `thinkInterval` ticks. */
  update(): void {
    if (this.player.defeated || this.world.winningTeam !== null) return;
    if ((this.world.tick + this.playerId * 3) % this.diff.thinkInterval !== 0) return;
    this.perceive();
    this.manageBase();
    this.manageProduction();
    this.manageArmy();
    this.manageTech();
    this.manageExpansion();
  }

  // ------------------------------------------------------------ expansion (Mobile Command Vehicle)

  /**
   * Hard / Insane non-rush commanders open one forward base after minute 10: build a Mobile Command Vehicle,
   * drive it to the nearest free ore field away from both bases, deploy it and put extractors there.
   */
  /** A completed forward HQ with fewer than 2 extractors and free ore nearby (credits are saved for it). */
  private forwardBaseNeedingOre(): Building | null {
    const w = this.world;
    const blds = w.playerBuildings(this.playerId);
    for (const fwd of blds.filter((b) => b.type === 'headquarters' && b.complete).slice(1)) {
      const near = blds.filter(
        (b) => b.type === 'resource-extractor' && Math.hypot(b.x - fwd.x, b.y - fwd.y) < 12,
      );
      if (near.length < 2 && findExtractorSite(w, this.playerId, fwd)) return fwd;
    }
    return null;
  }

  /** True while the commander is saving up for a Mobile Command Vehicle (see manageExpansion). */
  private wantsExpansion(): boolean {
    const w = this.world;
    const p = this.player;
    if (p.difficulty !== 'hard' && p.difficulty !== 'insane') return false;
    if (this.pers.economyCap || w.survival || w.tick < 20 * 60 * 10 || this.state === 'defend') return false;
    const blds = w.playerBuildings(this.playerId);
    if (blds.filter((b) => b.type === 'headquarters').length !== 1) return false;
    if (
      blds.some((b) => b.queue.includes('mcv')) ||
      w.playerUnits(this.playerId).some((u) => u.type === 'mcv')
    )
      return false;
    return (
      this.count('resource-extractor') >= 2 &&
      w.requirementsMet(this.playerId, UNITS.mcv.requires) &&
      !this.underDefended()
    );
  }

  private manageExpansion(): void {
    const w = this.world;
    const p = this.player;
    if (p.difficulty !== 'hard' && p.difficulty !== 'insane') return;
    if (this.pers.economyCap || w.survival || w.tick < 20 * 60 * 10) return;
    const hqs = w.playerBuildings(this.playerId).filter((b) => b.type === 'headquarters');
    if (!hqs.length || hqs.length >= 2) return;
    const mcv = w.playerUnits(this.playerId).find((u) => u.type === 'mcv');
    if (!mcv) {
      if (!this.wantsExpansion() || p.credits < UNITS.mcv.cost) return;
      const blds = w.playerBuildings(this.playerId);
      const factory = blds.find((b) => b.type === 'war-factory' && b.complete && b.queue.length < 2);
      if (
        factory &&
        w.issue({ type: 'produce', player: this.playerId, producer: factory.id, unit: 'mcv' }).ok
      )
        this.lastDecision = 'produce mcv (expansion)';
      return;
    }
    if (!this.expansionTarget) this.expansionTarget = this.pickExpansionSite(hqs[0]);
    const t = this.expansionTarget;
    if (!t) return;
    const d = Math.hypot(mcv.x - t.x, mcv.y - t.y);
    if (d < 1.2 || (!mcv.moving && d < 4)) {
      if (w.issue({ type: 'deploy', player: this.playerId, unit: mcv.id }).ok) {
        this.lastDecision = 'deploy forward base';
        this.expansionTarget = null;
      } else {
        // Blocked (units, new buildings): look for another spot next time.
        this.expansionTarget = this.pickExpansionSite(hqs[0], t);
      }
      return;
    }
    if (!mcv.moving || mcv.order.type !== 'move') {
      w.issue({ type: 'move', player: this.playerId, units: [mcv.id], x: t.x, y: t.y });
      this.lastDecision = 'mcv to expansion';
    }
  }

  /** Centre of a free 3×3 spot 3–6 tiles from unclaimed ore, ≥ 20 tiles from our HQ and ≥ 16 from known enemies. */
  private pickExpansionSite(
    main: Building,
    avoid?: { x: number; y: number },
  ): { x: number; y: number } | null {
    const w = this.world;
    const W = w.map.width;
    const claimed = w.buildings();
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let i = 0; i < w.oreRemaining.length; i += 1) {
      if (w.oreRemaining[i] <= 0) continue;
      const x = (i % W) + 0.5;
      const y = Math.floor(i / W) + 0.5;
      const d = Math.hypot(x - main.x, y - main.y);
      if (d < 20) continue;
      if (claimed.some((b) => Math.hypot(b.x - x, b.y - y) < 10)) continue;
      if ([...this.known.values()].some((k) => Math.hypot(k.x - x, k.y - y) < 16)) continue;
      if (avoid && Math.hypot(avoid.x - x, avoid.y - y) < 4) continue;
      candidates.push({ x, y, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates.slice(0, 20)) {
      for (let r = 3; r <= 6; r++)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const cx = Math.floor(c.x + Math.cos(a) * r) + 0.5;
          const cy = Math.floor(c.y + Math.sin(a) * r) + 0.5;
          const tx = Math.round(cx - 1.5);
          const ty = Math.round(cy - 1.5);
          if (w.placementError(this.playerId, 'headquarters', tx, ty, true) === null) return { x: cx, y: cy };
        }
    }
    return null;
  }

  // ------------------------------------------------------------ perception

  private perceive(): void {
    const team = this.player.team;
    // The estimate halves in about 2 minutes without new sightings.
    this.enemyArmy *= Math.pow(0.5, this.diff.thinkInterval / 2400);
    let seen = 0;
    for (const e of this.world.visibleEnemies(team)) {
      if (e.kind === 'unit' && e.def.weapon) seen += e.def.cost;
      if (e.kind === 'building') this.known.set(e.id, { id: e.id, x: e.x, y: e.y, type: e.type });
      else this.seenArmor[e.def.armor] = this.seenArmor[e.def.armor] * 0.98 + 1;
    }
    this.enemyArmy = Math.max(this.enemyArmy, seen);
    // Forget remembered buildings whose location is visible again but which are gone.
    for (const [id, k] of this.known) {
      if (this.world.fog.isVisible(team, k.x, k.y) && !this.world.get(id)) this.known.delete(id);
    }
  }

  // ------------------------------------------------------------ base building

  private hq(): Building | undefined {
    const blds = this.world.playerBuildings(this.playerId);
    return blds.find((b) => b.type === 'headquarters') ?? blds[0];
  }

  private count(type: BuildingTypeId): number {
    return this.world.playerBuildings(this.playerId).filter((b) => b.type === type).length;
  }

  private nextBuilding(): BuildingTypeId | null {
    const p = this.player;
    const consumingSoon = 40;
    if (
      p.powerProduced - p.powerUsed < (this.state === 'opening' ? 0 : consumingSoon) &&
      this.count('power-plant') < 8
    )
      return 'power-plant';
    const tally = new Map<BuildingTypeId, number>();
    for (const t of this.pers.buildOrder) {
      const need = (tally.get(t) ?? 0) + 1;
      tally.set(t, need);
      if (this.count(t) < need) return t;
    }
    if (!this.openingDone) {
      this.openingDone = true;
      if (this.state === 'opening') this.state = 'buildup';
    }
    const maxExtractors = Math.min(this.diff.maxExtractors, this.pers.economyCap ?? Infinity);
    if (this.count('resource-extractor') < maxExtractors) return 'resource-extractor';
    const defenses = this.count('defense-turret') + this.count('sam-site');
    if (defenses < this.pers.defenses)
      return this.seenArmor.air > 2 && this.count('sam-site') <= this.count('defense-turret')
        ? 'sam-site'
        : 'defense-turret';
    if (this.seenArmor.air > 3 && this.count('sam-site') < 2) return 'sam-site';
    if (this.count('war-factory') < 1) return 'war-factory';
    // The faction's own building (two derricks for the Desert Corps: they are its extra economy).
    const own = factionBuilding(this.player.faction);
    if (
      own &&
      this.count(own) < (own === 'oil-derrick' ? 2 : 1) &&
      this.world.requirementsMet(this.playerId, BUILDINGS[own].requires)
    )
      return own;
    // Defensive personalities hold the approach with an infantry bunker.
    if (
      this.pers.defenses >= 2 &&
      this.count('bunker') < 1 &&
      this.world.hasCompleted(this.playerId, 'barracks')
    )
      return 'bunker';
    if (this.diff.maxProducers >= 3 && this.count('research-center') < 1) return 'research-center';
    // Defensive personalities add a long-range missile battery once they can.
    if (
      this.pers.defenses >= 2 &&
      this.count('missile-launcher') < 1 &&
      this.world.hasCompleted(this.playerId, 'research-center')
    )
      return 'missile-launcher';
    if (this.diff.maxProducers >= 3 && this.count('radar-station') < 1) return 'radar-station';
    if (
      this.diff.maxProducers >= 3 &&
      this.count('airfield') < 1 &&
      this.pers.unitWeights['attack-helicopter']
    )
      return 'airfield';
    return null;
  }

  private manageBase(): void {
    const w = this.world;
    const blds = w.playerBuildings(this.playerId);
    if (blds.some((b) => !b.complete)) return; // One construction at a time, like a human.
    if (w.tick - this.lastBuildTick < this.diff.buildDelay) return;
    // A forward base (deployed MCV) gets its own extractors first.
    const fwd = this.forwardBaseNeedingOre();
    if (fwd) {
      this.tryBuild('resource-extractor', fwd);
      return;
    }
    const next = this.nextBuilding();
    const hq = this.hq();
    if (!next || !hq) return;
    // Under-defended: only economy / production buildings until a minimal army stands.
    if (this.underDefended() && !ESSENTIAL.has(next)) return;
    const def = BUILDINGS[next];
    if (!w.requirementsMet(this.playerId, def.requires)) {
      // Build the missing prerequisite first.
      const missing = def.requires.find((r) => !w.hasCompleted(this.playerId, r) && this.count(r) === 0);
      if (missing) this.tryBuild(missing, hq);
      return;
    }
    this.tryBuild(next, hq);
  }

  private tryBuild(type: BuildingTypeId, hq: Building): void {
    const w = this.world;
    if (this.player.credits < BUILDINGS[type].cost) return;
    let spot: { tx: number; ty: number } | null;
    if (type === 'resource-extractor') {
      spot = findExtractorSite(w, this.playerId, hq);
    } else {
      // Defenses go toward the map centre (the likely attack direction); others cluster around the HQ.
      const toward = BUILDINGS[type].weapon ? 5 : 0;
      const dx = Math.sign(w.map.width / 2 - hq.x) * toward;
      const dy = Math.sign(w.map.height / 2 - hq.y) * toward;
      spot = findPlacement(
        w,
        this.playerId,
        type,
        hq.x + dx + (this.rnd() - 0.5) * 2,
        hq.y + dy + (this.rnd() - 0.5) * 2,
      );
    }
    if (!spot) return;
    // Producers face the middle of the map so new units come out toward the front (v0.12).
    const dx = w.map.width / 2 - (spot.tx + BUILDINGS[type].w / 2);
    const dy = w.map.height / 2 - (spot.ty + BUILDINGS[type].h / 2);
    const facing = BUILDINGS[type].produces
      ? Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 1
          : 3
        : dy > 0
          ? 0
          : 2
      : 0;
    const res = w.issue({
      type: 'build',
      player: this.playerId,
      building: type,
      tx: spot.tx,
      ty: spot.ty,
      facing,
    });
    if (res.ok) {
      this.lastBuildTick = w.tick;
      this.lastDecision = `build ${type}`;
    }
  }

  // ------------------------------------------------------------ production

  /**
   * Value of the standing army every commander keeps before spending on tech, upgrades and extra buildings
   * (counters early rushes; checked from minute 2).
   */
  private minArmy(): number {
    return this.diff.attackValue * Math.min(0.8, Math.max(0.35, this.world.tick / 9000));
  }

  private underDefended(): boolean {
    if (this.world.tick <= 2400 || this.world.survival) return false;
    return this.armyValue(this.army()) < Math.max(this.minArmy(), this.enemyArmy * 0.8);
  }

  private reserve(): number {
    if (this.state === 'defend' || this.underDefended()) return 0;
    if (this.wantsExpansion()) return UNITS.mcv.cost;
    if (this.forwardBaseNeedingOre()) return BUILDINGS['resource-extractor'].cost;
    const next = this.nextBuilding();
    if (!next) return 0;
    // During the opening always save for the build order; afterwards only once the
    // next building has been postponed for 30 s, so the army is not starved.
    if (!this.openingDone || this.world.tick - this.lastBuildTick > 600) return BUILDINGS[next].cost;
    return 0;
  }

  private unitScore(type: UnitTypeId): number {
    const def = UNITS[type];
    // Faction-specific units are the faction's signature: every personality likes them.
    let s = this.pers.unitWeights[type] ?? (def.faction ? 2 : 0.3);
    if (def.deploysTo) return -1; // forward bases are a human tool for now
    // Pure anti-air (Fighter Jet) only once enemy aircraft have been seen.
    if (def.weapon && !def.weapon.canTargetGround && this.seenArmor.air < 2) return -1;
    if (def.transport && !def.weapon) {
      // Air-minded commanders keep one transport helicopter for infantry drop raids.
      if (
        !this.pers.unitWeights['attack-helicopter'] ||
        this.player.difficulty === 'easy' ||
        this.world.survival
      )
        return -1;
      const have = this.world.playerUnits(this.playerId).some((u) => u.type === type);
      if (have || this.army().length < 8) return -1;
      return this.rnd() < 0.2 ? 100 : -1;
    }
    if (def.support) {
      // At most a couple of medics / engineers, and only once there is an army to support.
      const have = this.world.playerUnits(this.playerId).filter((u) => u.type === type).length;
      if (have >= 2 || this.army().length < 6) return -1;
      return this.rnd() < 0.15 ? 100 : -1; // occasionally, so they never crowd out combat units
    }
    // Every difficulty answers armor that is attacking its base with anti-armor weapons (rifles barely scratch tanks).
    if (this.state === 'defend' && this.threatArmor > 0 && def.weapon) {
      const w = def.weapon;
      if (w.type === 'rocket' || w.type === 'shell') s += 4 * this.threatArmor;
      else if (w.type === 'bullet') s -= 2 * this.threatArmor;
    }
    if (this.diff.counters) {
      const total = Math.max(
        1,
        this.seenArmor.infantry + this.seenArmor.light + this.seenArmor.heavy + this.seenArmor.air,
      );
      const inf = this.seenArmor.infantry / total;
      const heavy = (this.seenArmor.heavy + this.seenArmor.light * 0.5) / total;
      const air = this.seenArmor.air / total;
      const w = UNITS[type].weapon;
      if (w) {
        if (w.type === 'bullet' || w.type === 'artillery') s += inf * 3;
        if (w.type === 'rocket' || w.type === 'shell') s += heavy * 3;
        if (w.canTargetAir) s += air * 4;
      }
    }
    if (!def.weapon) s *= this.scoutId === null && this.known.size === 0 ? 1 : 0.1;
    return s * (0.75 + this.rnd() * 0.5);
  }

  /** Army value at which an attack is launched. */
  private attackThreshold(): number {
    return this.diff.attackValue * this.pers.aggression;
  }

  /** Earliest tick for the first attack; personalities scale it (RUSH earlier, FORTRESS later). */
  private firstAttackTick(): number {
    return this.diff.firstAttackTick * Math.min(1.4, Math.max(0.75, this.pers.aggression));
  }

  private manageProduction(): void {
    const w = this.world;
    // While the first attack is still held back, do not build a "deathball": stop adding combat units once the
    // army is 1.5× the attack threshold (credits are kept for later). Defence always overrides this.
    if (
      this.state !== 'defend' &&
      w.tick < this.firstAttackTick() &&
      this.armyValue(this.army()) >= this.attackThreshold() * (this.pers.aggression < 1 ? 1.25 : 1.5)
    ) {
      this.lastDecision = 'holding production until first attack';
      return;
    }
    const producers = w
      .playerBuildings(this.playerId)
      .filter((b) => b.complete && b.def.produces)
      .slice(0, this.diff.maxProducers);
    for (const b of producers) {
      if (b.queue.length >= 2) continue;
      const options = (Object.keys(UNITS) as UnitTypeId[]).filter(
        (t) =>
          UNITS[t].producedBy === b.type &&
          availableTo(t, this.player.faction) &&
          w.requirementsMet(this.playerId, UNITS[t].requires),
      );
      if (!options.length) continue;
      let best: UnitTypeId | null = null;
      let bestS = -Infinity;
      for (const t of options) {
        const s = this.unitScore(t);
        if (s > bestS) {
          bestS = s;
          best = t;
        }
      }
      if (!best || bestS < 0) continue;
      if (w.overCap(this.playerId, best)) {
        this.lastDecision = 'at unit limit';
        continue;
      }
      if (this.player.credits - w.unitCost(this.playerId, best) < this.reserve()) continue;
      const res = w.issue({ type: 'produce', player: this.playerId, producer: b.id, unit: best });
      if (res.ok) this.lastDecision = `produce ${best}`;
      // Gather produced units in front of the base.
      const hq = this.hq();
      if (hq) {
        const gx = hq.x + Math.sign(w.map.width / 2 - hq.x) * 6;
        const gy = hq.y + Math.sign(w.map.height / 2 - hq.y) * 6;
        if (Math.hypot(b.rallyX - gx, b.rallyY - gy) > 0.5)
          w.issue({ type: 'rally', player: this.playerId, producer: b.id, x: gx, y: gy });
      }
    }
  }

  // ------------------------------------------------------------ army

  private army(): Unit[] {
    return this.world.playerUnits(this.playerId).filter((u) => u.def.weapon && u.id !== this.scoutId);
  }

  private armyValue(units: Unit[]): number {
    return units.reduce((s, u) => s + u.def.cost * (u.hp / u.maxHp), 0);
  }

  /** Ids of our infantry currently riding in transports (they are out of the world while inside). */
  private carried(): Set<number> {
    const out = new Set<number>();
    for (const e of [...this.world.playerUnits(this.playerId), ...this.world.playerBuildings(this.playerId)])
      for (const p of e.passengers) out.add(p.id);
    return out;
  }

  /** Our units currently walking to board `carrier`. */
  private boardingInto(carrier: number): Unit[] {
    return this.world
      .playerUnits(this.playerId)
      .filter((u) => u.order.type === 'board' && u.order.carrier === carrier);
  }

  private manageArmy(): void {
    const w = this.world;
    const team = this.player.team;
    const carried = this.carried();
    const army = this.army();
    const inSquad = new Set<number>();
    for (const sq of this.squads) for (const id of sq.ids) inSquad.add(id);
    this.captureIds = this.captureIds.filter((id) => w.get(id));
    for (const id of this.captureIds) inSquad.add(id);
    for (const id of this.flagRaid) inSquad.add(id);
    // Units walking into a bunker / transport are spoken for.
    const home = army.filter((u) => !inSquad.has(u.id) && u.order.type !== 'board');

    // 1. Defend: visible enemies close to any of our buildings.
    const blds = w.playerBuildings(this.playerId);
    const threats = w
      .visibleEnemies(team)
      .filter((e) => blds.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < 14));
    const armored = threats.filter(
      (e) => e.kind === 'unit' && (e.def.armor === 'heavy' || e.def.armor === 'light'),
    );
    this.threatArmor = threats.length ? armored.length / threats.length : 0;
    if (threats.length) {
      this.state = 'defend';
      const cx = threats.reduce((s, e) => s + e.x, 0) / threats.length;
      const cy = threats.reduce((s, e) => s + e.y, 0) / threats.length;
      const defenders = home.filter((u) => u.order.type !== 'attack' && u.targetId === null);
      if (defenders.length)
        w.issue({
          type: 'move',
          player: this.playerId,
          units: defenders.map((u) => u.id),
          x: cx,
          y: cy,
          attackMove: true,
        });
      // Ask allied commanders for help against a real assault.
      if (threats.length >= 3)
        board(helpCalls, w).set(team, { x: cx, y: cy, tick: w.tick, from: this.playerId });
      this.lastDecision = `defend (${threats.length} threats)`;
    } else if (this.state === 'defend') {
      this.state = 'buildup';
    }

    // 1b. Help an ally whose base is under attack (half of the idle home army).
    this.answerHelp(home);

    // 1c. Keep bunkers manned.
    this.manageGarrison(home);

    // 2. Scout until an enemy base is known.
    this.manageScout();

    // 2b. Take strategic points (income + vision).
    this.manageCapture(home);

    // 2c. Capture the Flag: raid the enemy flag, bring it home, chase whoever took ours.
    if (w.flags.length) this.manageFlags(home);

    // 2d. Transport-helicopter drop raid on the enemy economy.
    this.manageDrop(home);

    // 3. Maintain attack squads.
    this.squads = this.squads.filter((sq) => {
      for (const id of [...sq.ids]) if (!w.get(id) && !carried.has(id)) sq.ids.delete(id);
      const units = [...sq.ids].map((id) => w.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit');
      if (!units.length) return false;
      const hp = units.reduce((s, u) => s + u.hp, 0);
      if (this.diff.retreats && hp < sq.startHp * 0.35) {
        w.issue({ type: 'retreat', player: this.playerId, units: units.map((u) => u.id) });
        this.lastDecision = 'retreat';
        return false;
      }
      // Mounting: APCs wait for their passengers; stragglers are released when time runs out.
      if (sq.mountUntil !== undefined) {
        const boarding = units.filter((u) => u.order.type === 'board');
        if (boarding.length && w.tick < sq.mountUntil) return true;
        if (boarding.length)
          w.issue({ type: 'stop', player: this.playerId, units: boarding.map((u) => u.id) });
        sq.mountUntil = undefined;
        sq.target = null; // forces a fresh move order for everyone
      }
      const target = this.pickTarget(units[0]);
      if (!target) return true;
      // Infantry pinned under defensive fire hide in a smoke screen (one grenade every 15 s).
      if (w.tick - this.lastSmokeTick > 300) {
        const hurt = units.filter((u) => u.def.category === 'infantry' && u.hp < u.maxHp * 0.6);
        const guns = w
          .visibleEnemies(team)
          .filter(
            (e) =>
              e.kind === 'building' && e.def.weapon && hurt.some((u) => Math.hypot(u.x - e.x, u.y - e.y) < 9),
          );
        if (hurt.length >= 2 && guns.length) {
          const cx = hurt.reduce((s, u) => s + u.x, 0) / hurt.length;
          const cy = hurt.reduce((s, u) => s + u.y, 0) / hurt.length;
          if (
            w.issue({ type: 'smoke', player: this.playerId, units: units.map((u) => u.id), x: cx, y: cy }).ok
          ) {
            this.lastSmokeTick = w.tick;
            this.lastDecision = 'smoke screen';
          }
        }
      }
      // Loaded APCs drop their infantry once the fight is near.
      for (const u of units) {
        if (!u.passengers.length) continue;
        const close =
          Math.hypot(u.x - target.x, u.y - target.y) < 7 ||
          w.visibleEnemies(team).some((e) => Math.hypot(e.x - u.x, e.y - u.y) < 7);
        if (close && w.issue({ type: 'unload', player: this.playerId, carrier: u.id }).ok)
          this.lastDecision = 'unload APC';
      }
      const idle = units.filter((u) => u.order.type === 'idle' && u.targetId === null);
      if (idle.length || !sq.target || Math.hypot(sq.target.x - target.x, sq.target.y - target.y) > 3) {
        const ids = (idle.length && sq.target ? idle : units).map((u) => u.id);
        sq.target = target;
        w.issue({
          type: 'move',
          player: this.playerId,
          units: ids,
          x: target.x,
          y: target.y,
          attackMove: true,
        });
      }
      return true;
    });
    if (!this.squads.length && this.state === 'attack') this.state = 'buildup';

    // 4. Launch a new attack when strong enough and the enemy is known — or join an ally's attack.
    const threshold = this.attackThreshold();
    const firstAttack = this.firstAttackTick();
    const call = board(attackCalls, w).get(team);
    const joinAlly =
      !!call &&
      call.from !== this.playerId &&
      w.tick - call.tick < 300 &&
      call.tick > this.lastAttackTick &&
      w.tick >= firstAttack * 0.8 &&
      this.armyValue(home) >= threshold * 0.5;
    if (
      // Survival: the attacker has no base, so allied AIs hold and defend instead of raiding.
      !w.survival &&
      this.state !== 'defend' &&
      w.tick - this.lastAttackTick > this.diff.attackCooldown &&
      ((w.tick >= firstAttack && this.armyValue(home) >= threshold) || joinAlly)
    ) {
      const target =
        joinAlly && call ? { x: call.x, y: call.y } : home.length ? this.pickTarget(home[0]) : null;
      if (target && home.length) this.launchAttack(home, target, joinAlly);
    }
  }

  private launchAttack(home: Unit[], target: { x: number; y: number }, joined: boolean): void {
    const w = this.world;
    this.state = 'attack';
    this.lastAttackTick = w.tick;
    if (!joined)
      board(attackCalls, w).set(this.player.team, {
        x: target.x,
        y: target.y,
        tick: w.tick,
        from: this.playerId,
      });
    const groups =
      this.diff.multiProng && home.length >= 8 && !joined
        ? [home.filter((_, i) => i % 2 === 0), home.filter((_, i) => i % 2 === 1)]
        : [home];
    groups.forEach((g, gi) => {
      const t = gi === 0 ? target : (this.pickTarget(g[0], target) ?? target);
      const sq: Squad = {
        ids: new Set(g.map((u) => u.id)),
        startHp: g.reduce((s, u) => s + u.hp, 0),
        target: t,
      };
      // Infantry ride in the squad's APCs: they arrive together and protected.
      const waiting = new Set<number>();
      for (const apc of g.filter((u) => u.def.transport && !u.air)) {
        const free = apc.def.transport!.capacity - apc.passengers.length;
        const riders = g
          .filter((u) => u.def.category === 'infantry' && !waiting.has(u.id))
          .filter((u) => Math.hypot(u.x - apc.x, u.y - apc.y) < 12)
          .sort((a, b) => Math.hypot(a.x - apc.x, a.y - apc.y) - Math.hypot(b.x - apc.x, b.y - apc.y))
          .slice(0, free);
        if (!riders.length) continue;
        if (
          w.issue({ type: 'load', player: this.playerId, units: riders.map((u) => u.id), carrier: apc.id }).ok
        ) {
          waiting.add(apc.id);
          for (const r of riders) waiting.add(r.id);
        }
      }
      if (waiting.size) sq.mountUntil = w.tick + 120;
      this.squads.push(sq);
      const walkers = g.filter((u) => !waiting.has(u.id)).map((u) => u.id);
      if (walkers.length)
        w.issue({ type: 'move', player: this.playerId, units: walkers, x: t.x, y: t.y, attackMove: true });
    });
    this.lastDecision = `${joined ? 'join ally attack' : 'attack'} with ${home.length} units`;
  }

  /** Sends half of the idle home army to an ally's base under attack (at most once per 30 s). */
  private answerHelp(home: Unit[]): void {
    const w = this.world;
    const call = board(helpCalls, w).get(this.player.team);
    if (!call || call.from === this.playerId || w.tick - call.tick > 100) return;
    if (this.state === 'defend' || w.tick - this.lastHelpTick < 600) return;
    const hq = this.hq();
    if (!hq || Math.hypot(hq.x - call.x, hq.y - call.y) > 50) return;
    const free = home.filter((u) => u.order.type === 'idle' && u.targetId === null);
    const helpers = free.slice(0, Math.floor(free.length / 2));
    if (helpers.length < 2) return;
    this.lastHelpTick = w.tick;
    w.issue({
      type: 'move',
      player: this.playerId,
      units: helpers.map((u) => u.id),
      x: call.x,
      y: call.y,
      attackMove: true,
    });
    this.lastDecision = `help ally with ${helpers.length} units`;
  }

  /** Fills our bunkers with home infantry (cheapest first), keeping a mobile core of 4. */
  private manageGarrison(home: Unit[]): void {
    const w = this.world;
    const homeInf = home.filter((u) => u.def.category === 'infantry' && !u.def.support);
    for (const b of w.playerBuildings(this.playerId)) {
      if (!b.def.garrison || !b.complete) continue;
      const free = b.def.garrison.capacity - b.passengers.length - this.boardingInto(b.id).length;
      if (free <= 0 || homeInf.length <= 4) continue;
      const inf = homeInf
        .filter((u) => Math.hypot(u.x - b.x, u.y - b.y) < 16)
        .sort((a, c) => a.def.cost - c.def.cost)
        .slice(0, Math.min(free, homeInf.length - 4));
      if (
        inf.length &&
        w.issue({ type: 'load', player: this.playerId, units: inf.map((u) => u.id), carrier: b.id }).ok
      )
        this.lastDecision = `garrison bunker (${inf.length})`;
    }
  }

  /**
   * Transport-helicopter drop: load up to 6 infantry at home, fly to a remembered enemy extractor or power
   * plant, drop the troops a few tiles short of it and fly back. The dropped troops then fight as a squad.
   */
  private manageDrop(home: Unit[]): void {
    const w = this.world;
    const heli = w.playerUnits(this.playerId).find((u) => u.type === 'transport-helicopter');
    if (!heli) {
      this.drop = null;
      return;
    }
    if (!this.drop || this.drop.heli !== heli.id) this.drop = { heli: heli.id, loadTick: -1, target: null };
    const d = this.drop;
    const hq = this.hq();
    const cap = heli.def.transport!.capacity;
    const boarding = this.boardingInto(heli.id);
    if (!heli.passengers.length) {
      d.target = null;
      if (!hq || this.state === 'defend' || w.tick < this.firstAttackTick() || this.known.size === 0) return;
      if (Math.hypot(heli.x - hq.x, heli.y - hq.y) > 12) {
        if (!heli.moving) w.issue({ type: 'retreat', player: this.playerId, units: [heli.id] });
        return;
      }
      if (boarding.length) return;
      const inf = home.filter((u) => u.def.category === 'infantry' && !u.def.support);
      if (inf.length < 6) return;
      const riders = inf
        .sort((a, b) => Math.hypot(a.x - heli.x, a.y - heli.y) - Math.hypot(b.x - heli.x, b.y - heli.y))
        .slice(0, cap);
      if (
        w.issue({ type: 'load', player: this.playerId, units: riders.map((u) => u.id), carrier: heli.id }).ok
      ) {
        d.loadTick = w.tick;
        this.lastDecision = 'loading drop helicopter';
      }
      return;
    }
    if (!d.target) {
      // Wait for the rest of the passengers (at most 8 s), then fly.
      if (boarding.length && heli.passengers.length < cap && w.tick - d.loadTick < 160) return;
      if (boarding.length) w.issue({ type: 'stop', player: this.playerId, units: boarding.map((u) => u.id) });
      const eco = [...this.known.values()].filter(
        (k) => k.type === 'resource-extractor' || k.type === 'power-plant',
      );
      const pick = eco.sort(
        (a, b) => Math.hypot(a.x - heli.x, a.y - heli.y) - Math.hypot(b.x - heli.x, b.y - heli.y),
      )[0];
      const t = pick ? { x: pick.x, y: pick.y } : this.pickTarget(heli);
      if (!t) return;
      // Land a little short of the target, on our side of it.
      const dist = Math.max(1, Math.hypot(t.x - heli.x, t.y - heli.y));
      d.target = { x: t.x - ((t.x - heli.x) / dist) * 3, y: t.y - ((t.y - heli.y) / dist) * 3 };
      w.issue({ type: 'move', player: this.playerId, units: [heli.id], x: d.target.x, y: d.target.y });
      this.lastDecision = 'drop raid';
      return;
    }
    const arrived = Math.hypot(heli.x - d.target.x, heli.y - d.target.y) < 1.5 || !heli.moving;
    const hurt = heli.hp < heli.maxHp * 0.4;
    if (!arrived && !hurt) return;
    const ids = heli.passengers.map((p) => p.id);
    if (w.issue({ type: 'unload', player: this.playerId, carrier: heli.id }).ok) {
      const troops = ids.map((id) => w.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit');
      this.squads.push({ ids: new Set(ids), startHp: troops.reduce((s, u) => s + u.hp, 0), target: null });
      w.issue({ type: 'retreat', player: this.playerId, units: [heli.id] });
      this.lastDecision = `drop ${ids.length} infantry`;
    } else if (!heli.moving) {
      // No open ground below: drift a couple of tiles toward home and try again.
      const h = hq ?? heli;
      d.target = { x: heli.x + Math.sign(h.x - heli.x) * 2, y: heli.y + Math.sign(h.y - heli.y) * 2 };
      w.issue({ type: 'move', player: this.playerId, units: [heli.id], x: d.target.x, y: d.target.y });
    }
  }

  /** Flag positions are public (like strategic points); carriers are tracked through the flag state. */
  private manageFlags(home: Unit[]): void {
    const w = this.world;
    const team = this.player.team;
    const own = w.flags.find((f) => f.team === team);
    // A unit of ours carries an enemy flag → run home (no fighting on the way).
    for (const f of w.flags) {
      if (f.team === team || f.carrier === null || !own) continue;
      const c = w.get(f.carrier);
      if (c && c.owner === this.playerId && c.kind === 'unit') {
        const o = c.order;
        if (o.type !== 'move' || Math.hypot(o.x - own.homeX, o.y - own.homeY) > 1)
          w.issue({ type: 'move', player: this.playerId, units: [c.id], x: own.homeX, y: own.homeY });
      }
    }
    // Our flag is away from home → home units go after it.
    if (own && !own.atHome) {
      const hunters = home.filter((u) => !u.air && u.order.type !== 'attack').slice(0, 6);
      if (hunters.length)
        w.issue({
          type: 'move',
          player: this.playerId,
          units: hunters.map((u) => u.id),
          x: own.x,
          y: own.y,
          attackMove: true,
        });
    }
    // Raid squad: up to 4 ground units go for the nearest enemy flag lying on the ground.
    this.flagRaid = this.flagRaid.filter((id) => w.get(id));
    if (this.state === 'opening' || this.state === 'defend') return;
    const target = w.flags
      .filter((f) => f.team !== team && f.carrier === null)
      .sort((a, b) =>
        own ? Math.hypot(a.x - own.homeX, a.y - own.homeY) - Math.hypot(b.x - own.homeX, b.y - own.homeY) : 0,
      )[0];
    if (!target) return;
    if (this.flagRaid.length < 2) {
      const ground = home
        .filter((u) => !u.air && !this.flagRaid.includes(u.id))
        .sort((a, b) => b.speed - a.speed);
      if (ground.length >= 4)
        this.flagRaid.push(...ground.slice(0, 4 - this.flagRaid.length).map((u) => u.id));
    }
    const idle = this.flagRaid.filter((id) => {
      const u = w.get(id) as Unit;
      return (
        u.order.type === 'idle' ||
        (u.order.type === 'move' && Math.hypot(u.order.x - target.x, u.order.y - target.y) > 3)
      );
    });
    if (idle.length)
      w.issue({
        type: 'move',
        player: this.playerId,
        units: idle,
        x: target.x,
        y: target.y,
        attackMove: true,
      });
  }

  /**
   * Sends up to three ground units to capture the nearest strategic point not held by our team.
   * Point locations and flags are public map information (visible to every player).
   */
  private manageCapture(home: Unit[]): void {
    const w = this.world;
    const team = this.player.team;
    if (this.captureTarget !== null) {
      const pt = w.points[this.captureTarget];
      if (pt.team === team || this.captureIds.length === 0) {
        this.captureTarget = null;
        this.captureIds = []; // Captured (units stay as a garrison) or squad lost.
      } else {
        const idle = this.captureIds.filter((id) => (w.get(id) as Unit).order.type === 'idle');
        if (idle.length)
          w.issue({ type: 'move', player: this.playerId, units: idle, x: pt.x, y: pt.y, attackMove: true });
        return;
      }
    }
    if (this.state === 'defend' || this.state === 'opening') return;
    const owned = w.points.filter((p) => p.team === team).length;
    const limit = Math.min(
      this.player.difficulty === 'easy' ? 1 : w.points.length,
      this.pers.economyCap ?? Infinity,
    );
    const hq = this.hq();
    if (owned >= limit || !hq) return;
    const ground = home.filter((u) => !u.air);
    if (ground.length < (w.survival ? 4 : 6) || (!w.survival && this.armyValue(home) < this.minArmy()))
      return;
    const target = w.points
      .filter((p) => p.team !== team)
      .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
    if (!target) return;
    const squad = ground
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, 3);
    this.captureTarget = target.index;
    this.captureIds = squad.map((u) => u.id);
    w.issue({
      type: 'move',
      player: this.playerId,
      units: this.captureIds,
      x: target.x,
      y: target.y,
      attackMove: true,
    });
    this.lastDecision = `capture ${target.name}`;
  }

  /** Research technologies in personality order and repair damaged buildings when safe. */
  private manageTech(): void {
    const w = this.world;
    const p = this.player;
    const defended = !this.underDefended();
    if (p.difficulty !== 'easy' && this.state !== 'defend' && defended) {
      const lab = w
        .playerBuildings(this.playerId)
        .find((b) => b.type === 'research-center' && b.complete && !b.research);
      const busy = new Set(w.playerBuildings(this.playerId).map((b) => b.research?.id));
      // Personality order first, then the faction's own technology.
      const order = [
        ...this.pers.researchOrder,
        ...RESEARCH_IDS.filter((r) => RESEARCH[r].faction === p.faction),
      ];
      const next = order.find((r) => !w.hasResearch(this.playerId, r) && !busy.has(r));
      if (lab && next && p.credits >= RESEARCH[next].cost + 300) {
        if (w.issue({ type: 'research', player: this.playerId, building: lab.id, research: next }).ok)
          this.lastDecision = `research ${next}`;
      }
    }
    // Upgrade the unit type the army relies on most (4+ of them) when there is spare money.
    if (p.difficulty !== 'easy' && this.state !== 'defend' && defended) {
      const counts = new Map<UnitTypeId, number>();
      for (const u of w.playerUnits(this.playerId))
        if (u.def.weapon) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
      const best = [...counts.entries()]
        .filter(([t, n]) => n >= 4 && !w.hasUnitUpgrade(this.playerId, t))
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (best && p.credits >= unitUpgradeCost(best) + 600) {
        const producer = w
          .playerBuildings(this.playerId)
          .find((b) => b.type === UNITS[best].producedBy && b.complete && !b.unitUpgrade);
        const busy = w.playerBuildings(this.playerId).some((b) => b.unitUpgrade?.unit === best);
        if (producer && !busy)
          if (w.issue({ type: 'upgradeUnit', player: this.playerId, building: producer.id, unit: best }).ok)
            this.lastDecision = `upgrade ${best}`;
      }
    }
    // Upgrade defenses and power plants when rich (defensive personalities only).
    if (this.pers.defenses >= 1 && this.state !== 'defend' && defended) {
      const cand = w
        .playerBuildings(this.playerId)
        .find((b) => b.complete && b.def.upgrade && b.level < 2 && b.upgrading === null);
      if (cand && p.credits >= cand.def.upgrade!.cost + 800)
        if (w.issue({ type: 'upgrade', player: this.playerId, building: cand.id }).ok)
          this.lastDecision = `upgrade ${cand.type}`;
    }
    if (p.credits < 400) return;
    const enemies = w.visibleEnemies(p.team);
    for (const b of w.playerBuildings(this.playerId)) {
      if (!b.complete || b.repairing || b.hp > b.maxHp * 0.7) continue;
      if (enemies.some((e) => Math.hypot(e.x - b.x, e.y - b.y) < 9)) continue;
      w.issue({ type: 'repair', player: this.playerId, building: b.id, on: true });
    }
  }

  /** Nearest remembered enemy building (optionally different from `exclude`), else an unexplored spawn. */
  private pickTarget(from: Unit, exclude?: { x: number; y: number }): { x: number; y: number } | null {
    let best: KnownBuilding | null = null;
    let bestD = Infinity;
    for (const k of this.known.values()) {
      if (exclude && Math.hypot(k.x - exclude.x, k.y - exclude.y) < 6) continue;
      // Prefer production and economy targets slightly.
      const bias = k.type === 'resource-extractor' || k.type === 'war-factory' ? -4 : 0;
      const d = Math.hypot(k.x - from.x, k.y - from.y) + bias;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (exclude) return null;
    const team = this.player.team;
    const unexplored = this.scoutTargets.find(
      (t) => !this.world.fog.isExplored(team, Math.floor(t.x), Math.floor(t.y)),
    );
    return unexplored ?? null;
  }

  private manageScout(): void {
    const w = this.world;
    if (this.known.size > 0 || w.survival) {
      this.scoutId = null;
      return;
    }
    let scout = this.scoutId !== null ? (w.get(this.scoutId) as Unit | undefined) : undefined;
    if (!scout) {
      const units = w.playerUnits(this.playerId);
      scout =
        units.find((u) => u.type === 'recon-drone') ??
        units.find((u) => u.type === 'recon-vehicle') ??
        units.find((u) => u.type === 'rifleman');
      this.scoutId = scout?.id ?? null;
    }
    if (!scout || scout.moving) return;
    const team = this.player.team;
    const target = this.scoutTargets.find((t) => !w.fog.isExplored(team, Math.floor(t.x), Math.floor(t.y)));
    if (target) {
      w.issue({ type: 'move', player: this.playerId, units: [scout.id], x: target.x, y: target.y });
      this.lastDecision = 'scouting';
    }
  }
}
