import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchConfig } from '@shadow-front/shared-types';
import { BALANCE } from '@shadow-front/game-data';
import { World } from './world';

const config = (): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'ctf',
  startingCredits: 5000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

function step(w: World, n = 1): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    w.step();
    out.push(...w.drainEvents());
  }
  return out;
}

describe('capture the flag', () => {
  it('places one flag per team on walkable ground near the HQ', () => {
    const w = new World(config());
    expect(w.flags.map((f) => f.team)).toEqual([0, 1]);
    for (const f of w.flags) {
      expect(w.grid.walkable(Math.floor(f.x), Math.floor(f.y))).toBe(true);
      const hq = w.buildings().find((b) => b.team === f.team && b.type === 'headquarters')!;
      expect(Math.hypot(hq.x - f.x, hq.y - f.y)).toBeLessThan(7);
    }
    expect(new World({ ...config(), mission: 'annihilation' }).flags).toHaveLength(0);
  });

  it('take → carry → capture scores and returns the flag; three captures win', () => {
    const w = new World(config());
    const [mine, theirs] = w.flags;
    for (let n = 1; n <= BALANCE.ctfCaptures; n++) {
      const raider = w.createUnit(0, 'recon-vehicle', theirs.x, theirs.y);
      const ev = step(w);
      expect(ev).toContainEqual(expect.objectContaining({ type: 'flagTaken', team: 1, by: 0 }));
      expect(theirs.carrier).toBe(raider.id);
      // Teleport the carrier home (pathing is tested elsewhere).
      raider.x = raider.prevX = mine.homeX;
      raider.y = raider.prevY = mine.homeY;
      const ev2 = step(w);
      expect(ev2).toContainEqual(expect.objectContaining({ type: 'flagCaptured', team: 0, flagTeam: 1 }));
      expect(theirs.atHome).toBe(true);
      expect(w.captures.get(0)).toBe(n);
      w.destroy(raider);
    }
    step(w, 25);
    expect(w.winningTeam).toBe(0);
  });

  it('a killed carrier drops the flag; the owner touching it returns it home', () => {
    const w = new World(config());
    const theirs = w.flags[1];
    const raider = w.createUnit(0, 'rifleman', theirs.x, theirs.y);
    step(w);
    raider.x = raider.prevX = theirs.homeX - 6;
    raider.y = raider.prevY = theirs.homeY - 6;
    step(w);
    w.destroy(raider);
    const ev = step(w);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'flagDropped', team: 1 }));
    expect(theirs.atHome).toBe(false);
    w.createUnit(1, 'rifleman', theirs.x, theirs.y);
    expect(step(w)).toContainEqual({ type: 'flagReturned', team: 1 });
    expect(theirs.atHome).toBe(true);
  });

  it('no capture while your own flag is away; aircraft cannot take flags', () => {
    const w = new World(config());
    const [mine, theirs] = w.flags;
    const heli = w.createUnit(0, 'attack-helicopter', theirs.x, theirs.y);
    step(w);
    expect(theirs.carrier).toBeNull();
    w.destroy(heli);
    const raider = w.createUnit(0, 'recon-vehicle', theirs.x, theirs.y);
    step(w);
    const thief = w.createUnit(1, 'recon-vehicle', mine.x, mine.y);
    step(w);
    expect(mine.carrier).toBe(thief.id);
    raider.x = raider.prevX = mine.homeX;
    raider.y = raider.prevY = mine.homeY;
    step(w, 3);
    expect(w.captures.get(0) ?? 0).toBe(0);
  });
});
