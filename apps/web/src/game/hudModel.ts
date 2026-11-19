import type { BuildingTypeId, EntityId, ResearchId, UnitTypeId } from '@shadow-front/shared-types';
import {
  BUILDABLE,
  BUILDINGS,
  FACTIONS,
  RESEARCH,
  RESEARCH_IDS,
  TICK_RATE,
  UNITS,
} from '@shadow-front/game-data';
import type { GameController } from './GameController';

export interface BuildOption {
  type: BuildingTypeId;
  name: string;
  cost: number;
  power: number;
  available: boolean;
  reason: string | null;
  constructing: number | null;
}

export interface UnitOption {
  type: UnitTypeId;
  name: string;
  cost: number;
  available: boolean;
  reason: string | null;
  queued: number;
}

export interface ResearchOption {
  id: ResearchId;
  name: string;
  cost: number;
  description: string;
  done: boolean;
  /** 0..1 when being researched at the selected building, else null. */
  progress: number | null;
  available: boolean;
  reason: string | null;
}

export interface QueueItem {
  type: UnitTypeId;
  progress: number;
}

export type SelectionInfo =
  | { kind: 'none' }
  | {
      kind: 'units';
      own: boolean;
      groups: { type: UnitTypeId; name: string; count: number; hp: number }[];
      single: {
        id: EntityId;
        name: string;
        owner: string;
        hp: number;
        maxHp: number;
        order: string;
        weapon: string;
        description: string;
      } | null;
    }
  | {
      kind: 'building';
      id: EntityId;
      type: BuildingTypeId;
      name: string;
      owner: string;
      own: boolean;
      hp: number;
      maxHp: number;
      complete: boolean;
      progress: number;
      description: string;
      queue: QueueItem[];
      options: UnitOption[];
      research: ResearchOption[];
      repairing: boolean;
      damaged: boolean;
    };

export interface HudSnapshot {
  credits: number;
  powerProduced: number;
  powerUsed: number;
  time: number;
  mission: string;
  mapName: string;
  paused: boolean;
  speed: number;
  placing: BuildingTypeId | null;
  commandMode: string;
  selection: SelectionInfo;
  build: BuildOption[];
  army: { units: number; buildings: number };
  points: { owned: number; total: number };
  /** Survival only. `nextIn` is seconds until the next wave (null once all waves are out). */
  survival: { wave: number; total: number; nextIn: number | null; hostiles: number } | null;
  /** Tutorial only: objectives and the index of the current one (=== steps.length when finished). */
  tutorial: { index: number; steps: { title: string; hint: string }[] } | null;
  players: {
    name: string;
    team: number;
    color: number;
    faction: string;
    defeated: boolean;
    isAI: boolean;
    raider: boolean;
    you: boolean;
  }[];
}

function orderLabel(o: { type: string; attackMove?: boolean }): string {
  switch (o.type) {
    case 'move':
      return o.attackMove ? 'Attack-moving' : 'Moving';
    case 'attack':
      return 'Attacking';
    case 'hold':
      return 'Holding position';
    case 'retreat':
      return 'Retreating';
    default:
      return 'Idle';
  }
}

export function snapshotHud(c: GameController): HudSnapshot {
  const w = c.world;
  const me = c.human;
  const pid = c.humanId;

  const constructing = new Map<BuildingTypeId, number>();
  for (const b of w.playerBuildings(pid)) if (!b.complete) constructing.set(b.type, b.progress);
  const build: BuildOption[] = BUILDABLE.map((type) => {
    const def = BUILDINGS[type];
    const reqOk = w.requirementsMet(pid, def.requires);
    const reason = !reqOk
      ? `Requires ${def.requires.map((r) => BUILDINGS[r].name).join(', ')}`
      : me.credits < def.cost
        ? 'Insufficient credits'
        : null;
    return {
      type,
      name: def.name,
      cost: def.cost,
      power: def.power,
      available: reason === null,
      reason,
      constructing: constructing.get(type) ?? null,
    };
  });

  let selection: SelectionInfo = { kind: 'none' };
  const sel = c.selected();
  if (sel.length) {
    const first = sel[0];
    if (first.kind === 'building' && sel.length === 1) {
      const b = first;
      const own = b.owner === pid;
      const options: UnitOption[] = b.def.produces
        ? (Object.keys(UNITS) as UnitTypeId[])
            .filter((t) => UNITS[t].producedBy === b.type)
            .map((t) => {
              const def = UNITS[t];
              const cost = w.unitCost(pid, t);
              const reqOk = w.requirementsMet(pid, def.requires);
              const reason = !b.complete
                ? 'Under construction'
                : !reqOk
                  ? `Requires ${def.requires.map((r) => BUILDINGS[r].name).join(', ')}`
                  : b.queue.length >= 5
                    ? 'Queue full'
                    : me.credits < cost
                      ? 'Insufficient credits'
                      : null;
              return {
                type: t,
                name: def.name,
                cost,
                available: reason === null,
                reason,
                queued: b.queue.filter((q) => q === t).length,
              };
            })
        : [];
      selection = {
        kind: 'building',
        id: b.id,
        type: b.type,
        name: b.def.name,
        owner: w.players[b.owner].name,
        own,
        hp: Math.ceil(b.hp),
        maxHp: b.maxHp,
        complete: b.complete,
        progress: b.progress,
        description: b.def.description,
        queue: own
          ? b.queue.map((t, i) => ({ type: t, progress: i === 0 ? b.queueProgress / UNITS[t].buildTime : 0 }))
          : [],
        options: own ? options : [],
        research:
          own && b.type === 'research-center'
            ? RESEARCH_IDS.map((id) => {
                const def = RESEARCH[id];
                const done = w.hasResearch(pid, id);
                const elsewhere = w.playerBuildings(pid).some((o) => o !== b && o.research?.id === id);
                const reason = done
                  ? 'Researched'
                  : !b.complete
                    ? 'Under construction'
                    : b.research
                      ? b.research.id === id
                        ? 'In progress'
                        : 'Research Center busy'
                      : elsewhere
                        ? 'In progress elsewhere'
                        : me.credits < def.cost
                          ? 'Insufficient credits'
                          : null;
                return {
                  id,
                  name: def.name,
                  cost: def.cost,
                  description: def.description,
                  done,
                  progress: b.research?.id === id ? b.research.progress / def.time : null,
                  available: reason === null,
                  reason,
                };
              })
            : [],
        repairing: b.repairing,
        damaged: b.complete && b.hp < b.maxHp,
      };
    } else {
      const units = sel.filter((e) => e.kind === 'unit');
      const groups = new Map<UnitTypeId, { type: UnitTypeId; name: string; count: number; hp: number }>();
      for (const u of units) {
        if (u.kind !== 'unit') continue;
        const g = groups.get(u.type) ?? { type: u.type, name: u.def.name, count: 0, hp: 0 };
        g.count++;
        g.hp += u.hp / u.maxHp;
        groups.set(u.type, g);
      }
      const one = units.length === 1 && units[0].kind === 'unit' ? units[0] : null;
      selection = {
        kind: 'units',
        own: units.some((u) => u.owner === pid),
        groups: [...groups.values()].map((g) => ({ ...g, hp: g.hp / g.count })),
        single: one
          ? {
              id: one.id,
              name: one.def.name,
              owner: w.players[one.owner].name,
              hp: Math.ceil(one.hp),
              maxHp: one.maxHp,
              order: orderLabel(one.order),
              weapon: one.def.weapon
                ? `${one.def.weapon.type} · ${one.def.weapon.damage} dmg · range ${one.def.weapon.range}`
                : 'Unarmed',
              description: one.def.description,
            }
          : null,
      };
    }
  }

  return {
    credits: Math.floor(me.credits),
    powerProduced: me.powerProduced,
    powerUsed: me.powerUsed,
    time: Math.floor(w.tick / TICK_RATE),
    mission: w.mission,
    mapName: w.map.name,
    paused: c.paused,
    speed: c.speed,
    placing: c.placing,
    commandMode: c.commandMode,
    selection,
    build,
    army: { units: w.playerUnits(pid).length, buildings: w.playerBuildings(pid).length },
    points: { owned: w.points.filter((p) => p.team === me.team).length, total: w.points.length },
    survival: w.survival
      ? {
          wave: w.survival.wave,
          total: w.survival.total,
          nextIn:
            w.survival.wave < w.survival.total
              ? Math.max(0, Math.ceil((w.survival.nextWaveTick - w.tick) / TICK_RATE))
              : null,
          hostiles: w.playerUnits(w.survival.raider).length,
        }
      : null,
    tutorial: c.tutorial
      ? { index: c.tutorial.index, steps: c.tutorial.steps.map((s) => ({ title: s.title, hint: s.hint })) }
      : null,
    players: w.players.map((p) => ({
      name: p.name,
      team: p.team,
      color: p.color,
      faction: FACTIONS[p.faction].name,
      defeated: p.defeated,
      isAI: p.isAI,
      raider: p.raider,
      you: p.id === pid,
    })),
  };
}
