import { it } from 'vitest';
import type { MapId, Personality } from '@shadow-front/shared-types';
import { World } from '@shadow-front/game-core';
import { AICommander } from './index';

const NAVAL = ['patrol-boat', 'destroyer', 'submarine', 'landing-craft'] as const;
it('naval balance sim', () => {
  const rows: string[] = [];
  const pers: Personality[] = ['warlord', 'rush', 'fortress', 'eagle'];
  for (const [mapId, sea] of [['coastal-front', false], ['strait-crossing', false], ['random', true]] as [MapId, boolean][])
    for (let seed = 1; seed <= 6; seed++) {
      const w = new World({
        mapId, mapSeed: seed, mapSea: sea, mission: 'annihilation', startingCredits: 5000, seed, unitCap: 150,
        slots: [
          { kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: pers[seed % 4] },
          { kind: 'ai', name: 'B', faction: 'eastern', team: 1, difficulty: 'hard', personality: pers[(seed + 1) % 4] },
        ],
      });
      const ais = w.players.map((p) => new AICommander(w, p.id));
      let t = 0;
      for (; t < 20 * 60 * 30 && w.winningTeam === null; t++) { for (const a of ais) a.update(); w.step(); }
      const s = w.players.map((p) => {
        const by = p.stats.byUnit;
        const built = NAVAL.map((u) => by[u]?.built ?? 0);
        const kills = NAVAL.reduce((k, u) => k + (by[u]?.kills ?? 0), 0);
        return `${p.personality}: ships built ${built.join('/')} lost ${p.stats.shipsLost ?? 0} navalKills ${kills}/${p.stats.kills}`;
      });
      rows.push(`${mapId}${sea ? '+sea' : ''} s${seed} ${(t / 1200).toFixed(1)}min winner=${w.winningTeam} | ${s.join(' | ')}`);
    }
  console.log('\n' + rows.join('\n'));
}, 600000);
