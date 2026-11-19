import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  FACTIONS,
  MAP_IDS,
  SURVIVAL,
  TILE_BLOCKED,
  UNITS,
  getMap,
  mulberry32,
  waveComposition,
} from './index';

describe('game-data', () => {
  it('has five factions, 6+ buildings, at least the 8-unit MVP shared roster plus one unit per faction', () => {
    expect(Object.keys(FACTIONS)).toHaveLength(5);
    expect(Object.keys(BUILDINGS).length).toBeGreaterThanOrEqual(6);
    const all = Object.values(UNITS);
    const shared = all.filter((u) => !u.faction).length;
    expect(shared).toBeGreaterThanOrEqual(8);
    expect(all.length - shared).toBe(5);
  });

  it('every unit producer is a producing building', () => {
    for (const u of Object.values(UNITS)) expect(BUILDINGS[u.producedBy].produces).toBe(true);
  });

  for (const id of MAP_IDS) {
    it(`${id}: all spawns and strategic points are reachable; ore near every base`, () => {
      const m = getMap(id);
      expect(m.tiles).toHaveLength(m.width * m.height);
      const start = m.spawns[0];
      const seen = new Uint8Array(m.width * m.height);
      const q: number[] = [start.ty * m.width + start.tx];
      seen[q[0]] = 1;
      while (q.length) {
        const cur = q.pop()!;
        const x = cur % m.width;
        const y = (cur / m.width) | 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
          const ni = ny * m.width + nx;
          if (seen[ni] || TILE_BLOCKED[m.tiles[ni]]) continue;
          seen[ni] = 1;
          q.push(ni);
        }
      }
      for (const sp of m.strategicPoints) expect(seen[sp.y * m.width + sp.x]).toBe(1);
      for (const s of m.spawns) {
        expect(seen[s.ty * m.width + s.tx]).toBe(1);
        let ore = 0;
        for (let j = -12; j <= 12; j++)
          for (let i = -12; i <= 12; i++) if (m.tiles[(s.ty + j) * m.width + s.tx + i] === 'ore') ore++;
        expect(ore).toBeGreaterThan(4);
      }
    });
  }

  it('survival waves are deterministic and grow with wave number and difficulty', () => {
    const value = (ts: string[]) => ts.reduce((s, t) => s + UNITS[t as keyof typeof UNITS].cost, 0);
    expect(waveComposition(4, 'normal', mulberry32(9))).toEqual(waveComposition(4, 'normal', mulberry32(9)));
    const w1 = value(waveComposition(1, 'normal', mulberry32(1)));
    const w8 = value(waveComposition(8, 'normal', mulberry32(1)));
    expect(w8).toBeGreaterThan(w1 * 3);
    const easy = value(waveComposition(6, 'easy', mulberry32(2)));
    const insane = value(waveComposition(6, 'insane', mulberry32(2)));
    expect(insane).toBeGreaterThan(easy * 2);
    // Heavy units only appear in later waves.
    expect(waveComposition(2, 'insane', mulberry32(3))).not.toContain('heavy-tank');
    for (let w = 1; w <= 15; w++)
      expect(waveComposition(w, 'insane', mulberry32(w)).length).toBeLessThanOrEqual(
        SURVIVAL.maxUnitsPerWave,
      );
  });
});
