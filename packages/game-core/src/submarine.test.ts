import { describe, expect, it } from 'vitest';
import type { MatchConfig, UnitTypeId } from '@shadow-front/shared-types';
import { BALANCE, UNITS } from '@shadow-front/game-data';
import { World } from './world';
import { canTarget } from './combat';

const config: MatchConfig = {
  mapId: 'coastal-front',
  mission: 'annihilation',
  startingCredits: 10000,
  seed: 3,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'human', name: 'P2', faction: 'western', team: 1 },
  ],
};

/** Two ships `d` tiles apart in the open sea (west–east). */
function duel(a: UnitTypeId, b: UnitTypeId, d: number) {
  const w = new World(config);
  const ua = w.createUnit(0, a, 32 - d / 2, 32.5);
  const ub = w.createUnit(1, b, 32 + d / 2, 32.5);
  expect(w.grid.tile(Math.floor(ua.x), 32)).toBe('water');
  expect(w.grid.tile(Math.floor(ub.x), 32)).toBe('water');
  return { w, ua, ub };
}

function fight(w: World, ticks: number) {
  for (let i = 0; i < ticks && w.winningTeam === null; i++) w.step();
}

describe('submarines (v0.15)', () => {
  it('only sub hunters can target a submarine; torpedoes only hit ships', () => {
    const { w, ua: sub } = duel('submarine', 'destroyer', 6);
    const tank = w.createUnit(1, 'main-battle-tank', 6, 6);
    const hq = w.playerBuildings(1)[0];
    const torpedo = UNITS.submarine.weapon!;
    expect(canTarget(UNITS.destroyer.weapon!, sub)).toBe(false);
    expect(canTarget(UNITS['main-battle-tank'].weapon!, sub)).toBe(false);
    expect(canTarget(UNITS['patrol-boat'].weapon!, sub)).toBe(true);
    expect(canTarget(torpedo, tank)).toBe(false);
    expect(canTarget(torpedo, hq)).toBe(false);
    const destroyer = w.units().find((u) => u.type === 'destroyer')!;
    expect(canTarget(torpedo, destroyer)).toBe(true);
  });

  it('a submarine is hidden except to nearby sonar, at close range or right after firing', () => {
    const w = new World(config);
    const sub = w.createUnit(0, 'submarine', 30.5, 32.5);
    w.createUnit(1, 'destroyer', 37.5, 32.5);
    w.step();
    w.updateFog();
    // 7 tiles from a destroyer (no sonar, out of torpedo range): hidden though inside the destroyer's vision.
    expect(w.fog.isVisible(1, sub.x, sub.y)).toBe(true);
    expect(w.isVisibleTo(1, sub)).toBe(false);
    // A patrol boat 6.5 tiles away (beyond torpedo range) hears it on sonar.
    const boat = w.createUnit(1, 'patrol-boat', 30.5, 39);
    expect(w.grid.tile(30, 39)).toBe('water');
    w.step();
    w.updateFog();
    expect(Math.hypot(boat.x - sub.x, boat.y - sub.y)).toBeLessThanOrEqual(BALANCE.sonarRange);
    expect(w.isVisibleTo(1, sub)).toBe(true);
    w.destroy(boat);
    w.step();
    w.updateFog();
    expect(w.isVisibleTo(1, sub)).toBe(false);
    // Firing a torpedo gives it away for a moment.
    sub.lastFiredTick = w.tick;
    expect(w.isVisibleTo(1, sub)).toBe(true);
    w.tick += BALANCE.subRevealTicks + 1;
    expect(w.isVisibleTo(1, sub)).toBe(false);
  });

  it('naval counters: submarine sinks a destroyer, patrol boat sinks a submarine, destroyer sinks a patrol boat', () => {
    const results: Record<string, string> = {};
    for (const [a, b, d] of [
      ['submarine', 'destroyer', 5],
      ['patrol-boat', 'submarine', 5],
      ['destroyer', 'patrol-boat', 10],
    ] as [UnitTypeId, UnitTypeId, number][]) {
      const { w, ua, ub } = duel(a, b, d);
      fight(w, 20 * 120);
      results[`${a} vs ${b}`] = ua.dead ? (ub.dead ? 'both' : b) : ub.dead ? a : 'none';
    }
    expect(results).toEqual({
      'submarine vs destroyer': 'submarine',
      'patrol-boat vs submarine': 'patrol-boat',
      'destroyer vs patrol-boat': 'destroyer',
    });
  });
});
