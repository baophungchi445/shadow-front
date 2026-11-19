import type { ArmorClass, BuildingTypeId, PlayerId, UnitTypeId } from '@shadow-front/shared-types';
import {
  BUILDINGS,
  RESEARCH,
  RESEARCH_IDS,
  DIFFICULTY,
  PERSONALITIES,
  UNITS,
  availableTo,
  mulberry32,
  type DifficultyProfile,
  type PersonalityProfile,
} from '@shadow-front/game-data';
import type { Building, Unit, World } from '@shadow-front/game-core';
import { findExtractorSite, findPlacement } from './placement';

export type AIState = 'opening' | 'buildup' | 'attack' | 'defend';

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
  private scoutId: number | null = null;
  private scoutTargets: { x: number; y: number }[] = [];
  private squads: { ids: Set<number>; startHp: number; target: { x: number; y: number } | null }[] = [];
  private lastAttackTick = 0;
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
  }

  // ------------------------------------------------------------ perception

  private perceive(): void {
    const team = this.player.team;
    for (const e of this.world.visibleEnemies(team)) {
      if (e.kind === 'building') this.known.set(e.id, { id: e.id, x: e.x, y: e.y, type: e.type });
      else this.seenArmor[e.def.armor] = this.seenArmor[e.def.armor] * 0.98 + 1;
    }
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
    if (this.count('resource-extractor') < this.diff.maxExtractors) return 'resource-extractor';
    const defenses = this.count('defense-turret') + this.count('sam-site');
    if (defenses < this.pers.defenses)
      return this.seenArmor.air > 2 && this.count('sam-site') <= this.count('defense-turret')
        ? 'sam-site'
        : 'defense-turret';
    if (this.seenArmor.air > 3 && this.count('sam-site') < 2) return 'sam-site';
    if (this.count('war-factory') < 1) return 'war-factory';
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
    const next = this.nextBuilding();
    const hq = this.hq();
    if (!next || !hq) return;
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
    const res = w.issue({ type: 'build', player: this.playerId, building: type, tx: spot.tx, ty: spot.ty });
    if (res.ok) {
      this.lastBuildTick = w.tick;
      this.lastDecision = `build ${type}`;
    }
  }

  // ------------------------------------------------------------ production

  private reserve(): number {
    if (this.state === 'defend') return 0;
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
    if (def.transport && !def.weapon) return -1;
    if (def.support) {
      // At most a couple of medics / engineers, and only once there is an army to support.
      const have = this.world.playerUnits(this.playerId).filter((u) => u.type === type).length;
      if (have >= 2 || this.army().length < 6) return -1;
      return this.rnd() < 0.15 ? 100 : -1; // occasionally, so they never crowd out combat units
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
    return this.diff.firstAttackTick * Math.min(1.4, Math.max(0.6, this.pers.aggression));
  }

  private manageProduction(): void {
    const w = this.world;
    // While the first attack is still held back, do not build a "deathball": stop adding combat units once the
    // army is 1.5× the attack threshold (credits are kept for later). Defence always overrides this.
    if (
      this.state !== 'defend' &&
      w.tick < this.firstAttackTick() &&
      this.armyValue(this.army()) >= this.attackThreshold() * 1.5
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

  private manageArmy(): void {
    const w = this.world;
    const army = this.army();
    const inSquad = new Set<number>();
    for (const sq of this.squads) for (const id of sq.ids) inSquad.add(id);
    this.captureIds = this.captureIds.filter((id) => w.get(id));
    for (const id of this.captureIds) inSquad.add(id);
    for (const id of this.flagRaid) inSquad.add(id);
    const home = army.filter((u) => !inSquad.has(u.id));

    // 1. Defend: visible enemies close to any of our buildings.
    const blds = w.playerBuildings(this.playerId);
    const threats = w
      .visibleEnemies(this.player.team)
      .filter((e) => blds.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < 14));
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
      this.lastDecision = `defend (${threats.length} threats)`;
    } else if (this.state === 'defend') {
      this.state = 'buildup';
    }

    // 2. Scout until an enemy base is known.
    this.manageScout();

    // 2b. Take strategic points (income + vision).
    this.manageCapture(home);

    // 2c. Capture the Flag: raid the enemy flag, bring it home, chase whoever took ours.
    if (w.flags.length) this.manageFlags(home);

    // 3. Maintain attack squads.
    this.squads = this.squads.filter((sq) => {
      for (const id of [...sq.ids]) if (!w.get(id)) sq.ids.delete(id);
      const units = [...sq.ids].map((id) => w.get(id) as Unit);
      if (!units.length) return false;
      const hp = units.reduce((s, u) => s + u.hp, 0);
      if (this.diff.retreats && hp < sq.startHp * 0.35) {
        w.issue({ type: 'retreat', player: this.playerId, units: units.map((u) => u.id) });
        this.lastDecision = 'retreat';
        return false;
      }
      const target = this.pickTarget(units[0]);
      if (!target) return true;
      const idle = units.filter((u) => u.order.type === 'idle' && u.targetId === null);
      if (idle.length || !sq.target || Math.hypot(sq.target.x - target.x, sq.target.y - target.y) > 3) {
        sq.target = target;
        const ids = (idle.length && sq.target ? idle : units).map((u) => u.id);
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

    // 4. Launch a new attack when strong enough and the enemy is known.
    const threshold = this.attackThreshold();
    const firstAttack = this.firstAttackTick();
    if (
      // Survival: the attacker has no base, so allied AIs hold and defend instead of raiding.
      !w.survival &&
      this.state !== 'defend' &&
      w.tick >= firstAttack &&
      w.tick - this.lastAttackTick > this.diff.attackCooldown &&
      this.armyValue(home) >= threshold
    ) {
      const target = home.length ? this.pickTarget(home[0]) : null;
      if (target) {
        this.state = 'attack';
        this.lastAttackTick = w.tick;
        const groups =
          this.diff.multiProng && home.length >= 8
            ? [home.filter((_, i) => i % 2 === 0), home.filter((_, i) => i % 2 === 1)]
            : [home];
        groups.forEach((g, gi) => {
          const t = gi === 0 ? target : (this.pickTarget(g[0], target) ?? target);
          this.squads.push({
            ids: new Set(g.map((u) => u.id)),
            startHp: g.reduce((s, u) => s + u.hp, 0),
            target: t,
          });
          w.issue({
            type: 'move',
            player: this.playerId,
            units: g.map((u) => u.id),
            x: t.x,
            y: t.y,
            attackMove: true,
          });
        });
        this.lastDecision = `attack with ${home.length} units`;
      }
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
    const limit = this.player.difficulty === 'easy' ? 1 : w.points.length;
    const hq = this.hq();
    if (owned >= limit || !hq) return;
    const ground = home.filter((u) => !u.air);
    if (ground.length < 4) return;
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
    if (p.difficulty !== 'easy' && this.state !== 'defend') {
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
    // Upgrade defenses and power plants when rich (defensive personalities only).
    if (this.pers.defenses >= 1 && this.state !== 'defend') {
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
