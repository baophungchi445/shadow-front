import { it } from 'vitest';
import type { MapId } from '@shadow-front/shared-types';
import { World } from '@shadow-front/game-core';
import { AICommander } from './index';
it('slot vs position', () => {
  const tally: Record<string, number> = {};
  for (const swap of [false, true])
    for (const mapId of ['desert-storm', 'highland-pass'] as MapId[])
      for (let seed = 1; seed <= 5; seed++) {
        (globalThis as { __flip?: boolean }).__flip = swap;
        const w = new World({ mapId, mission: 'annihilation', startingCredits: 5000, seed, unitCap: 150,
          slots: [{ kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: 'warlord' },
            { kind: 'ai', name: 'B', faction: 'western', team: 1, difficulty: 'hard', personality: 'warlord' }] });
        
        const ais = w.players.map((p) => new AICommander(w, p.id));
        for (let t = 0; t < 20 * 60 * 30 && w.winningTeam === null; t++) { for (const a of ais) a.update(); w.step(); }
        const winSpawn = w.winningTeam === null ? 'draw' : `spawn${w.players[w.winningTeam].spawnIndex}`;
        const k = `${swap ? 'flipped spiral' : 'normal spiral'} winner=${w.winningTeam === null ? 'draw' : 'P' + w.winningTeam}(${winSpawn})`;
        tally[k] = (tally[k] ?? 0) + 1;
      }
  console.log('\n' + Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('\n'));
}, 600000);
