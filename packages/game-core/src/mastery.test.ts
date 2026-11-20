import { describe, expect, it } from 'vitest';
import { World } from './world';
import {
  MASTERY_MAX,
  MASTERY_THRESHOLDS,
  TITLES,
  applyMatch,
  masteryInfo,
  newProfile,
  sanitizeProfile,
  titleName,
  UNIT_MASTERY_MAX,
  AVATAR_COLORS,
  AVATAR_ICONS,
  UNIT_MASTERY_THRESHOLDS,
  unitMasteryInfo,
  xpForMatch,
  type MatchSummary,
} from './progression';

const summary = (patch: Partial<MatchSummary> = {}): MatchSummary => ({
  victory: true,
  mission: 'annihilation',
  mapId: 'desert-storm',
  mapName: 'Desert Storm',
  faction: 'western',
  durationSec: 600,
  kills: 20,
  unitsBuilt: 20,
  unitsLost: 5,
  creditsEarned: 10000,
  enemyDifficulty: 'normal',
  waves: null,
  campaignMission: null,
  campaignComplete: false,
  heroic: false,
  ...patch,
});

describe('faction mastery', () => {
  it('levels follow the thresholds and cap at the maximum', () => {
    expect(masteryInfo(0)).toEqual({ level: 0, into: 0, needed: MASTERY_THRESHOLDS[0] });
    expect(masteryInfo(MASTERY_THRESHOLDS[0]).level).toBe(1);
    expect(masteryInfo(MASTERY_THRESHOLDS[2] - 1).level).toBe(2);
    expect(masteryInfo(10 ** 7).level).toBe(MASTERY_MAX);
  });

  it('only the faction played gains mastery, by the match XP (not challenge rewards)', () => {
    const r = applyMatch(newProfile(), summary({ faction: 'eastern' }), Date.UTC(2026, 10, 20));
    expect(r.profile.mastery.eastern).toBe(xpForMatch(summary({ faction: 'eastern' })));
    expect(r.profile.mastery.western).toBeUndefined();
    expect(r.mastery).toMatchObject({ faction: 'eastern', levelBefore: 0 });
    expect(r.mastery.levelAfter).toBe(masteryInfo(r.profile.mastery.eastern!).level);
    // Challenge rewards (d-win etc.) are in xpGained but not in mastery.
    expect(r.xpGained).toBeGreaterThanOrEqual(r.mastery.xp);
  });

  it('unlocks the Specialist and Grandmaster titles', () => {
    let p = newProfile();
    p = { ...p, mastery: { pacific: MASTERY_THRESHOLDS[4] - 1 } };
    expect(TITLES.find((t) => t.id === 'specialist')!.unlocked(p)).toBe(false);
    const r = applyMatch(p, summary({ faction: 'pacific' }), 1);
    expect(r.newTitles.map((t) => t.id)).toContain('specialist');
    expect(titleName({ ...r.profile, title: 'specialist' })).toBe('Specialist');
    expect(TITLES.find((t) => t.id === 'grandmaster')!.unlocked({ ...p, mastery: { iron: 10 ** 6 } })).toBe(
      true,
    );
  });

  it('old profiles get mastery rebuilt from history; bad data is dropped', () => {
    const p = applyMatch(
      applyMatch(newProfile(), summary(), 1).profile,
      summary({ faction: 'desert' }),
      2,
    ).profile;
    const old = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    delete old.mastery;
    const s = sanitizeProfile(old);
    expect(s.mastery.western).toBe(p.history[1].xp);
    expect(s.mastery.desert).toBe(p.history[0].xp);
    const bad = sanitizeProfile({
      ...old,
      mastery: { western: -5, nowhere: 100, eastern: 'x', pacific: 250 },
    });
    expect(bad.mastery).toEqual({ pacific: 250 });
  });
});

describe('unit mastery (v0.11)', () => {
  it('levels from 1 point per unit built and 2 per kill, capped', () => {
    expect(unitMasteryInfo(undefined)).toEqual({
      level: 0,
      points: 0,
      into: 0,
      needed: UNIT_MASTERY_THRESHOLDS[0],
    });
    expect(unitMasteryInfo({ built: 4, kills: 3 }).level).toBe(1);
    expect(unitMasteryInfo({ built: 0, kills: 10 ** 5 }).level).toBe(UNIT_MASTERY_MAX);
  });

  it('accumulates per unit type across matches and reports level-ups', () => {
    let p = newProfile();
    const r1 = applyMatch(
      p,
      summary({ units: { rifleman: { built: 6, kills: 3 }, 'main-battle-tank': { built: 2, kills: 0 } } }),
      1,
    );
    expect(r1.unitLevelUps).toEqual([{ type: 'rifleman', levelBefore: 0, levelAfter: 1 }]);
    p = r1.profile;
    const r2 = applyMatch(p, summary({ units: { rifleman: { built: 10, kills: 2 } } }), 2);
    expect(r2.profile.unitMastery.rifleman).toEqual({ built: 16, kills: 5 });
    expect(r2.profile.unitMastery['main-battle-tank']).toEqual({ built: 2, kills: 0 });
    expect(r2.unitLevelUps).toEqual([]); // 26 points: still level 1
    expect(TITLES.find((t) => t.id === 'weapons-expert')!.unlocked(r2.profile)).toBe(false);
    const r3 = applyMatch(r2.profile, summary({ units: { rifleman: { built: 0, kills: 200 } } }), 3);
    expect(TITLES.find((t) => t.id === 'weapons-expert')!.unlocked(r3.profile)).toBe(true);
    expect(r3.newTitles.map((t) => t.id)).toContain('weapons-expert');
  });

  it('old profiles get an empty map; damaged entries are dropped', () => {
    const old = { ...newProfile() } as Record<string, unknown>;
    delete old.unitMastery;
    expect(sanitizeProfile(old).unitMastery).toEqual({});
    const bad = {
      ...newProfile(),
      unitMastery: {
        rifleman: { built: 3, kills: 1 },
        nope: { built: 1, kills: 1 },
        sniper: { built: -1, kills: 0 },
      },
    };
    expect(sanitizeProfile(bad).unitMastery).toEqual({ rifleman: { built: 3, kills: 1 } });
  });

  it('the simulation counts units built and kills per unit type', () => {
    const w = new World({
      mapId: 'desert-storm',
      mission: 'annihilation',
      startingCredits: 5000,
      seed: 2,
      slots: [
        { kind: 'human', name: 'P1', faction: 'western', team: 0 },
        { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
      ],
    });
    const hq = w.playerBuildings(0)[0];
    const sniper = w.createUnit(0, 'sniper', hq.x + 4, hq.y + 4);
    const victim = w.createUnit(1, 'rifleman', hq.x + 6, hq.y + 4);
    victim.hp = 1;
    w.damage(victim, 5, 0, sniper.id);
    expect(w.players[0].stats.byUnit.sniper).toEqual({ built: 0, kills: 1 });
    const barracks =
      w.playerBuildings(0).find((b) => b.def.produces && b.type !== 'headquarters') ??
      w.createBuilding(0, 'barracks', hq.tx, hq.ty + 4, true);
    w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
    expect(w.issue({ type: 'produce', player: 0, producer: barracks.id, unit: 'rifleman' }).ok).toBe(true);
    for (let i = 0; i < 400; i++) w.step();
    expect(w.players[0].stats.byUnit.rifleman?.built).toBe(1);
  });
});

describe('avatar (v0.12)', () => {
  it('defaults to a star; valid choices are kept, damaged ones reset', () => {
    expect(newProfile().avatar).toEqual({ icon: 'star', color: AVATAR_COLORS[0] });
    const ok = { ...newProfile(), avatar: { icon: 'tank', color: AVATAR_COLORS[3] } };
    expect(sanitizeProfile(ok).avatar).toEqual({ icon: 'tank', color: AVATAR_COLORS[3] });
    for (const avatar of [{ icon: 'dragon', color: AVATAR_COLORS[1] }, { icon: 'tank', color: 123 }, 'x', null])
      expect(sanitizeProfile({ ...newProfile(), avatar }).avatar).toEqual(newProfile().avatar);
    const old = { ...newProfile() } as Record<string, unknown>;
    delete old.avatar;
    expect(sanitizeProfile(old).avatar.icon).toBe('star');
    expect(AVATAR_ICONS).toHaveLength(8);
  });
});
