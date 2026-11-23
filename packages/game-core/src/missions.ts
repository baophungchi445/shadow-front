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
  /**
   * v0.17: mission-specific setup run once right after the World is created (before AI commanders start):
   * replaces the standard start (HQ + 5 units) for missions that begin differently.
   */
  setup?: (world: World, pid: PlayerId) => void;
}

const enemies = (w: World, pid: PlayerId) =>
  w.players.filter((p) => !p.raider && p.team !== w.players[pid].team);
const pointHeld = (w: World, pid: PlayerId, name: string) =>
  w.points.some((pt) => pt.name === name && pt.team === w.players[pid].team);

/** Iron Convoy: the forward base site (Frozen Crossroads, the middle of Snowfield). */
export const CONVOY_SITE = { x: 31.5, y: 31.5, radius: 7 };
/** Iron Convoy: how long the forward base must stand (5 minutes). */
export const CONVOY_HOLD_TICKS = 5 * 60 * 20;
const forwardBase = (w: World, pid: PlayerId) =>
  w
    .playerBuildings(pid)
    .find(
      (b) =>
        b.type === 'headquarters' && Math.hypot(b.x - CONVOY_SITE.x, b.y - CONVOY_SITE.y) <= CONVOY_SITE.radius,
    );

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
  {
    id: 'iron-convoy',
    title: 'Iron Convoy',
    subtitle: 'Snowfield · night escort',
    briefing:
      'A blizzard covers our advance. We have no base here: only a Mobile Command Vehicle and its escort. ' +
      'Bring the MCV to the Frozen Crossroads in the middle of the snowfield, deploy it into a forward base and hold ' +
      'it for five minutes while the Iron Guard counter-attacks. Expect an ambush on the way. Then crush them.',
    objectives: [
      {
        id: 'escort',
        title: 'Escort the MCV to the Frozen Crossroads',
        hint: 'Move the convoy together: tanks in front. The crossroads is the flag in the middle of the map.',
        done: (w, pid) =>
          !!forwardBase(w, pid) ||
          w
            .playerUnits(pid)
            .some(
              (u) =>
                u.type === 'mcv' && Math.hypot(u.x - CONVOY_SITE.x, u.y - CONVOY_SITE.y) <= CONVOY_SITE.radius,
            ),
      },
      {
        id: 'deploy',
        title: 'Deploy the forward base',
        hint: 'Select the MCV at the crossroads and press U (Deploy). It unfolds into a Headquarters.',
        done: (w, pid) => !!forwardBase(w, pid)?.complete,
      },
      {
        id: 'hold',
        title: 'Hold the forward base for 5 minutes',
        hint: 'Build Power Plants, Barracks and turrets around the new Headquarters. If it falls, the clock restarts.',
        done: (w, pid) => {
          // The clock starts when the forward base is complete and restarts if it is lost.
          const key = `hold:${pid}`;
          if (!forwardBase(w, pid)?.complete) {
            w.missionMarks.delete(key);
            return false;
          }
          if (!w.missionMarks.has(key)) w.missionMarks.set(key, w.tick);
          return w.tick - w.missionMarks.get(key)! >= CONVOY_HOLD_TICKS;
        },
      },
      {
        id: 'destroy',
        title: 'Destroy the Iron Guard',
        hint: 'Annihilation: every enemy building and unit must fall. Tanks and artillery break their defenses.',
        done: (w, pid) => enemies(w, pid).every((p) => p.defeated),
      },
    ],
    ordered: true,
    config: (name, seed) => ({
      mapId: 'snowfield',
      mission: 'annihilation',
      startingCredits: 5000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      campaignMission: 'iron-convoy',
      weather: 'snow',
      dayTime: 'night',
      slots: [
        { kind: 'human', name, faction: 'western', team: 0 },
        {
          kind: 'ai',
          name: 'Iron Guard',
          faction: 'iron',
          team: 1,
          difficulty: 'normal',
          personality: 'rush',
        },
      ],
    }),
    setup: (w, pid) => {
      // No base: the standard HQ is removed; the convoy (MCV + escort) starts at the north-west corner.
      for (const b of w.playerBuildings(pid)) w.removeBuilding(b);
      const s = w.map.spawns[w.players[pid].spawnIndex];
      const convoy: [string, number, number][] = [
        ['mcv', 2, 2],
        ['main-battle-tank', 4, 4],
        ['main-battle-tank', 3, 5],
        ['engineer', 1, 3],
      ];
      for (const [type, dx, dy] of convoy)
        w.createUnit(pid, type as Parameters<World['createUnit']>[1], s.tx + dx + 0.5, s.ty + dy + 0.5);
      // An Iron Guard ambush halfway to the crossroads.
      const foe = enemies(w, pid)[0];
      if (foe) {
        for (const [type, x, y] of [
          ['rifleman', 18.5, 21.5],
          ['rifleman', 19.5, 22.5],
          ['at-soldier', 21.5, 18.5],
          ['at-soldier', 22.5, 19.5],
          ['at-soldier', 17.5, 19.5],
          ['light-tank', 20.5, 20.5],
          ['light-tank', 22.5, 22.5],
        ] as [string, number, number][]) {
          const u = w.createUnit(foe.id, type as Parameters<World['createUnit']>[1], x, y);
          u.guard = true; // the ambush stays put (the enemy AI does not pull it home)
          w.issue({ type: 'hold', player: foe.id, units: [u.id] });
        }
      }
    },
  },
  {
    id: 'shadow-front',
    title: 'Shadow Front',
    subtitle: 'Forest Warfare · final battle, 2 vs 2',
    briefing:
      'This is the last front. The Shadow Legion and the Black Sun have joined forces, and their commanders learn: ' +
      'they read how you fight and change their plans. Fight beside the Northern Wing, take every strategic point ' +
      'in the forest and destroy both enemy Headquarters. Vary your tactics — they will see a pattern.',
    objectives: [
      {
        id: 'all-points',
        title: 'Hold all 3 strategic points at once',
        hint: 'The forest points give income and vision. Your ally helps; hold them together.',
        done: (w, pid) => w.points.every((pt) => pt.team === w.players[pid].team),
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
      mapId: 'forest-warfare',
      mission: 'decapitation',
      startingCredits: 10000,
      seed,
      unitCap: DEFAULT_UNIT_CAP,
      campaignMission: 'shadow-front',
      dayTime: 'cycle',
      slots: [
        { kind: 'human', name, faction: 'western', team: 0 },
        {
          kind: 'ai',
          name: 'Northern Wing',
          faction: 'pacific',
          team: 0,
          difficulty: 'hard',
          personality: 'warlord',
        },
        {
          kind: 'ai',
          name: 'Shadow Legion',
          faction: 'eastern',
          team: 1,
          difficulty: 'hard',
          personality: 'shadow',
        },
        {
          kind: 'ai',
          name: 'Black Sun',
          faction: 'desert',
          team: 1,
          difficulty: 'hard',
          personality: 'eagle',
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
