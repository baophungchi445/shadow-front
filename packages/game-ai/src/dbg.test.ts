import { it } from 'vitest';
import { World } from '@shadow-front/game-core';
import { AICommander, findShoreSite } from './index';
it('dbg', () => {
  const w = new World({ mapId: 'coastal-front', mission: 'annihilation', startingCredits: 5000, seed: 1, unitCap: 150,
    slots: [{ kind: 'ai', name: 'A', faction: 'western', team: 0, difficulty: 'hard', personality: 'warlord' },
      { kind: 'ai', name: 'B', faction: 'eastern', team: 1, difficulty: 'hard', personality: 'warlord' }] });
  const ais = w.players.map((p) => new AICommander(w, p.id)) as any[];
  for (let t = 0; t < 20 * 60 * 12; t++) { for (const a of ais) a.update(); w.step();
    if (t % 1200 === 0) console.log(t, ais.map((a, i) => { const y = w.playerBuildings(i).find((b) => b.type === 'naval-yard'); return `P${i} yard=${y ? (y.complete ? 'ok' : 'building') + ' q=' + y.queue.join('+') + ' qp=' + y.queueProgress.toFixed(0) : '-'} ships=${w.playerUnits(i).filter((u) => u.naval).map((u) => u.type).join('+')} cr=${Math.round(w.players[i].credits)} sup=${w.supplyUsed(i)} pf=${w.powerFactor(i)} dec=${a.lastDecision}`; }).join(' || ')); }
});
