import type {
  BuildingTypeId,
  Command,
  EntityId,
  GameEvent,
  ResearchId,
  MatchConfig,
  PlayerId,
  UnitTypeId,
} from '@shadow-front/shared-types';
import { BUILDABLE, BUILDINGS, RESEARCH, TICK_MS, TICK_RATE, UNITS } from '@shadow-front/game-data';
import {
  TutorialTracker,
  World,
  getMission,
  missionTracker,
  type Building,
  type Entity,
  type MatchSummary,
  type ObjectiveTracker,
  type Unit,
} from '@shadow-front/game-core';
import { AICommander } from '@shadow-front/game-ai';
import { Sfx } from './audio';

export type CommandMode = 'none' | 'attackMove' | 'patrol';

export const GAME_SPEEDS = [0.5, 1, 2, 3] as const;

/** Veterancy rank names (index = rank). */
export const RANK_NAMES = ['Recruit', 'Veteran', 'Elite', 'Heroic'] as const;

/** A recent "under attack" location, shown as a minimap ping. */
export interface AttackAlert {
  x: number;
  y: number;
  /** performance.now() when raised. */
  time: number;
  building: boolean;
}

export interface MatchResult {
  victory: boolean;
  durationSec: number;
  mapName: string;
  mission: World['mission'];
  /** Campaign mission id, if this was a campaign mission. */
  campaignMission: string | null;
  /** Survival only: waves that entered the map / total waves. */
  waves: { reached: number; total: number } | null;
  /** Facts for the offline profile (campaign completion is filled in by the app store). */
  summary: Omit<MatchSummary, 'campaignComplete'>;
  players: {
    name: string;
    faction: string;
    team: number;
    isAI: boolean;
    raider: boolean;
    color: number;
    defeated: boolean;
    stats: World['players'][number]['stats'];
  }[];
}

type Listener<T> = (payload: T) => void;

/** Tiny typed event emitter used between the controller, Phaser scene and React HUD. */
class Emitter<Events extends object> {
  private map = new Map<keyof Events, Set<Listener<never>>>();
  on<K extends keyof Events>(k: K, fn: Listener<Events[K]>): () => void {
    let s = this.map.get(k);
    if (!s) {
      s = new Set();
      this.map.set(k, s);
    }
    s.add(fn as Listener<never>);
    return () => s.delete(fn as Listener<never>);
  }
  emit<K extends keyof Events>(k: K, payload: Events[K]): void {
    this.map.get(k)?.forEach((fn) => (fn as Listener<Events[K]>)(payload));
  }
  clear(): void {
    this.map.clear();
  }
}

export interface ControllerEvents {
  message: { text: string; tone: 'info' | 'warn' | 'alert' };
  centerCamera: { x: number; y: number };
  gameOver: MatchResult;
}

/**
 * Owns the simulation for an offline skirmish: World + AI commanders + the local player's
 * selection and command state. Rendering (Phaser) and UI (React) only talk to this object.
 */
export class GameController {
  readonly world: World;
  readonly ais: AICommander[];
  readonly humanId: PlayerId;
  readonly events = new Emitter<ControllerEvents>();
  selection = new Set<EntityId>();
  placing: BuildingTypeId | null = null;
  commandMode: CommandMode = 'none';
  paused = false;
  /** Simulation speed multiplier (offline only). */
  speed = 1;
  readonly sfx = new Sfx();
  /** Recent attack alerts (newest last). */
  alerts: AttackAlert[] = [];
  private lastJumpedAlert = -1;
  /** Camera footprint in world coordinates (4 corners), written by the scene for the minimap. */
  cameraView: { x: number; y: number }[] = [];
  /** Events produced since the renderer last consumed them. */
  private renderEvents: GameEvent[] = [];
  private accumulator = 0;
  private groups = new Map<number, EntityId[]>();
  private finished = false;
  /** A unit of ours reached the Heroic rank during this match. */
  private heroic = false;
  /** Objectives shown in the HUD (tutorial and campaign missions only). */
  readonly objectives: ObjectiveTracker | null;
  /** Title shown above the objectives. */
  readonly objectivesTitle: string;

  constructor(readonly config: MatchConfig) {
    this.world = new World(config);
    this.humanId = Math.max(
      0,
      config.slots.findIndex((s) => s.kind === 'human'),
    );
    // The Survival wave attacker is driven by the simulation's wave system, not an AI Commander,
    // and the tutorial outpost is passive (its units only defend themselves).
    this.ais =
      config.mission === 'tutorial'
        ? []
        : this.world.players.filter((p) => p.isAI && !p.raider).map((p) => new AICommander(this.world, p.id));
    const mission = getMission(config.campaignMission);
    this.objectives = mission
      ? missionTracker(mission)
      : config.mission === 'tutorial'
        ? new TutorialTracker()
        : null;
    this.objectivesTitle = mission?.title ?? 'Tutorial';
  }

  get human() {
    return this.world.players[this.humanId];
  }

  get team() {
    return this.human.team;
  }

  /** Advances the fixed-timestep simulation. Returns interpolation alpha in [0, 1). */
  update(dtMs: number): number {
    if (this.paused || this.finished) return 0;
    this.accumulator += Math.min(dtMs, 250) * this.speed;
    let steps = 0;
    const maxSteps = 8 * Math.ceil(this.speed);
    while (this.accumulator >= TICK_MS && steps < maxSteps) {
      for (const ai of this.ais) ai.update();
      this.world.step();
      this.accumulator -= TICK_MS;
      steps++;
      this.handleEvents(this.world.drainEvents());
    }
    if (steps) this.updateObjectives();
    return this.accumulator / TICK_MS;
  }

  private updateObjectives(): void {
    const o = this.objectives;
    if (!o || o.finished) return;
    const done = o.update(this.world, this.humanId, { selectedOwnUnits: this.selectedOwnUnits().length });
    if (!done.length) return;
    const next = o.current;
    const last = done[done.length - 1].title;
    this.message(
      next
        ? o.ordered
          ? `Objective complete: ${last}. Next: ${next.title}`
          : `Objective complete: ${last}`
        : `${this.objectivesTitle} complete!`,
      'info',
    );
    this.sfx.play('built');
  }

  private handleEvents(events: GameEvent[]): void {
    for (const e of events) {
      this.renderEvents.push(e);
      switch (e.type) {
        case 'underAttack':
          if (e.player === this.humanId) {
            this.message(
              e.building ? 'Our base is under attack!' : 'Our forces are engaged',
              e.building ? 'alert' : 'warn',
            );
            this.alerts = [
              ...this.alerts.filter((a) => performance.now() - a.time < 8000).slice(-4),
              { x: e.x, y: e.y, time: performance.now(), building: e.building },
            ];
            if (e.building) this.sfx.play('alert');
          }
          break;
        case 'produced':
          if (e.player === this.humanId) this.sfx.play('produced');
          break;
        case 'pointCaptured': {
          const pt = this.world.points[e.point];
          if (e.team === this.team) {
            this.message(`Strategic point captured: ${pt.name}`, 'info');
            this.sfx.play('built');
          } else this.message(`Enemy captured ${pt.name}`, 'warn');
          break;
        }
        case 'pointNeutralized':
          if (e.previousTeam === this.team) {
            this.message(`We lost ${this.world.points[e.point].name}`, 'alert');
            this.sfx.play('alert');
          }
          break;
        case 'researchComplete':
          if (e.player === this.humanId) {
            this.message(`Research complete: ${RESEARCH[e.research].name}`, 'info');
            this.sfx.play('built');
          }
          break;
        case 'built':
          if (e.player === this.humanId) {
            const b = this.world.get(e.id);
            if (b) this.message(`${b.kind === 'building' ? b.def.name : ''} construction complete`, 'info');
            this.sfx.play('built');
          }
          break;
        case 'playerDefeated': {
          const p = this.world.players[e.player];
          if (p.raider) this.message('All waves repelled!', 'info');
          else this.message(`${p.name} has been eliminated`, p.team === this.team ? 'alert' : 'info');
          break;
        }
        case 'waveIncoming': {
          const s = this.world.survival!;
          this.message(
            `Wave ${e.wave}/${s.total} incoming in ${Math.round(e.inTicks / TICK_RATE)} s — press Space to view`,
            'alert',
          );
          this.alerts = [
            ...this.alerts.filter((a) => performance.now() - a.time < 8000).slice(-4),
            { x: e.x, y: e.y, time: performance.now(), building: true },
          ];
          this.sfx.play('alert');
          break;
        }
        case 'promoted':
          if (e.player === this.humanId) {
            if (e.rank >= 3) this.heroic = true;
            const u = this.world.get(e.id);
            this.message(
              `${u?.kind === 'unit' ? u.def.name : 'Unit'} promoted to ${RANK_NAMES[e.rank]}`,
              'info',
            );
            this.sfx.play('produced');
          }
          break;
        case 'flagTaken':
          if (e.team === this.team) {
            this.message('Our flag has been taken!', 'alert');
            this.sfx.play('alert');
            this.alerts = [
              ...this.alerts.filter((a) => performance.now() - a.time < 8000).slice(-4),
              { x: e.x, y: e.y, time: performance.now(), building: true },
            ];
          } else if (e.by === this.team) this.message('We have the enemy flag — bring it home!', 'info');
          break;
        case 'flagDropped':
          this.message(
            e.team === this.team ? 'Our flag was dropped — recover it!' : 'The enemy flag was dropped',
            'warn',
          );
          break;
        case 'flagReturned':
          this.message(
            e.team === this.team ? 'Our flag is back home' : 'The enemy recovered their flag',
            'info',
          );
          break;
        case 'flagCaptured':
          if (e.team === this.team) {
            this.message('Flag captured!', 'info');
            this.sfx.play('built');
          } else this.message('The enemy captured our flag!', 'alert');
          break;
        case 'creditsSent':
          if (e.from === this.humanId)
            this.message(`Sent ${e.amount} credits to ${this.world.players[e.to].name}`);
          else if (e.to === this.humanId)
            this.message(`${this.world.players[e.from].name} sent you ${e.amount} credits`, 'info');
          break;
        case 'upgraded':
          if (e.player === this.humanId) {
            const b = this.world.get(e.id);
            this.message(`${b?.kind === 'building' ? b.def.name : 'Building'} upgraded to level 2`, 'info');
            this.sfx.play('built');
          }
          break;
        case 'sold':
          if (e.player === this.humanId) this.message(`Building sold for ${e.refund} credits`, 'info');
          break;
        case 'waveSpawned':
          this.message(`Wave ${e.wave}: ${e.count} hostiles entering the area`, 'warn');
          break;
        case 'gameOver':
          this.finished = true;
          this.events.emit('gameOver', this.result());
          break;
      }
    }
    // Drop dead entities from the selection.
    for (const id of this.selection) if (!this.world.get(id)) this.selection.delete(id);
  }

  drainRenderEvents(): GameEvent[] {
    const out = this.renderEvents;
    this.renderEvents = [];
    return out;
  }

  result(): MatchResult {
    const victory = this.world.winningTeam === this.team;
    const durationSec = Math.floor((this.world.tick * TICK_MS) / 1000);
    const me = this.human;
    const rank: Record<string, number> = { easy: 0, normal: 1, hard: 2, insane: 3 };
    const enemyDifficulty =
      this.world.players
        .filter((p) => p.team !== me.team && p.isAI && !p.raider && p.difficulty)
        .map((p) => p.difficulty!)
        .sort((a, b) => rank[b] - rank[a])[0] ?? null;
    const waves = this.world.survival
      ? { reached: this.world.survival.wave, total: this.world.survival.total }
      : null;
    return {
      victory,
      durationSec,
      summary: {
        victory,
        mission: this.world.mission,
        mapId: this.config.mapId,
        mapName: this.world.map.name,
        faction: me.faction,
        durationSec,
        kills: me.stats.kills,
        unitsBuilt: me.stats.unitsBuilt,
        unitsLost: me.stats.unitsLost,
        creditsEarned: me.stats.creditsEarned,
        enemyDifficulty,
        waves,
        campaignMission: this.config.campaignMission ?? null,
        heroic: this.heroic,
      },
      mapName: this.world.map.name,
      mission: this.world.mission,
      campaignMission: this.config.campaignMission ?? null,
      waves,
      players: this.world.players.map((p) => ({
        name: p.name,
        faction: p.faction,
        team: p.team,
        isAI: p.isAI,
        raider: p.raider,
        color: p.color,
        defeated: p.defeated,
        stats: { ...p.stats },
      })),
    };
  }

  surrender(): void {
    for (const e of [...this.world.playerBuildings(this.humanId), ...this.world.playerUnits(this.humanId)])
      this.world.destroy(e);
  }

  message(text: string, tone: 'info' | 'warn' | 'alert' = 'info'): void {
    this.events.emit('message', { text, tone });
  }

  private issue(cmd: Command): boolean {
    const r = this.world.issue(cmd);
    if (!r.ok) {
      this.message(r.reason, 'warn');
      this.sfx.play('error');
    } else if (cmd.type !== 'rally') {
      this.sfx.play('click');
    }
    return r.ok;
  }

  // ------------------------------------------------------------- selection

  selected(): Entity[] {
    const out: Entity[] = [];
    for (const id of this.selection) {
      const e = this.world.get(id);
      if (e) out.push(e);
    }
    return out;
  }

  selectedOwnUnits(): Unit[] {
    return this.selected().filter((e): e is Unit => e.kind === 'unit' && e.owner === this.humanId);
  }

  selectedBuilding(): Building | null {
    const s = this.selected();
    return s.length === 1 && s[0].kind === 'building' ? s[0] : null;
  }

  setSelection(ids: EntityId[], additive = false): void {
    if (!additive) this.selection.clear();
    for (const id of ids) this.selection.add(id);
    this.commandMode = 'none';
  }

  toggleSelection(id: EntityId): void {
    if (this.selection.has(id)) this.selection.delete(id);
    else this.selection.add(id);
  }

  setGroup(n: number): void {
    this.groups.set(
      n,
      this.selectedOwnUnits().map((u) => u.id),
    );
    this.message(`Group ${n} assigned`);
  }

  recallGroup(n: number): boolean {
    const ids = (this.groups.get(n) ?? []).filter((id) => this.world.get(id));
    if (!ids.length) return false;
    this.setSelection(ids);
    return true;
  }

  selectAllArmy(): void {
    this.setSelection(
      this.world
        .playerUnits(this.humanId)
        .filter((u) => u.def.weapon)
        .map((u) => u.id),
    );
  }

  // ------------------------------------------------------------- unit commands

  moveSelected(x: number, y: number, attackMove = false): boolean {
    const units = this.selectedOwnUnits();
    if (!units.length) {
      const b = this.selectedBuilding();
      if (b && b.owner === this.humanId && b.def.produces) {
        this.issue({ type: 'rally', player: this.humanId, producer: b.id, x, y });
        return true;
      }
      return false;
    }
    return this.issue({
      type: 'move',
      player: this.humanId,
      units: units.map((u) => u.id),
      x,
      y,
      attackMove,
    });
  }

  attackTarget(target: EntityId): boolean {
    const units = this.selectedOwnUnits();
    if (!units.length) return false;
    return this.issue({ type: 'attack', player: this.humanId, units: units.map((u) => u.id), target });
  }

  stopSelected(): void {
    const units = this.selectedOwnUnits();
    if (units.length) this.issue({ type: 'stop', player: this.humanId, units: units.map((u) => u.id) });
  }

  holdSelected(): void {
    const units = this.selectedOwnUnits();
    if (units.length) this.issue({ type: 'hold', player: this.humanId, units: units.map((u) => u.id) });
  }

  patrolSelected(x: number, y: number): boolean {
    const units = this.selectedOwnUnits();
    if (!units.length) return false;
    return this.issue({ type: 'patrol', player: this.humanId, units: units.map((u) => u.id), x, y });
  }

  /** Selected infantry get into a friendly transport / bunker. */
  loadInto(carrier: EntityId): boolean {
    const units = this.selectedOwnUnits().filter((u) => u.def.category === 'infantry');
    if (!units.length) return false;
    return this.issue({ type: 'load', player: this.humanId, units: units.map((u) => u.id), carrier });
  }

  /** Unloads every selected carrier that has passengers. */
  unloadSelected(): void {
    for (const e of this.selected())
      if (e.owner === this.humanId && e.passengers.length)
        this.issue({ type: 'unload', player: this.humanId, carrier: e.id });
  }

  sendCredits(to: PlayerId, amount: number): void {
    this.issue({ type: 'transfer', player: this.humanId, to, amount });
  }

  upgradeBuilding(id: EntityId): void {
    this.issue({ type: 'upgrade', player: this.humanId, building: id });
  }

  sellBuilding(id: EntityId): void {
    if (this.issue({ type: 'sell', player: this.humanId, building: id })) this.selection.delete(id);
  }

  retreatSelected(): void {
    const units = this.selectedOwnUnits();
    if (units.length) this.issue({ type: 'retreat', player: this.humanId, units: units.map((u) => u.id) });
  }

  // ------------------------------------------------------------- economy commands

  producerFor(unit: UnitTypeId): Building | null {
    const sel = this.selectedBuilding();
    const def = UNITS[unit];
    if (sel && sel.owner === this.humanId && sel.type === def.producedBy && sel.complete) return sel;
    // Otherwise pick the producer with the shortest queue.
    const options = this.world
      .playerBuildings(this.humanId)
      .filter((b) => b.type === def.producedBy && b.complete)
      .sort((a, b) => a.queue.length - b.queue.length);
    return options[0] ?? null;
  }

  produce(unit: UnitTypeId): void {
    const b = this.producerFor(unit);
    if (!b) {
      this.message(`Requires ${BUILDINGS[UNITS[unit].producedBy].name}`, 'warn');
      return;
    }
    this.issue({ type: 'produce', player: this.humanId, producer: b.id, unit });
  }

  cancelProduction(producer: EntityId): void {
    this.issue({ type: 'cancel', player: this.humanId, producer });
  }

  research(building: EntityId, research: ResearchId): void {
    this.issue({ type: 'research', player: this.humanId, building, research });
  }

  cancelResearch(building: EntityId): void {
    this.issue({ type: 'cancelResearch', player: this.humanId, building });
  }

  toggleRepair(building: EntityId): void {
    const b = this.world.get(building);
    if (!b || b.kind !== 'building') return;
    this.issue({ type: 'repair', player: this.humanId, building, on: !b.repairing });
  }

  beginPlacement(type: BuildingTypeId): void {
    if (!BUILDABLE.includes(type)) return;
    const def = BUILDINGS[type];
    if (!this.world.requirementsMet(this.humanId, def.requires)) {
      this.message(`Requires ${def.requires.map((r) => BUILDINGS[r].name).join(', ')}`, 'warn');
      return;
    }
    if (this.human.credits < def.cost) {
      this.message('Insufficient credits', 'warn');
      return;
    }
    this.placing = type;
    this.commandMode = 'none';
  }

  cancelPlacement(): void {
    this.placing = null;
  }

  place(tx: number, ty: number, keepPlacing = false): boolean {
    if (!this.placing) return false;
    const ok = this.issue({ type: 'build', player: this.humanId, building: this.placing, tx, ty });
    if (ok && !keepPlacing) this.placing = null;
    return ok;
  }

  cancelConstruction(id: EntityId): void {
    this.issue({ type: 'cancelBuild', player: this.humanId, building: id });
    this.selection.delete(id);
  }

  centerOn(x: number, y: number): void {
    this.events.emit('centerCamera', { x, y });
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /** Cycles through GAME_SPEEDS (dir = +1 faster, -1 slower). */
  stepSpeed(dir: 1 | -1): void {
    const i = GAME_SPEEDS.indexOf(this.speed as (typeof GAME_SPEEDS)[number]);
    const next = GAME_SPEEDS[Math.max(0, Math.min(GAME_SPEEDS.length - 1, (i < 0 ? 1 : i) + dir))];
    this.speed = next;
    this.message(`Game speed ×${next}`);
  }

  /** Space: jump to the latest unvisited attack alert (< 8 s old), otherwise to the base. */
  jumpToAlertOrBase(): void {
    const a = this.alerts[this.alerts.length - 1];
    if (a && a.time !== this.lastJumpedAlert && performance.now() - a.time < 8000) {
      this.lastJumpedAlert = a.time;
      this.centerOn(a.x, a.y);
      return;
    }
    this.centerOnBase();
  }

  centerOnBase(): void {
    const hq = this.world.playerBuildings(this.humanId)[0];
    if (hq) this.centerOn(hq.x, hq.y);
  }

  destroy(): void {
    this.events.clear();
    this.sfx.destroy();
  }
}
