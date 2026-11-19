import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  TITLES,
  activeChallenges,
  dayKey,
  titleName,
  weekKey,
  HISTORY_LIMIT,
  applyMatch,
  levelInfo,
  newProfile,
  sanitizeProfile,
  xpForMatch,
  type MatchSummary,
} from './progression';

const summary = (patch: Partial<MatchSummary> = {}): MatchSummary => ({
  victory: true,
  mission: 'annihilation',
  mapId: 'desert-storm',
  mapName: 'Desert Storm',
  faction: 'western',
  durationSec: 900,
  kills: 20,
  unitsBuilt: 30,
  unitsLost: 10,
  creditsEarned: 12000,
  enemyDifficulty: 'normal',
  waves: null,
  campaignMission: null,
  campaignComplete: false,
  heroic: false,
  ...patch,
});

describe('progression', () => {
  it('levels need 500, 750, 1000… XP', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, needed: 500 });
    expect(levelInfo(499).level).toBe(1);
    expect(levelInfo(500)).toEqual({ level: 2, into: 0, needed: 750 });
    expect(levelInfo(1250).level).toBe(3);
  });

  it('XP rewards victory, combat, time and harder enemies', () => {
    expect(xpForMatch(summary())).toBeGreaterThan(xpForMatch(summary({ victory: false })));
    expect(xpForMatch(summary({ enemyDifficulty: 'insane' }))).toBeGreaterThan(xpForMatch(summary()));
    expect(xpForMatch(summary({ victory: false, kills: 0, unitsBuilt: 0, durationSec: 0 }))).toBe(125);
  });

  it('applyMatch updates stats, history and unlocks achievements once', () => {
    const p0 = newProfile('Tester');
    const r1 = applyMatch(p0, summary(), 1000);
    expect(p0.stats.matches).toBe(0); // input untouched
    expect(r1.profile.stats).toMatchObject({ matches: 1, wins: 1, kills: 20, playTimeSec: 900 });
    expect(r1.profile.stats.factionWins.western).toBe(1);
    expect(r1.profile.history[0]).toMatchObject({ victory: true, xp: r1.xpGained, at: 1000 });
    expect(r1.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['first-blood', 'first-victory']));
    const r2 = applyMatch(r1.profile, summary(), 2000);
    expect(r2.unlocked.map((a) => a.id)).not.toContain('first-victory');
    expect(r2.profile.achievements['first-victory']).toBe(1000);
  });

  it('special achievements', () => {
    const ids = (s: Partial<MatchSummary>) =>
      applyMatch(newProfile(), summary(s), 1).unlocked.map((a) => a.id);
    expect(ids({ enemyDifficulty: 'insane' })).toEqual(
      expect.arrayContaining(['hard-target', 'insane-victory']),
    );
    expect(ids({ durationSec: 400 })).toContain('blitz');
    expect(ids({ mission: 'survival', waves: { reached: 10, total: 10 }, enemyDifficulty: null })).toContain(
      'last-stand',
    );
    expect(ids({ mission: 'domination' })).toContain('dominator');
    expect(ids({ mapId: 'random' })).toContain('explorer');
    expect(ids({ heroic: true, victory: false })).toContain('heroic');
    expect(ids({ campaignComplete: true })).toContain('campaign');
    let p = newProfile();
    for (const f of ['western', 'eastern', 'pacific', 'desert'] as const)
      p = applyMatch(p, summary({ faction: f }), 1).profile;
    expect(applyMatch(p, summary({ faction: 'iron' }), 2).unlocked.map((a) => a.id)).toContain(
      'all-factions',
    );
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('keeps a bounded history and sanitizes stored data', () => {
    let p = newProfile();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) p = applyMatch(p, summary(), i).profile;
    expect(p.history).toHaveLength(HISTORY_LIMIT);
    expect(p.history[0].at).toBe(HISTORY_LIMIT + 4);
    expect(sanitizeProfile(null).stats.matches).toBe(0);
    expect(sanitizeProfile({ version: 2 }).xp).toBe(0);
    const back = sanitizeProfile(JSON.parse(JSON.stringify(p)));
    expect(back.stats.matches).toBe(HISTORY_LIMIT + 5);
    expect(sanitizeProfile({ ...p, nickname: '   ' }).nickname).toBe('Commander');
  });
});

describe('challenges and titles', () => {
  it('ISO week keys', () => {
    expect(weekKey(Date.UTC(2026, 10, 19))).toBe('2026-W47'); // Thu 19 Nov 2026
    expect(weekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01'); // Thu
    expect(weekKey(Date.UTC(2021, 0, 1))).toBe('2020-W53'); // Fri → last week of 2020
    expect(weekKey(Date.UTC(2024, 11, 30))).toBe('2025-W01'); // Mon
    expect(dayKey(Date.UTC(2026, 10, 19, 23, 59))).toBe('2026-11-19');
  });

  it('three daily + three weekly challenges, stable within a period', () => {
    const d = activeChallenges('daily', '2026-11-19');
    expect(d).toHaveLength(3);
    expect(new Set(d.map((c) => c.id)).size).toBe(3);
    expect(activeChallenges('daily', '2026-11-19')).toEqual(d);
    expect(activeChallenges('weekly', '2026-W47').every((c) => c.period === 'weekly')).toBe(true);
    const days = new Set(
      Array.from({ length: 10 }, (_, i) =>
        activeChallenges('daily', `2026-11-${10 + i}`)
          .map((c) => c.id)
          .join(),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });

  it('completing a challenge pays its reward once; progress resets next period', () => {
    const now = Date.UTC(2026, 10, 19, 12);
    const daily = activeChallenges('daily', dayKey(now));
    const target = daily[0];
    // A big match that satisfies every daily challenge.
    const big = summary({
      kills: 500,
      unitsBuilt: 500,
      durationSec: 3600,
      mission: 'domination',
      waves: null,
    });
    const r1 = applyMatch(newProfile(), big, now);
    expect(r1.completed.map((c) => c.id)).toContain(target.id);
    expect(r1.xpGained).toBe(xpForMatch(big) + r1.completed.reduce((s, c) => s + c.reward, 0));
    const r2 = applyMatch(r1.profile, big, now + 1000);
    expect(r2.completed.map((c) => c.id)).not.toContain(target.id);
    const tomorrow = now + 86400000;
    const r3 = applyMatch(
      r2.profile,
      summary({ victory: false, kills: 0, unitsBuilt: 0, durationSec: 0 }),
      tomorrow,
    );
    expect(r3.profile.challenges.day).toBe(dayKey(tomorrow));
    expect(r3.profile.challenges.done.filter((id) => id.startsWith('d-'))).toHaveLength(0);
  });

  it('titles unlock with level / achievements and fall back to Recruit', () => {
    const p = newProfile();
    expect(titleName(p)).toBe('Recruit');
    expect(titleName({ ...p, title: 'captain' })).toBe('Recruit'); // locked
    const lvl10 = { ...p, xp: 20000, title: 'captain' };
    expect(TITLES.find((t) => t.id === 'captain')!.unlocked(lvl10)).toBe(true);
    expect(titleName(lvl10)).toBe('Captain');
    const r = applyMatch({ ...p, xp: 490 }, summary({ heroic: true }), Date.UTC(2026, 10, 19));
    expect(r.newTitles.map((t) => t.id)).toContain('hero');
    expect(sanitizeProfile({ ...p, title: 5 }).title).toBe('recruit');
  });
});
