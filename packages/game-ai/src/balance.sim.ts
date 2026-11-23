/**
 * Long AI-vs-AI balance simulations (minutes of CPU time). Not part of `pnpm test`; run with `pnpm --filter
 * @shadow-front/game-ai sim`. They print tables instead of asserting: read them when tuning AI or balance.
 */
import { it } from 'vitest';
import type { MapId, Personality } from '@shadow-front/shared-types';
import { World } from '@shadow-front/game-core';
import { AICommander, Adaptation } from './index';

const MAX_TICKS = 20 * 60 * 30;

function play(w: World, ais = w.players.map((p) => new AICommander(w, p.id))): number {
  let t = 0;
  for (; t < MAX_TICKS && w.winningTeam === null; t++) {
    for (const a of ais) a.update();
    w.step();
  }
  return t;
}

it('spawn fairness: identical Hard Warlords on symmetric maps', () => {
  const tally: Record<string, number> = {};
  for (const mapId of ['desert-storm', 'highland-pass', 'river-crossing', 'forest-warfare', 'island-conflict'] as MapId[])
    for (let seed = 1; seed <= 6; seed++) {
      const w = new World({
        mapId,
        mission: 'annihilation',
        startingCredits: 5000,
        seed,
        unitCap: 150,
        slots: [
          { kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: 'warlord' },
          { kind: 'ai', name: 'B', faction: 'western', team: 1, difficulty: 'hard', personality: 'warlord' },
        ],
      });
      play(w);
      const k = `${mapId}: ${w.winningTeam === null ? 'draw' : `spawn ${w.winningTeam + 1}`}`;
      tally[k] = (tally[k] ?? 0) + 1;
    }
  console.log('\n' + Object.entries(tally).sort().map(([k, v]) => `${k} ×${v}`).join('\n'));
}, 1_800_000);

it('adaptation: adaptive vs non-adaptive Hard commanders (sides swapped)', () => {
  let adaptiveWins = 0;
  let plainWins = 0;
  let draws = 0;
  const tactics: Record<string, number> = {};
  const pers: Personality[] = ['warlord', 'fortress', 'rush', 'eagle'];
  for (const mapId of ['desert-storm', 'river-crossing', 'island-conflict'] as MapId[])
    for (let seed = 1; seed <= 4; seed++)
      for (const adaptiveSlot of [0, 1]) {
        const w = new World({
          mapId,
          mission: 'annihilation',
          startingCredits: 5000,
          seed,
          unitCap: 150,
          slots: [0, 1].map((i) => ({
            kind: 'ai' as const,
            name: i === adaptiveSlot ? 'Adaptive' : 'Plain',
            faction: 'western' as const,
            team: i,
            difficulty: 'hard' as const,
            personality: pers[(seed + i) % 4],
          })),
        });
        const ais = w.players.map((p) => new AICommander(w, p.id));
        (ais[1 - adaptiveSlot] as unknown as { adapt: Adaptation }).adapt = new Adaptation('easy');
        play(w, ais);
        for (const e of ais[adaptiveSlot].adapt.log) tactics[e.tactic] = (tactics[e.tactic] ?? 0) + 1;
        if (w.winningTeam === null) draws++;
        else if (w.winningTeam === adaptiveSlot) adaptiveWins++;
        else plainWins++;
      }
  console.log(
    `\nadaptive ${adaptiveWins} – plain ${plainWins} – draws ${draws}\ntactics used: ${JSON.stringify(tactics)}`,
  );
}, 1_800_000);

it('adaptation: the same Warlord with / without adaptation against a styled opponent', () => {
  const rows: string[] = [];
  for (const style of ['rush', 'fortress'] as Personality[])
    for (const on of [true, false]) {
      let wins = 0;
      let losses = 0;
      let winTicks = 0;
      for (const mapId of ['desert-storm', 'river-crossing'] as MapId[])
        for (let seed = 1; seed <= 12; seed++) {
          const w = new World({
            mapId,
            mission: 'annihilation',
            startingCredits: 5000,
            seed,
            unitCap: 150,
            slots: [
              { kind: 'ai', name: 'Test', faction: 'western', team: 0, difficulty: 'hard', personality: 'warlord' },
              { kind: 'ai', name: 'Foe', faction: 'western', team: 1, difficulty: 'hard', personality: style },
            ],
          });
          const ais = w.players.map((p) => new AICommander(w, p.id));
          (ais[1] as unknown as { adapt: Adaptation }).adapt = new Adaptation('easy');
          if (!on) (ais[0] as unknown as { adapt: Adaptation }).adapt = new Adaptation('easy');
          const t = play(w, ais);
          if (w.winningTeam === 0) {
            wins++;
            winTicks += t;
          } else if (w.winningTeam === 1) losses++;
        }
      rows.push(
        `vs ${style} adaptation ${on ? 'ON ' : 'OFF'}: won ${wins} lost ${losses} draw ${24 - wins - losses}` +
          (wins ? `, avg win ${(winTicks / wins / 1200).toFixed(1)} min` : ''),
      );
    }
  console.log('\n' + rows.join('\n'));
}, 1_800_000);

const NAVAL = ['patrol-boat', 'destroyer', 'submarine', 'landing-craft'] as const;

it('naval: ships built / lost on sea maps', () => {
  const rows: string[] = [];
  const pers: Personality[] = ['warlord', 'rush', 'fortress', 'eagle'];
  for (const [mapId, sea] of [['coastal-front', false], ['strait-crossing', false], ['random', true]] as [MapId, boolean][])
    for (let seed = 1; seed <= 6; seed++) {
      const w = new World({
        mapId,
        mapSeed: seed,
        mapSea: sea,
        mission: 'annihilation',
        startingCredits: 5000,
        seed,
        unitCap: 150,
        slots: [
          { kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: pers[seed % 4] },
          { kind: 'ai', name: 'B', faction: 'eastern', team: 1, difficulty: 'hard', personality: pers[(seed + 1) % 4] },
        ],
      });
      const t = play(w);
      const s = w.players.map((p) => {
        const by = p.stats.byUnit;
        const built = NAVAL.map((u) => by[u]?.built ?? 0);
        const kills = NAVAL.reduce((k, u) => k + (by[u]?.kills ?? 0), 0);
        return `${p.personality}: built ${built.join('/')} lost ${p.stats.shipsLost ?? 0} ship kills ${kills}/${p.stats.kills}`;
      });
      rows.push(`${mapId}${sea ? '+sea' : ''} s${seed} ${(t / 1200).toFixed(1)}min winner=${w.winningTeam} | ${s.join(' | ')}`);
    }
  console.log('\nships built: patrol/destroyer/submarine/landing\n' + rows.join('\n'));
}, 1_800_000);
