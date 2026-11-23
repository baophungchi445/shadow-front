import type {
  AiTactic,
  ArmorClass,
  BuildingTypeId,
  PlayerId,
  PlayStyle,
  TeamId,
  UnitTypeId,
} from '@shadow-front/shared-types';
import {
  BALANCE,
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
import { findExtractorSite, findPlacement, findShoreSite } from './placement';
import { Adaptation } from './adaptation';

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
  /** v0.17: where the attack was sent and what each member was worth (to learn from the outcome). */
  origin?: { x: number; y: number };
  members?: Map<number, { cost: number; xp0: number; xp: number; hpFrac: number; alive: boolean }>;
  /** Totals at the last settlement: attacks are judged every 90 s, not only when the squad is gone. */
  settled?: { tick: number; dealt: number; lost: number };
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
  /** Commanders think on different ticks (spreads the CPU cost); tests may align them. */
  thinkOffset: number;
  /** Next scouting target to re-check once all of them are explored (v0.17). */
  private patrolIdx = 0;
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
  /** v0.13: small long-range post holding the nearest hill (high ground). */
  private hillIds: number[] = [];
  private hillPost: { x: number; y: number }[] | null = null;
  /** v0.13: whether this map has open sea linking our shore to an enemy base (decided once). */
  private naval: boolean | null = null;
  /** v0.14 amphibious raid with the Landing Craft. */
  private landing: {
    craft: number;
    phase: 'gather' | 'load' | 'sail';
    tick: number;
    home: { x: number; y: number };
    target: { x: number; y: number } | null;
    beach: { x: number; y: number } | null;
  } | null = null;
  /** v0.16: price of the warship the Naval Yard is waiting to afford (land production saves for it). */
  private pendingShipCost = 0;
  /** v0.16: the warship the yard committed to (kept until built, so a Destroyer is not swapped for a cheap boat). */
  private pendingShip: UnitTypeId | null = null;
  /** v0.16: ticks at which our ships were lost (recent losses pause naval production so the fleet is not fed). */
  private shipLossTicks: number[] = [];
  private shipsLostSeen = 0;
  private navalPauseUntil = 0;
  /** v0.15: decaying count of enemy warships seen (drives submarine production). */
  private seenShips = 0;
  /** v0.15: where the fleet was last sent (to avoid re-issuing the same order every think). */
  private fleetGoal: { x: number; y: number } | null = null;
  /** Water tiles with open ground beside them (computed once). */
  private beaches: { x: number; y: number }[] | null = null;
  /** Set once the personality build order has been completed. */
  private openingDone = false;
  /** Debug/telemetry: last decision made, shown in dev overlay. */
  lastDecision = '';
  /** v0.17: what this commander learned during the match (attack outcomes, the opponent's play style). */
  readonly adapt: Adaptation;
  /** Tick of the first real assault (>= 3 armed enemies) on our base. */
  private firstAssaultTick: number | null = null;

  constructor(
    private readonly world: World,
    readonly playerId: PlayerId,
    /** v0.17.2: the human opponent's remembered habits (`MatchConfig.aiMemory`). */
    opts: { remembered?: readonly PlayStyle[] } = {},
  ) {
    const p = world.players[playerId];
    this.diff = DIFFICULTY[p.difficulty ?? 'normal'];
    this.pers = PERSONALITIES[p.personality ?? 'warlord'];
    this.adapt = new Adaptation(p.difficulty ?? 'normal');
    this.thinkOffset = playerId * 3;
    this.rnd = mulberry32((world.seed ^ 0x5eed) + playerId * 7919);
    // Spawn locations are public map knowledge (like reading the map before a match).
    const own = world.map.spawns[p.spawnIndex];
    this.scoutTargets = world.map.spawns
      .filter((s) => s !== own)
      .map((s) => ({ x: s.tx + 1.5, y: s.ty + 1.5 }))
      .sort(
        (a, b) =>
          Math.hypot(a.x - own.tx, a.y - own.ty) - Math.hypot(b.x - own.tx, b.y - own.ty) ||
          // Equally far spawns: prefer the one along our corner's x direction (mirrored per corner, v0.18).
          (b.x - a.x) * (own.tx < world.map.width / 2 ? 1 : -1),
      );
    // v0.17: then the strategic points and the map centre — an enemy may build away from any spawn
    // (a Mobile Command Vehicle base, the Iron Convoy mission).
    for (const pt of world.points) this.scoutTargets.push({ x: pt.x, y: pt.y });
    this.scoutTargets.push({ x: world.map.width / 2, y: world.map.height / 2 });
    // Memory is about the human player: only commanders facing a human use it.
    const facesHuman = world.players.some((q) => !q.isAI && !q.raider && q.team !== p.team);
    if (opts.remembered?.length && facesHuman)
      for (const tactic of this.adapt.prime(opts.remembered))
        world.emit({ type: 'aiAdapted', player: playerId, tactic, remembered: true });
  }

  private get player() {
    return this.world.players[this.playerId];
  }

  /** Call once per simulation tick. Decisions run every `thinkInterval` ticks. */
  update(): void {
    if (this.player.defeated || this.world.winningTeam !== null) return;
    if ((this.world.tick + this.thinkOffset) % this.diff.thinkInterval !== 0) return;
    this.perceive();
    this.manageBase();
    this.manageProduction();
    this.manageArmy();
    this.learn();
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

  // ------------------------------------------------------------ learning (v0.17)

  /** Reads the opponent's play style from what the team has seen and announces new answers. */
  private learn(): void {
    const seenUnits =
      this.seenArmor.infantry + this.seenArmor.light + this.seenArmor.heavy + this.seenArmor.air + this.seenShips;
    let enemyDefenses = 0;
    for (const k of this.known.values()) if (BUILDINGS[k.type].weapon || k.type === 'bunker') enemyDefenses++;
    const changed = this.adapt.observe({
      tick: this.world.tick,
      firstAssaultTick: this.firstAssaultTick,
      enemyDefenses,
      seenUnits,
      seenAir: this.seenArmor.air,
      seenShips: this.seenShips,
    });
    this.announce(changed);
  }

  private announce(tactics: readonly AiTactic[]): void {
    for (const tactic of tactics) {
      this.world.emit({ type: 'aiAdapted', player: this.playerId, tactic });
      this.lastDecision = `adapt: ${tactic}`;
    }
  }

  /**
   * Judges an attack squad on what happened since its last settlement (every 90 s while it fights, and once more
   * when it is gone): credits worth destroyed vs lost, measured against what was still standing at the start.
   * AI attacks often grind on for many minutes, so waiting for the squad to end would rarely teach anything.
   */
  private settleSquad(sq: Squad): void {
    if (!sq.members || !sq.origin) return;
    let total = 0;
    let dealt = 0;
    let lost = 0;
    for (const m of sq.members.values()) {
      total += m.cost;
      dealt += Math.max(0, m.xp - m.xp0);
      lost += m.alive ? m.cost * (1 - m.hpFrac) : m.cost;
    }
    const prev = sq.settled ?? { tick: 0, dealt: 0, lost: 0 };
    sq.settled = { tick: this.world.tick, dealt, lost };
    const wDealt = Math.max(0, dealt - prev.dealt);
    const wLost = Math.max(0, lost - prev.lost); // healed survivors can make the window negative
    if (wDealt + wLost < 400) return; // a quiet march: nothing to learn
    this.announce(
      this.adapt.recordAttack({
        tick: this.world.tick,
        x: sq.origin.x,
        y: sq.origin.y,
        sent: total - prev.lost,
        dealt: wDealt,
        lost: wLost,
      }),
    );
  }

  private perceive(): void {
    const team = this.player.team;
    // The estimate halves in about 2 minutes without new sightings.
    this.enemyArmy *= Math.pow(0.5, this.diff.thinkInterval / 2400);
    let seen = 0;
    for (const e of this.world.visibleEnemies(team)) {
      if (e.kind === 'unit' && e.def.weapon) seen += e.def.cost;
      if (e.kind === 'building') this.known.set(e.id, { id: e.id, x: e.x, y: e.y, type: e.type });
      else this.seenArmor[e.def.armor] = this.seenArmor[e.def.armor] * 0.98 + 1;
      if (e.kind === 'unit' && e.naval && e.def.weapon && !e.def.submarine) this.seenShips = this.seenShips * 0.98 + 1;
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
    const defenses = this.count('defense-turret') + this.count('sam-site');
    const maxExtractors = Math.min(this.diff.maxExtractors, this.pers.economyCap ?? Infinity);
    if (this.count('resource-extractor') < maxExtractors) return 'resource-extractor';
    if (defenses < this.pers.defenses)
      return this.seenArmor.air > 2 && this.count('sam-site') <= this.count('defense-turret')
        ? 'sam-site'
        : 'defense-turret';
    if (this.seenArmor.air > 3 && this.count('sam-site') < 2) return 'sam-site';
    if (this.adapt.has('air') && this.count('sam-site') < 3) return 'sam-site';
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
    // Sea maps: one Naval Yard on the home shore (v0.13).
    if (this.count('naval-yard') < 1 && this.navalMap()) return 'naval-yard';
    // Defensive personalities add a long-range missile battery once they can.
    if (
      this.pers.defenses >= 2 &&
      this.count('missile-launcher') < 1 &&
      this.world.hasCompleted(this.playerId, 'research-center')
    )
      return 'missile-launcher';
    // v0.17: against a fortified opponent, a long-range missile battery outranges its turrets.
    if (
      this.adapt.has('turtle') &&
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
    let shoreFacing: number | null = null;
    if (type === 'resource-extractor') {
      spot = findExtractorSite(w, this.playerId, hq);
    } else if (type === 'naval-yard') {
      const site = findShoreSite(w, this.playerId, hq);
      spot = site;
      shoreFacing = site?.facing ?? null;
    } else {
      // Defenses go toward the map centre (the likely attack direction); others cluster around the HQ.
      const toward = BUILDINGS[type].weapon ? 5 : 0;
      const dx = Math.sign(w.map.width / 2 - hq.x) * toward;
      const dy = Math.sign(w.map.height / 2 - hq.y) * toward;
      // The random jitter is mirrored per quadrant too (same draws → mirrored spots, v0.18).
      const jx = Math.sign(w.map.width / 2 - hq.x) || 1;
      const jy = Math.sign(w.map.height / 2 - hq.y) || 1;
      spot = findPlacement(
        w,
        this.playerId,
        type,
        hq.x + dx + jx * (this.rnd() - 0.5) * 2,
        hq.y + dy + jy * (this.rnd() - 0.5) * 2,
      );
    }
    if (!spot) return;
    // Producers face the middle of the map so new units come out toward the front (v0.12).
    const dx = w.map.width / 2 - (spot.tx + BUILDINGS[type].w / 2);
    const dy = w.map.height / 2 - (spot.ty + BUILDINGS[type].h / 2);
    const facing =
      shoreFacing ??
      (BUILDINGS[type].produces
      ? Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 1
          : 3
        : dy > 0
          ? 0
          : 2
      : 0);
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
    // v0.17: against a rusher, keep a bigger home guard during the first 10 minutes (extra turrets were tried
    // first and lost more matches: they starve the economy).
    const guard = this.adapt.has('rush') && this.world.tick < 12000 ? 1.3 : 1;
    return this.diff.attackValue * Math.min(0.8, Math.max(0.35, this.world.tick / 9000)) * guard;
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
    if (def.category === 'naval') {
      const own = this.world.playerUnits(this.playerId);
      if (def.transport) {
        // One Landing Craft for amphibious raids (v0.14), once two warships escort the sea.
        if (own.some((u) => u.type === type) || own.filter((u) => u.naval && u.def.weapon).length < 2) return -1;
        return this.rnd() < 0.3 ? 100 : -1;
      }
      // A small fleet (up to 6 warships): destroyers first, submarines once enemy warships have been seen,
      // patrol boats as escorts / sub hunters.
      const fleet = own.filter((u) => u.naval && u.def.weapon);
      if (fleet.length >= 6) return -1;
      let score = type === 'destroyer' ? 2 : 1.5;
      if (def.submarine) score = (this.seenShips >= 1 ? 2.6 : 0.5) + (this.adapt.has('naval') ? 1.5 : 0);
      if (type === 'patrol-boat' && fleet.filter((u) => u.type === 'patrol-boat').length < 1) score += 0.6;
      return score * (0.75 + this.rnd() * 0.5);
    }
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
    // v0.17: answers to the opponent's play style.
    const wpn = def.weapon;
    if (wpn) {
      if (this.adapt.has('turtle') && (def.category === 'artillery' || wpn.range >= 9)) s += 3;
      if (this.adapt.has('air') && wpn.canTargetAir) s += 3;
      if (this.adapt.has('rush') && this.world.tick < 9 * 1200 && (wpn.type === 'bullet' || wpn.type === 'rocket'))
        s += 1;
    }
    if (!def.weapon) s *= this.scoutId === null && this.known.size === 0 ? 1 : 0.1;
    return s * (0.75 + this.rnd() * 0.5);
  }

  /** Army value at which an attack is launched. */
  private attackThreshold(): number {
    // v0.17: failed attacks make the commander more patient; against a fortified opponent it masses a siege army.
    const siege = this.adapt.has('turtle') ? 1.15 : 1;
    return this.diff.attackValue * this.pers.aggression * this.adapt.patience * siege;
  }

  /** Earliest tick for the first attack; personalities scale it (RUSH earlier, FORTRESS later). */
  private firstAttackTick(): number {
    return this.diff.firstAttackTick * Math.min(1.4, Math.max(0.75, this.pers.aggression));
  }

  private manageProduction(): void {
    const w = this.world;
    // While the first attack is still held back, do not build a "deathball": stop adding land combat units once the
    // army is 1.5× the attack threshold (credits are kept for later). Defence always overrides this. The fleet is a
    // separate force, so the Naval Yard keeps working (v0.16).
    const holding =
      this.state !== 'defend' &&
      w.tick < this.firstAttackTick() &&
      this.armyValue(this.army()) >= this.attackThreshold() * (this.pers.aggression < 1 ? 1.25 : 1.5);
    if (holding) this.lastDecision = 'holding production until first attack';
    const all = w.playerBuildings(this.playerId).filter((b) => b.complete && b.def.produces);
    const yards = all.filter((b) => b.type === 'naval-yard');
    // Keep room under the unit limit for a small fleet: land production pauses near the cap until 3 warships exist.
    const fleetSize = w.playerUnits(this.playerId).filter((u) => u.naval && u.def.weapon).length;
    const saveSupply = yards.length > 0 && fleetSize < 3 && w.unitCap > 0 && w.supplyUsed(this.playerId) > w.unitCap - 12;
    // The Naval Yard comes on top of the producer limit (it only builds ships). Until 3 warships exist it is served
    // first, otherwise cheap land units always spend the credits before a ship can be afforded.
    const land = holding || saveSupply ? [] : all.filter((b) => b.type !== 'naval-yard').slice(0, this.diff.maxProducers);
    const producers = fleetSize < 3 ? [...yards, ...land] : [...land, ...yards];
    // Fleet losses: 4 ships sunk within 3 minutes pause the yard for 2 minutes (v0.16).
    const sunk = this.player.stats.shipsLost ?? 0;
    for (; this.shipsLostSeen < sunk; this.shipsLostSeen++) this.shipLossTicks.push(w.tick);
    this.shipLossTicks = this.shipLossTicks.filter((t) => w.tick - t < 3600);
    if (this.shipLossTicks.length >= 4 && w.tick >= this.navalPauseUntil) {
      this.navalPauseUntil = w.tick + 2400;
      this.shipLossTicks = [];
    }
    for (const b of producers) {
      if (b.queue.length >= 2) continue;
      if (b.type === 'naval-yard' && w.tick < this.navalPauseUntil) continue;
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
      // The yard sticks to the warship it is saving for.
      if (b.type === 'naval-yard' && this.pendingShip && options.includes(this.pendingShip) && bestS >= 0 && UNITS[this.pendingShip].weapon)
        best = this.pendingShip;
      if (!best || bestS < 0) continue;
      if (w.overCap(this.playerId, best)) {
        this.lastDecision = 'at unit limit';
        continue;
      }
      // Until the first two warships exist, land units only spend what is left above the price of a ship; while the
      // fleet is small they also save for the warship the yard is waiting for (a Destroyer costs far more than the
      // land units that would otherwise always spend the credits first — v0.16).
      const saveForShip =
        b.type === 'naval-yard' || yards.length === 0
          ? 0
          : Math.max(fleetSize < 2 ? UNITS['patrol-boat'].cost : 0, fleetSize < 4 ? this.pendingShipCost : 0);
      if (this.player.credits - w.unitCost(this.playerId, best) < this.reserve() + saveForShip) {
        if (b.type === 'naval-yard' && b.queue.length === 0) {
          this.pendingShipCost = w.unitCost(this.playerId, best);
          this.pendingShip = best;
        }
        continue;
      }
      if (b.type === 'naval-yard') {
        this.pendingShipCost = 0;
        this.pendingShip = null;
      }
      const res = w.issue({ type: 'produce', player: this.playerId, producer: b.id, unit: best });
      if (res.ok) this.lastDecision = `produce ${best}`;
      // Gather produced units in front of the base.
      const hq = this.hq();
      if (hq && b.type !== 'naval-yard') {
        const gx = hq.x + Math.sign(w.map.width / 2 - hq.x) * 6;
        const gy = hq.y + Math.sign(w.map.height / 2 - hq.y) * 6;
        if (Math.hypot(b.rallyX - gx, b.rallyY - gy) > 0.5)
          w.issue({ type: 'rally', player: this.playerId, producer: b.id, x: gx, y: gy });
      }
    }
  }

  // ------------------------------------------------------------ army

  private army(): Unit[] {
    // Mission guards (an ambush, v0.17) hold their spot: they are not part of the commander's army.
    return this.world.playerUnits(this.playerId).filter((u) => u.def.weapon && u.id !== this.scoutId && !u.guard);
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
    this.hillIds = this.hillIds.filter((id) => w.get(id));
    for (const id of this.hillIds) inSquad.add(id);
    // v0.15: warships fight as their own fleet (manageFleet), not with the land army.
    const fleet = army.filter((u) => u.naval);
    for (const u of fleet) inSquad.add(u.id);
    // Units walking into a bunker / transport are spoken for.
    let home = army.filter((u) => !inSquad.has(u.id) && u.order.type !== 'board');

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
      const attackers = threats.filter((e) => e.kind === 'unit' && e.def.weapon);
      if (attackers.length >= 3 && this.firstAssaultTick === null) this.firstAssaultTick = w.tick;
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

    // 2b'. Hold the nearest hill with long-range units (vision + range bonus).
    this.manageHill(home);

    // 2c. Capture the Flag: raid the enemy flag, bring it home, chase whoever took ours.
    if (w.flags.length) this.manageFlags(home);

    // 2d. Transport-helicopter drop raid on the enemy economy.
    this.manageDrop(home);

    // 2e. Amphibious raid with the Landing Craft (v0.14).
    this.manageLanding(home);

    // 2f. The fleet hunts enemy ships, guards our coast and shells coastal targets (v0.15).
    this.manageFleet(fleet);

    // 3. Maintain attack squads.
    this.squads = this.squads.filter((sq) => {
      if (sq.members)
        for (const [id, m] of sq.members) {
          const u = w.get(id);
          if (u && u.kind === 'unit') {
            m.xp = u.xp;
            m.hpFrac = u.hp / u.maxHp;
          } else if (!carried.has(id)) m.alive = false;
        }
      for (const id of [...sq.ids]) if (!w.get(id) && !carried.has(id)) sq.ids.delete(id);
      const units = [...sq.ids].map((id) => w.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit');
      if (!units.length) {
        this.settleSquad(sq);
        return false;
      }
      const hp = units.reduce((s, u) => s + u.hp, 0);
      if (this.diff.retreats && hp < sq.startHp * 0.35) {
        w.issue({ type: 'retreat', player: this.playerId, units: units.map((u) => u.id) });
        this.lastDecision = 'retreat';
        this.settleSquad(sq);
        return false;
      }
      if (sq.settled && w.tick - sq.settled.tick >= 1800) this.settleSquad(sq);
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

    // Units sent to a transport above (drop / landing raids) are spoken for.
    home = home.filter((u) => u.order.type !== 'board');

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
      w.tick - this.lastAttackTick > this.diff.attackCooldown * this.adapt.cooldownFactor &&
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
        origin: { x: t.x, y: t.y },
        settled: { tick: w.tick, dealt: 0, lost: 0 },
        members: new Map(
          g.map((u) => [u.id, { cost: u.def.cost, xp0: u.xp, xp: u.xp, hpFrac: u.hp / u.maxHp, alive: true }]),
        ),
      };
      // Infantry ride in the squad's APCs: they arrive together and protected.
      const waiting = new Set<number>();
      for (const apc of g.filter((u) => u.def.transport && !u.air && !u.naval)) {
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

  /**
   * v0.15 fleet: (1) attack the nearest visible enemy ship; (2) defend our coast when enemies near our buildings can
   * be reached from the water; (3) with ≥ 3 warships after the first-attack time, shell the remembered enemy
   * building closest to the water; (4) otherwise wait in the home bay.
   */
  private manageFleet(fleet: Unit[]): void {
    const w = this.world;
    if (!fleet.length) {
      this.fleetGoal = null;
      return;
    }
    const team = this.player.team;
    const cx = fleet.reduce((s, u) => s + u.x, 0) / fleet.length;
    const cy = fleet.reduce((s, u) => s + u.y, 0) / fleet.length;
    const visible = w.visibleEnemies(team);
    let goal: { x: number; y: number } | null = null;
    let why = '';
    // 1. Enemy ships in sight.
    const ships = visible
      .filter((e): e is Unit => e.kind === 'unit' && e.naval)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    if (ships.length) {
      goal = { x: ships[0].x, y: ships[0].y };
      why = 'fleet engages ships';
    }
    // 2. Coastal defence: enemies near our buildings that a ship can get close to.
    if (!goal) {
      const blds = w.playerBuildings(this.playerId);
      const threat = visible.find(
        (e) =>
          blds.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < 12) && this.beachNear(e.x, e.y, 0, 8) !== null,
      );
      if (threat) {
        goal = this.beachNear(threat.x, threat.y, 0, 8);
        why = 'fleet guards the coast';
      }
    }
    // 3. Shore bombardment.
    if (!goal && fleet.length >= 3 && w.tick >= this.firstAttackTick() && this.state !== 'defend') {
      let best: { x: number; y: number } | null = null;
      let bd = Infinity;
      for (const k of this.known.values()) {
        // Destroyer guns reach 13 tiles: any water within 12 of the building will do.
        const b = this.beachNear(k.x, k.y, 0, 12);
        if (!b) continue;
        const d = Math.hypot(b.x - k.x, b.y - k.y);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) {
        goal = best;
        why = 'fleet shells the coast';
      }
    }
    // 4. Home bay.
    if (!goal) {
      const yard = w.playerBuildings(this.playerId).find((b) => b.type === 'naval-yard');
      const home = yard ?? this.hq();
      const bay = home ? w.water.nearestWalkable(Math.floor(home.x), Math.floor(home.y), 10) : null;
      if (bay && Math.hypot(cx - bay.x, cy - bay.y) > 6) {
        goal = { x: bay.x + 0.5, y: bay.y + 0.5 };
        why = 'fleet returns to the home bay';
      }
    }
    if (!goal) return;
    const idle = fleet.filter((u) => u.order.type === 'idle' && u.targetId === null);
    const moved = !this.fleetGoal || Math.hypot(this.fleetGoal.x - goal.x, this.fleetGoal.y - goal.y) > 3;
    if (!moved && !idle.length) return;
    this.fleetGoal = goal;
    w.issue({
      type: 'move',
      player: this.playerId,
      units: (moved ? fleet : idle).map((u) => u.id),
      x: goal.x,
      y: goal.y,
      attackMove: true,
    });
    this.lastDecision = why;
  }

  /** Water tiles (centres) next to a walkable land tile — where a Landing Craft can put troops ashore. */
  private beachTiles(): { x: number; y: number }[] {
    if (this.beaches) return this.beaches;
    const g = this.world.grid;
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < g.height; y++)
      for (let x = 0; x < g.width; x++) {
        if (g.tile(x, y) !== 'water') continue;
        if (g.terrainWalkable(x + 1, y) || g.terrainWalkable(x - 1, y) || g.terrainWalkable(x, y + 1) || g.terrainWalkable(x, y - 1))
          out.push({ x: x + 0.5, y: y + 0.5 });
      }
    return (this.beaches = out);
  }

  /** Beach closest to (x, y) but at least `minD` tiles away (landing out of reach of the target's guns). */
  private beachNear(x: number, y: number, minD: number, maxD: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const b of this.beachTiles()) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < minD || d > maxD || d >= bd) continue;
      bd = d;
      best = b;
    }
    return best;
  }

  /**
   * v0.14 amphibious raid: the Landing Craft waits on the home beach, takes up to 6 seats of home ground units
   * (nearest first: a tank + infantry fills it), sails to a beach 5–12 tiles from a remembered enemy building
   * (economy first) and puts the troops ashore as a new attack squad, then returns home.
   */
  private manageLanding(home: Unit[]): void {
    const w = this.world;
    const craft = w.playerUnits(this.playerId).find((u) => u.type === 'landing-craft');
    const hq = this.hq();
    if (!craft || !hq) {
      this.landing = null;
      return;
    }
    if (!this.landing || this.landing.craft !== craft.id) {
      const homeBeach = this.beachNear(hq.x, hq.y, 0, 20);
      if (!homeBeach) return;
      this.landing = { craft: craft.id, phase: 'gather', tick: w.tick, home: homeBeach, target: null, beach: null };
    }
    const L = this.landing;
    const boarding = this.boardingInto(craft.id);
    if (L.phase === 'gather') {
      if (craft.passengers.length) {
        L.phase = 'load';
        return;
      }
      if (Math.hypot(craft.x - L.home.x, craft.y - L.home.y) > 2) {
        if (!craft.moving)
          w.issue({ type: 'move', player: this.playerId, units: [craft.id], x: L.home.x, y: L.home.y, attackMove: false });
        return;
      }
      if (this.state === 'defend' || w.tick < this.firstAttackTick() || this.known.size === 0 || boarding.length) return;
      // Pick the landing first: no beach near any known enemy building means no raid.
      const known = [...this.known.values()];
      const eco = known.filter((k) => k.type === 'resource-extractor' || k.type === 'power-plant');
      let target: { x: number; y: number } | null = null;
      let beach: { x: number; y: number } | null = null;
      for (const k of [...eco, ...known]) {
        const b = this.beachNear(k.x, k.y, 5, 12);
        if (b) {
          target = { x: k.x, y: k.y };
          beach = b;
          break;
        }
      }
      if (!target || !beach) return;
      const ground = home.filter((u) => !u.air && !u.naval && w.canCarry(craft, u));
      if (ground.length < 8) return;
      const riders = ground.sort(
        (a, b) => Math.hypot(a.x - craft.x, a.y - craft.y) - Math.hypot(b.x - craft.x, b.y - craft.y),
      );
      if (w.issue({ type: 'load', player: this.playerId, units: riders.map((u) => u.id), carrier: craft.id }).ok) {
        L.phase = 'load';
        L.tick = w.tick;
        L.target = target;
        L.beach = beach;
        this.lastDecision = 'loading landing craft';
      }
      return;
    }
    if (L.phase === 'load') {
      const full = w.seatsUsed(craft) >= w.capacityOf(craft);
      if (boarding.length && !full && w.tick - L.tick < 400) return;
      if (boarding.length) w.issue({ type: 'stop', player: this.playerId, units: boarding.map((u) => u.id) });
      if (!craft.passengers.length || !L.beach) {
        L.phase = 'gather';
        return;
      }
      L.phase = 'sail';
      L.tick = w.tick;
      w.issue({ type: 'move', player: this.playerId, units: [craft.id], x: L.beach.x, y: L.beach.y, attackMove: false });
      this.lastDecision = 'amphibious raid';
      return;
    }
    // Sailing: land on arrival (or when badly hurt, wherever there is a beach).
    const arrived = !!L.beach && (Math.hypot(craft.x - L.beach.x, craft.y - L.beach.y) < 1.5 || !craft.moving);
    const hurt = craft.hp < craft.maxHp * 0.4;
    if (!arrived && !hurt) return;
    const ids = craft.passengers.map((p) => p.id);
    if (w.issue({ type: 'unload', player: this.playerId, carrier: craft.id }).ok) {
      const troops = ids.map((id) => w.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit');
      this.squads.push({ ids: new Set(ids), startHp: troops.reduce((s, u) => s + u.hp, 0), target: null });
      if (L.target)
        w.issue({ type: 'move', player: this.playerId, units: ids, x: L.target.x, y: L.target.y, attackMove: true });
      this.lastDecision = `amphibious landing (${ids.length})`;
    } else if (craft.moving) {
      return;
    }
    if (!craft.passengers.length || w.tick - L.tick > 20 * 90) {
      L.phase = 'gather';
      L.target = null;
      L.beach = null;
      w.issue({ type: 'move', player: this.playerId, units: [craft.id], x: L.home.x, y: L.home.y, attackMove: false });
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
      const hunters = home.filter((u) => !u.air && !u.naval && u.order.type !== 'attack').slice(0, 6);
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
        .filter((u) => !u.air && !u.naval && !this.flagRaid.includes(u.id))
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
    const ground = home.filter((u) => !u.air && !u.naval);
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

  /**
   * v0.13: true (from Normal up) when a shore site exists near our HQ and its water body is open sea
   * (≥ 300 tiles) that also comes within 16 tiles of an enemy spawn. Decided once per match.
   */
  private navalMap(): boolean {
    if (this.naval !== null) return this.naval;
    const w = this.world;
    const hq = this.hq();
    if (this.player.difficulty === 'easy' || !hq || !this.world.hasCompleted(this.playerId, 'war-factory'))
      return false;
    this.naval = false;
    const site = findShoreSite(w, this.playerId, hq);
    if (!site) return false;
    const start = w.water.nearestWalkable(site.tx + 1, site.ty + 1, 4);
    if (!start) return false;
    const W = w.map.width;
    const seen = new Uint8Array(W * w.map.height);
    const stack = [start.y * W + start.x];
    seen[stack[0]] = 1;
    let size = 0;
    const enemies = w.map.spawns.filter((_, i) =>
      w.players.some((p) => p.spawnIndex === i && w.areEnemies(p.team, this.player.team)),
    );
    let reachesEnemy = false;
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % W;
      const y = (c / W) | 0;
      if (!reachesEnemy && enemies.some((s) => Math.hypot(s.tx - x, s.ty - y) < 16)) reachesEnemy = true;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (!w.water.walkable(nx, ny) || seen[ny * W + nx]) continue;
        seen[ny * W + nx] = 1;
        stack.push(ny * W + nx);
      }
    }
    this.naval = size >= BALANCE.navalSeaMin && reachesEnemy;
    return this.naval;
  }

  /**
   * Hill clusters (4-connected hill tiles) as lists of tile centres, sorted from the cluster centre outward.
   * Computed once per commander — hills are never destroyed.
   */
  private hillClusters(): { x: number; y: number }[][] {
    const g = this.world.grid;
    const seen = new Uint8Array(g.width * g.height);
    const out: { x: number; y: number }[][] = [];
    for (let y = 0; y < g.height; y++)
      for (let x = 0; x < g.width; x++) {
        if (seen[g.index(x, y)] || g.tile(x, y) !== 'hill') continue;
        const tiles: { x: number; y: number }[] = [];
        const stack = [[x, y]];
        seen[g.index(x, y)] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          tiles.push({ x: cx + 0.5, y: cy + 0.5 });
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (g.tile(nx, ny) !== 'hill' || seen[g.index(nx, ny)]) continue;
            seen[g.index(nx, ny)] = 1;
            stack.push([nx, ny]);
          }
        }
        if (tiles.length < 3) continue;
        const mx = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
        const my = tiles.reduce((s, t) => s + t.y, 0) / tiles.length;
        tiles.sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my));
        out.push(tiles);
      }
    return out;
  }

  /**
   * v0.13 high ground: from Normal up, once the home army is big enough, park up to 3 long-range ground units
   * (artillery first) on the nearest hill within reach of our base. They hold there as a fire base and walk
   * back after chasing something off the hill.
   */
  private manageHill(home: Unit[]): void {
    const w = this.world;
    if (this.player.difficulty === 'easy') return;
    const hq = this.hq();
    if (!hq) return;
    if (this.hillPost === null) {
      // Distance to a hill is measured from its centre (its first tile is always the north-west corner, which
      // made one spawn see the central plateau as "near" and feed guards into it — v0.16); guards stand on the
      // hill tiles nearest to our base.
      const d = (c: { x: number; y: number }[]) => {
        const mx = c.reduce((s, t) => s + t.x, 0) / c.length;
        const my = c.reduce((s, t) => s + t.y, 0) / c.length;
        return Math.hypot(mx - hq.x, my - hq.y);
      };
      const near = this.hillClusters()
        .filter((c) => d(c) < 36)
        .sort((a, b) => d(a) - d(b));
      this.hillPost = (near[0] ?? [])
        .slice()
        .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))
        .slice(0, 6);
    }
    const post = this.hillPost;
    if (!post.length) return;
    const onPost = (u: Unit) => w.grid.tile(Math.floor(u.x), Math.floor(u.y)) === 'hill';
    // Guards that wandered off (chasing a target) go back to their tile once idle.
    this.hillIds.forEach((id, i) => {
      const u = w.get(id) as Unit;
      if (u.order.type === 'idle' && u.targetId === null && !onPost(u)) {
        const t = post[i % post.length];
        w.issue({ type: 'move', player: this.playerId, units: [id], x: t.x, y: t.y, attackMove: true });
      }
    });
    if (this.state === 'defend' || this.state === 'opening' || this.hillIds.length >= 3) return;
    const ground = home.filter((u) => !u.air && !u.naval && !u.def.transport && u.def.weapon);
    if (ground.length < 6 || this.armyValue(home) < this.minArmy()) return;
    const pick = ground
      .sort(
        (a, b) =>
          Number(b.def.category === 'artillery') - Number(a.def.category === 'artillery') ||
          b.def.weapon!.range - a.def.weapon!.range,
      )
      .slice(0, Math.min(3 - this.hillIds.length, ground.length - 5));
    for (const u of pick) {
      const t = post[this.hillIds.length % post.length];
      this.hillIds.push(u.id);
      w.issue({ type: 'move', player: this.playerId, units: [u.id], x: t.x, y: t.y, attackMove: true });
    }
    if (pick.length) this.lastDecision = `hold hill (${this.hillIds.length})`;
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
  /**
   * Where to look for the enemy: the nearest unexplored scouting target; once all are explored and no enemy building
   * is known, patrol them in turn (an enemy may have built where we already looked — v0.17).
   */
  private searchTarget(): { x: number; y: number } | null {
    const team = this.player.team;
    const w = this.world;
    const unexplored = this.scoutTargets.find((t) => !w.fog.isExplored(team, Math.floor(t.x), Math.floor(t.y)));
    if (unexplored) return unexplored;
    if (!this.scoutTargets.length) return null;
    let t = this.scoutTargets[this.patrolIdx % this.scoutTargets.length];
    // Move on once the spot is in sight.
    if (w.fog.isVisible(team, t.x, t.y)) {
      this.patrolIdx++;
      t = this.scoutTargets[this.patrolIdx % this.scoutTargets.length];
    }
    return t;
  }

  private pickTarget(from: Unit, exclude?: { x: number; y: number }): { x: number; y: number } | null {
    let best: KnownBuilding | null = null;
    let bestD = Infinity;
    for (const k of this.known.values()) {
      if (exclude && Math.hypot(k.x - exclude.x, k.y - exclude.y) < 6) continue;
      // Prefer production and economy targets slightly.
      const bias = k.type === 'resource-extractor' || k.type === 'war-factory' ? -4 : 0;
      // v0.17: places where attacks failed twice are avoided for a while.
      const d = Math.hypot(k.x - from.x, k.y - from.y) + bias + this.adapt.targetPenalty(k.x, k.y, this.world.tick);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (exclude) return null;
    return this.searchTarget();
  }

  private manageScout(): void {
    const w = this.world;
    if (this.known.size > 0 || w.survival) {
      this.scoutId = null;
      return;
    }
    let scout = this.scoutId !== null ? (w.get(this.scoutId) as Unit | undefined) : undefined;
    if (!scout) {
      const units = w.playerUnits(this.playerId).filter((u) => !u.guard);
      scout =
        units.find((u) => u.type === 'recon-drone') ??
        units.find((u) => u.type === 'recon-vehicle') ??
        units.find((u) => u.type === 'rifleman');
      this.scoutId = scout?.id ?? null;
    }
    if (!scout || scout.moving) return;
    const target = this.searchTarget();
    if (target) {
      w.issue({ type: 'move', player: this.playerId, units: [scout.id], x: target.x, y: target.y });
      this.lastDecision = 'scouting';
    }
  }
}
