import { describe, expect, it } from 'vitest';
import type { DayTime, MatchConfig, Weather } from '@shadow-front/shared-types';
import { DAY_NIGHT, WEATHER } from '@shadow-front/game-data';
import { World } from './world';

const config = (weather?: Weather, dayTime?: DayTime): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 5000,
  seed: 4,
  weather,
  dayTime,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

/** Distance a unit travels in `ticks` ticks along an open straight line. */
function travel(w: World, type: 'rifleman' | 'main-battle-tank' | 'attack-helicopter', ticks = 40): number {
  const hq = w.playerBuildings(0)[0];
  const u = w.createUnit(0, type, hq.x + 6, hq.y + 6);
  w.issue({ type: 'move', player: 0, units: [u.id], x: u.x + 15, y: u.y });
  const x0 = u.x;
  for (let i = 0; i < ticks; i++) w.step();
  return u.x - x0;
}

describe('weather and day / night (v0.11)', () => {
  it('defaults to clear daylight; bad values fall back', () => {
    const w = new World(config());
    expect(w.weather).toBe('clear');
    expect(w.dayTime).toBe('day');
    expect(w.visionMul()).toBe(1);
    const bad = new World({ ...config(), weather: 'hail' as Weather, dayTime: 'dusk' as DayTime });
    expect(bad.weather).toBe('clear');
    expect(bad.dayTime).toBe('day');
  });

  it('night and sandstorm shrink vision (with a floor); fog reveals less', () => {
    const night = new World(config('clear', 'night'));
    const tank = night.createUnit(0, 'main-battle-tank', 20, 20);
    expect(night.visionOf(tank)).toBeCloseTo(tank.vision * DAY_NIGHT.nightVision);
    const storm = new World(config('sandstorm', 'night'));
    expect(storm.visionMul()).toBeCloseTo(WEATHER.sandstorm.vision * DAY_NIGHT.nightVision);
    const drone = storm.createUnit(0, 'rifleman', 20, 20);
    expect(storm.visionOf(drone)).toBeGreaterThanOrEqual(DAY_NIGHT.minVision - 1e-9);
    // A unit 7 tiles from an HQ: seen by day, hidden at night in a sandstorm.
    for (const w of [new World(config()), storm]) {
      const hq = w.playerBuildings(0)[0];
      const scout = w.createUnit(1, 'rifleman', hq.x + 8, hq.y);
      w.updateFog();
      expect(w.isVisibleTo(0, scout)).toBe(w === storm ? false : true);
    }
  });

  it('the cycle goes day → dusk → night → dawn', () => {
    const w = new World(config('clear', 'cycle'));
    expect(w.daylight()).toBe(1);
    w.tick = DAY_NIGHT.dayTicks + DAY_NIGHT.duskTicks / 2;
    expect(w.daylight()).toBeCloseTo(0.5);
    w.tick = DAY_NIGHT.dayTicks + DAY_NIGHT.duskTicks + 10;
    expect(w.daylight()).toBe(0);
    expect(w.visionMul()).toBeCloseTo(DAY_NIGHT.nightVision);
    w.tick = DAY_NIGHT.dayTicks + DAY_NIGHT.duskTicks + DAY_NIGHT.nightTicks + DAY_NIGHT.dawnTicks + 5;
    expect(w.daylight()).toBe(1);
  });

  it('rain slows ground vehicles, snow slows infantry, aircraft are unaffected', () => {
    const tankClear = travel(new World(config()), 'main-battle-tank');
    const tankRain = travel(new World(config('rain')), 'main-battle-tank');
    expect(tankRain / tankClear).toBeCloseTo(WEATHER.rain.vehicleSpeed, 1);
    const infClear = travel(new World(config()), 'rifleman');
    const infSnow = travel(new World(config('snow')), 'rifleman');
    expect(infSnow / infClear).toBeCloseTo(WEATHER.snow.infantrySpeed, 1);
    const heliClear = travel(new World(config()), 'attack-helicopter');
    const heliStorm = travel(new World(config('sandstorm')), 'attack-helicopter');
    expect(heliStorm).toBeCloseTo(heliClear, 5);
  });
});
