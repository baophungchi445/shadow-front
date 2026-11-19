import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchConfig } from '@shadow-front/shared-types';
import { SURVIVAL } from '@shadow-front/game-data';
import { World } from './world';

const survival = (waves = 3, slots = 1): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'survival',
  startingCredits: 5000,
  seed: 4,
  survival: { difficulty: 'normal', waves },
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    ...(slots > 1
      ? [
          {
            kind: 'ai' as const,
            name: 'Ally',
            faction: 'eastern' as const,
            team: 0,
            difficulty: 'normal' as const,
          },
        ]
      : []),
  ],
});

function runUntil(w: World, tick: number, events: GameEvent[] = []): GameEvent[] {
  while (w.tick < tick && w.winningTeam === null) {
    w.step();
    events.push(...w.drainEvents());
  }
  return events;
}

describe('survival mode', () => {
  it('adds a base-less wave attacker and uses free spawns as entry points', () => {
    const w = new World(survival(3, 2));
    const s = w.survival!;
    expect(s.raider).toBe(2);
    const raider = w.players[s.raider];
    expect(raider.raider).toBe(true);
    expect(w.playerBuildings(raider.id)).toHaveLength(0);
    expect(w.playerUnits(raider.id)).toHaveLength(0);
    expect(s.entries).toHaveLength(2); // 4 spawns − 2 defenders
    expect(s.entries).toContainEqual(s.nextEntry);
  });

  it('rejects mixed teams and too many commanders', () => {
    const bad = survival();
    bad.slots.push({ kind: 'ai', name: 'X', faction: 'eastern', team: 1, difficulty: 'easy' });
    expect(() => new World(bad)).toThrow(/same team/);
    const full = survival();
    for (let i = 0; i < 3; i++) full.slots.push({ kind: 'ai', name: `A${i}`, faction: 'eastern', team: 0 });
    expect(() => new World(full)).toThrow(/at most 3/);
  });

  it('announces each wave in advance, spawns it at the entry and attacks the base', () => {
    const w = new World(survival(3));
    const entry = { ...w.survival!.nextEntry };
    const events = runUntil(w, SURVIVAL.firstWaveTick + 1);
    const warn = events.find((e) => e.type === 'waveIncoming');
    expect(warn).toMatchObject({ wave: 1, x: entry.x, y: entry.y, inTicks: SURVIVAL.warningTicks });
    const spawned = events.find((e) => e.type === 'waveSpawned');
    expect(spawned).toMatchObject({ wave: 1 });
    const units = w.playerUnits(w.survival!.raider);
    expect(units.length).toBeGreaterThan(2);
    for (const u of units) {
      expect(Math.hypot(u.x - entry.x, u.y - entry.y)).toBeLessThan(6);
      expect(u.order).toMatchObject({ type: 'move', attackMove: true });
    }
    // The next wave is scheduled one interval later.
    expect(w.survival!.nextWaveTick).toBe(SURVIVAL.firstWaveTick + SURVIVAL.intervalTicks);
  });

  it('defenders win once every wave has entered and been destroyed', () => {
    const w = new World(survival(2));
    const s = w.survival!;
    const events: GameEvent[] = [];
    let waveSizes: number[] = [];
    while (w.winningTeam === null && w.tick < SURVIVAL.firstWaveTick + SURVIVAL.intervalTicks * 3) {
      w.step();
      const ev = w.drainEvents();
      events.push(...ev);
      for (const e of ev) if (e.type === 'waveSpawned') waveSizes = [...waveSizes, e.count];
      // Wipe each wave right after it spawns.
      for (const u of w.playerUnits(s.raider)) w.destroy(u);
    }
    expect(waveSizes).toHaveLength(2);
    expect(w.winningTeam).toBe(0);
    expect(w.players[0].defeated).toBe(false);
    expect(w.players[s.raider].defeated).toBe(true);
  });

  it('the attacker wins when every defender is eliminated', () => {
    const w = new World(survival(5));
    for (const e of [...w.playerBuildings(0), ...w.playerUnits(0)]) w.destroy(e);
    runUntil(w, 40);
    expect(w.winningTeam).toBe(SURVIVAL.raiderTeam);
  });
});
