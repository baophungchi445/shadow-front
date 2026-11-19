import type { MatchConfig, PlayerId } from '@shadow-front/shared-types';
import { DEFAULT_UNIT_CAP } from '@shadow-front/game-data';
import type { World } from './world';

/** UI facts the simulation cannot know (what the player has selected). */
export interface TutorialInput {
  selectedOwnUnits: number;
}

/** One objective (tutorial step or mission goal). */
export interface TutorialStep {
  id: string;
  title: string;
  hint: string;
  done: (world: World, pid: PlayerId, ui: TutorialInput) => boolean;
}

export const enemyOf = (world: World, pid: PlayerId) =>
  world.players.find((p) => p.team !== world.players[pid].team);

/** Guided objectives, completed strictly in order. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'select',
    title: 'Select your soldiers',
    hint: 'Left-drag a box around your starting units (or press Q to select your whole army).',
    done: (_w, _p, ui) => ui.selectedOwnUnits > 0,
  },
  {
    id: 'move',
    title: 'Move out',
    hint: 'With units selected, right-click on open ground to move them there.',
    done: (w, pid) => w.playerUnits(pid).some((u) => u.order.type === 'move' || u.moving),
  },
  {
    id: 'power',
    title: 'Build a Power Plant',
    hint: 'Click Power Plant in the Construction panel (bottom right), then click near your HQ. Every building needs power.',
    done: (w, pid) => w.hasCompleted(pid, 'power-plant'),
  },
  {
    id: 'extractor',
    title: 'Build a Resource Extractor',
    hint: 'Place a Resource Extractor right next to the dark ore field near your base. It earns credits until the ore runs out.',
    done: (w, pid) => w.hasCompleted(pid, 'resource-extractor'),
  },
  {
    id: 'barracks',
    title: 'Build Barracks',
    hint: 'Barracks train infantry. Build one near your HQ.',
    done: (w, pid) => w.hasCompleted(pid, 'barracks'),
  },
  {
    id: 'train',
    title: 'Train 3 units',
    hint: 'Select the Barracks and click Rifleman or AT Soldier three times. Right-click the map to set a rally point.',
    done: (w, pid) => w.players[pid].stats.unitsBuilt >= 3,
  },
  {
    id: 'capture',
    title: 'Capture a strategic point',
    hint: 'Move ground units into a flag circle and keep them there. Each point gives +6 credits/s and vision.',
    done: (w, pid) => w.points.some((pt) => pt.team === w.players[pid].team),
  },
  {
    id: 'destroy',
    title: 'Destroy the enemy outpost',
    hint: 'The outpost is in the far corner. Build a War Factory for tanks (strong against buildings), press Q, then right-click the enemy HQ.',
    done: (w, pid) => enemyOf(w, pid)?.defeated ?? false,
  },
];

/**
 * Tracks objectives for one player. `ordered` objectives must be completed one after another (tutorial);
 * unordered ones complete independently (campaign missions). A completed objective stays completed.
 */
export class ObjectiveTracker {
  readonly done: boolean[];
  constructor(
    readonly steps: TutorialStep[],
    readonly ordered = true,
  ) {
    this.done = steps.map(() => false);
  }

  /** Index of the first unfinished objective (=== steps.length when all are done). */
  get index(): number {
    const i = this.done.indexOf(false);
    return i < 0 ? this.steps.length : i;
  }

  /** Marks the first `n` objectives done (used to resume or skip). */
  set index(n: number) {
    this.done.forEach((_, i) => (this.done[i] = i < n));
  }

  get finished(): boolean {
    return this.done.every(Boolean);
  }

  get current(): TutorialStep | null {
    return this.steps[this.index] ?? null;
  }

  /** Re-checks objectives. Returns the ones completed by this call. */
  update(world: World, pid: PlayerId, ui: TutorialInput): TutorialStep[] {
    const completed: TutorialStep[] = [];
    if (this.ordered) {
      while (!this.finished && this.steps[this.index].done(world, pid, ui)) {
        completed.push(this.steps[this.index]);
        this.done[this.index] = true;
      }
    } else {
      this.steps.forEach((s, i) => {
        if (!this.done[i] && s.done(world, pid, ui)) {
          this.done[i] = true;
          completed.push(s);
        }
      });
    }
    return completed;
  }
}

/** Tutorial objectives, completed strictly in order. */
export class TutorialTracker extends ObjectiveTracker {
  constructor(steps: TutorialStep[] = TUTORIAL_STEPS) {
    super(steps, true);
  }
}

/** Fixed match setup for the tutorial: you vs. a passive enemy outpost on Desert Storm. */
export function tutorialConfig(name = 'Commander', seed = 1): MatchConfig {
  return {
    mapId: 'desert-storm',
    mission: 'tutorial',
    startingCredits: 8000,
    seed,
    unitCap: DEFAULT_UNIT_CAP,
    slots: [
      { kind: 'human', name, faction: 'western', team: 0 },
      { kind: 'ai', name: 'Enemy Outpost', faction: 'eastern', team: 1, difficulty: 'easy' },
    ],
  };
}
