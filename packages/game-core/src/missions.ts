import type { MatchConfig, PlayerId } from '@shadow-front/shared-types';
import { DEFAULT_UNIT_CAP } from '@shadow-front/game-data';
import type { World } from './world';
import { ObjectiveTracker, TUTORIAL_STEPS, tutorialConfig, type TutorialStep } from './tutorial';

/** A campaign mission: briefing, fixed match setup and objectives. Winning the match completes the mission. */
export interface MissionDef {
  id: string;
  title: string;
  /** Short location / situation line. */
  subtitle: string;
  briefing: string;
  objectives: TutorialStep[];
  /** Tutorial-style missions require objectives in order. */
  ordered: boolean;
  config: (name: string, seed: number) => MatchConfig;
}

const enemies = (w: World, pid: PlayerId) =>
  w.players.filter((p) => !p.raider && p.team !== w.players[pid].team);
const pointHeld = (w: World, pid: PlayerId, name: string) =>
  w.points.some((pt) => pt.name === name && pt.team === w.players[pid].team);

export const CAMPAIGN: MissionDef[] = [
  {
    id: 'boot-camp',
    title: 'Boot Camp',
    subtitle: 'Desert Storm · training',
    briefing:
      'Welcome to the front, Commander. Learn to move troops, build a base, train an army and take ground. ' +
      'An undefended enemy outpost sits in the far corner. Destroy it to finish your training.',
    objectives: TUTORIAL_STEPS,
    ordered: true,
    config: (name, seed) => ({ ...tutorialConfig(name, seed), campaignMission: 'boot-camp' }),
  },
  {
    id: 'hold-the-river',
    title: 'Hold the River',
    subtitle: 'River Crossing · defence',
    briefing:
      'Hostile columns are converging on the valley and the bridges are the only fast way across the river. ' +
      'Fortify, take the Central Bridge and hold out until the attack breaks: six waves are expected.',
    objectives: [
      {
        id: 'turret',
        title: 'Build a Defense Turret',
        hint: 'Requires a Barracks. Place turrets toward the river crossings.',
        done: (w, pid) => w.hasCompleted(pid, 'defense-turret'),
      },
      {
        id: 'bridge',
        title: 'Capture the Central Bridge',
        hint: 'Move ground units into the flag circle in the middle of the river.',
        done: (w, pid) => pointHeld(w, pid, 'Central Bridge'),
      },
      {
        id: 'waves',
        title: 'Repel all 6 waves',
        hint: 'Waves are announced 20 s ahead. Press Space to look at the entry point.',
        done: (w) => (w.survival ? w.players[w.survival.raider].defeated : false),
      },
    ],
    ordered: false,
    config: (name, seed) => ({
      mapId: 'river-crossing',
      mission: 'survival',
      startingCredits: 6000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      survival: { difficulty: 'normal', waves: 6 },
      campaignMission: 'hold-the-river',
      slots: [{ kind: 'human', name, faction: 'western', team: 0 }],
    }),
  },
  {
    id: 'iron-fist',
    title: 'Iron Fist',
    subtitle: 'Urban Conflict · 2 vs 2 assault',
    briefing:
      'Two enemy commanders hold the city. An allied AI commander fights at your side. ' +
      'Intelligence reports that the Desert Hawks rely on attack helicopters: tanks cannot shoot them down, ' +
      'so build SAM Sites and AT Soldiers. Upgrade your firepower and destroy both enemy Headquarters.',
    objectives: [
      {
        id: 'factory',
        title: 'Build a War Factory',
        hint: 'Tanks are strong against buildings. The War Factory requires Barracks.',
        done: (w, pid) => w.hasCompleted(pid, 'war-factory'),
      },
      {
        id: 'sam',
        title: 'Build a SAM Site',
        hint: 'SAM Sites shoot down helicopters and drones. AT Soldiers can also hit aircraft.',
        done: (w, pid) => w.hasCompleted(pid, 'sam-site'),
      },
      {
        id: 'munitions',
        title: 'Research Improved Munitions',
        hint: 'Build a Research Center, select it and research Improved Munitions (+15% damage).',
        done: (w, pid) => w.hasResearch(pid, 'improved-munitions'),
      },
      {
        id: 'hqs',
        title: 'Destroy both enemy Headquarters',
        hint: 'Decapitation: a commander is eliminated when its HQ falls.',
        done: (w, pid) => enemies(w, pid).every((p) => p.defeated),
      },
    ],
    ordered: false,
    config: (name, seed) => ({
      mapId: 'urban-conflict',
      mission: 'decapitation',
      startingCredits: 8000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      campaignMission: 'iron-fist',
      slots: [
        { kind: 'human', name, faction: 'western', team: 0 },
        {
          kind: 'ai',
          name: 'Ally',
          faction: 'pacific',
          team: 0,
          difficulty: 'normal',
          personality: 'warlord',
        },
        {
          kind: 'ai',
          name: 'Iron Guard',
          faction: 'iron',
          team: 1,
          difficulty: 'easy',
          personality: 'fortress',
        },
        {
          kind: 'ai',
          name: 'Desert Hawks',
          faction: 'desert',
          team: 1,
          difficulty: 'easy',
          personality: 'eagle',
        },
      ],
    }),
  },
  {
    id: 'highland-siege',
    title: 'Highland Siege',
    subtitle: 'Highland Pass · 1 vs 1 territory',
    briefing:
      'A walled hill town controls the only rich ore in the highlands, and its four passes are the only way in. ' +
      'A seasoned enemy commander wants it too. Take the town, hold every strategic point at once, then crush the enemy.',
    objectives: [
      {
        id: 'town',
        title: 'Capture the Town Square',
        hint: 'Enter the plateau through a pass and hold the flag in the middle of the town.',
        done: (w, pid) => pointHeld(w, pid, 'Town Square'),
      },
      {
        id: 'all-points',
        title: 'Hold all 3 strategic points at once',
        hint: 'North Pass, Town Square and South Pass. Each point gives +6 credits/s.',
        done: (w, pid) => w.points.every((pt) => pt.team === w.players[pid].team),
      },
      {
        id: 'destroy',
        title: 'Destroy all enemy forces',
        hint: 'Annihilation: every enemy building and unit must fall.',
        done: (w, pid) => enemies(w, pid).every((p) => p.defeated),
      },
    ],
    ordered: false,
    config: (name, seed) => ({
      mapId: 'highland-pass',
      mission: 'annihilation',
      startingCredits: 6000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      campaignMission: 'highland-siege',
      slots: [
        { kind: 'human', name, faction: 'western', team: 0 },
        {
          kind: 'ai',
          name: 'Highland Command',
          faction: 'eastern',
          team: 1,
          difficulty: 'normal',
          personality: 'warlord',
        },
      ],
    }),
  },
  {
    id: 'tidewater',
    title: 'Tidewater',
    subtitle: 'Strait Crossing · naval assault',
    briefing:
      'The enemy holds the south shore of the strait and its fleet rules the water. The isthmuses are heavily ' +
      'watched, so this time we go by sea. Build a Naval Yard, win the strait, put troops ashore on the South Shore ' +
      'with Landing Craft and finish the enemy. Beware of submarines: only Patrol Boats can find them.',
    objectives: [
      {
        id: 'yard',
        title: 'Build a Naval Yard',
        hint: 'Requires a War Factory. It must touch the water: build it on the shore of your bay.',
        done: (w, pid) => w.hasCompleted(pid, 'naval-yard'),
      },
      {
        id: 'sink',
        title: 'Sink 3 enemy ships',
        hint: 'Destroyers outgun Patrol Boats; Submarines sink Destroyers; Patrol Boats hunt Submarines.',
        done: (w, pid) => enemies(w, pid).reduce((s, p) => s + (p.stats.shipsLost ?? 0), 0) >= 3,
      },
      {
        id: 'beach',
        title: 'Capture the South Shore',
        hint: 'Load infantry and tanks into a Landing Craft (right-click it), sail across and unload (U) at the beach.',
        done: (w, pid) => pointHeld(w, pid, 'South Shore'),
      },
      {
        id: 'destroy',
        title: 'Destroy all enemy forces',
        hint: 'Annihilation: every enemy building and unit must fall.',
        done: (w, pid) => enemies(w, pid).every((p) => p.defeated),
      },
    ],
    ordered: false,
    config: (name, seed) => ({
      mapId: 'strait-crossing',
      mission: 'annihilation',
      startingCredits: 8000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      campaignMission: 'tidewater',
      slots: [
        { kind: 'human', name, faction: 'western', team: 0 },
        {
          kind: 'ai',
          name: 'Southern Fleet',
          faction: 'pacific',
          team: 1,
          difficulty: 'normal',
          personality: 'warlord',
        },
      ],
    }),
  },
];

export function getMission(id: string | undefined): MissionDef | undefined {
  return CAMPAIGN.find((m) => m.id === id);
}

export function missionTracker(m: MissionDef): ObjectiveTracker {
  return new ObjectiveTracker(m.objectives, m.ordered);
}

/** A mission is playable when it is the first one or the previous mission is completed. */
export function missionUnlocked(id: string, completed: readonly string[]): boolean {
  const i = CAMPAIGN.findIndex((m) => m.id === id);
  return i === 0 || (i > 0 && completed.includes(CAMPAIGN[i - 1].id));
}
