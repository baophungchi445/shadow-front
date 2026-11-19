import { describe, expect, it } from 'vitest';
import type { FactionId, MatchConfig } from '@shadow-front/shared-types';
import { BUILDINGS, FACTION_IDS, RESEARCH, RESEARCH_EFFECTS, RESEARCH_IDS } from '@shadow-front/game-data';
import { World } from './world';

const config = (faction: FactionId = 'western'): MatchConfig => ({
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 20000,
  seed: 1,
  slots: [
    { kind: 'human', name: 'P1', faction, team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
});

const run = (w: World, n: number) => {
  for (let i = 0; i < n; i++) w.step();
};

describe('faction technologies', () => {
  it('each faction has exactly one, and others cannot research it', () => {
    for (const f of FACTION_IDS)
      expect(RESEARCH_IDS.filter((r) => RESEARCH[r].faction === f)).toHaveLength(1);
    const w = new World(config('western'));
    const hq = w.playerBuildings(0)[0];
    const lab = w.createBuilding(0, 'research-center', hq.tx, hq.ty + 4, true);
    expect(w.issue({ type: 'research', player: 0, building: lab.id, research: 'reactive-armor' })).toEqual({
      ok: false,
      reason: 'Reactive Armor is not available to your faction',
    });
    expect(w.issue({ type: 'research', player: 0, building: lab.id, research: 'combat-medkits' }).ok).toBe(
      true,
    );
  });

  it('combat medkits / turbo engines / fortified structures upgrade existing and new entities', () => {
    const w = new World(config('western'));
    const rifle = w.playerUnits(0).find((u) => u.type === 'rifleman')!;
    const hp0 = rifle.maxHp;
    w.completeResearch(0, 'combat-medkits');
    expect(rifle.maxHp).toBe(Math.round(hp0 * RESEARCH_EFFECTS.infantryHp));
    expect(w.createUnit(0, 'rifleman', 12, 12).maxHp).toBe(rifle.maxHp);

    const tank = w.createUnit(0, 'main-battle-tank', 12, 13);
    const s0 = tank.speed;
    w.completeResearch(0, 'turbo-engines');
    expect(tank.speed).toBeCloseTo(s0 * RESEARCH_EFFECTS.vehicleSpeed);

    const hq = w.playerBuildings(0)[0];
    const b0 = hq.maxHp;
    w.completeResearch(0, 'fortified-structures');
    expect(hq.maxHp).toBe(Math.round(b0 * RESEARCH_EFFECTS.buildingHp));
  });

  it('reactive armor reduces damage to heavy units; nano repair heals vehicles', () => {
    const w = new World(config('eastern'));
    const a = w.createUnit(0, 'heavy-tank', 12, 12);
    const b = w.createUnit(0, 'heavy-tank', 12, 13);
    w.completeResearch(0, 'reactive-armor');
    w.damage(a, 100, 1);
    expect(a.maxHp - a.hp).toBeCloseTo(100 * RESEARCH_EFFECTS.reactiveArmor);
    expect(b.hp).toBe(b.maxHp);

    const w2 = new World(config('pacific'));
    const t = w2.createUnit(0, 'main-battle-tank', 12, 12);
    t.hp = t.maxHp / 2;
    w2.completeResearch(0, 'nano-repair');
    run(w2, 20 * 4);
    expect(t.hp).toBeGreaterThan(t.maxHp / 2);
  });
});

describe('building upgrades', () => {
  it('costs credits, takes time and gives level 2 stats', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const turret = w.createBuilding(0, 'defense-turret', hq.tx + 4, hq.ty, true);
    const up = BUILDINGS['defense-turret'].upgrade!;
    const credits = w.players[0].credits;
    const hp0 = turret.maxHp;
    const dmg0 = turret.damageMul;
    expect(w.issue({ type: 'upgrade', player: 0, building: turret.id }).ok).toBe(true);
    expect(w.players[0].credits).toBe(credits - up.cost);
    expect(w.issue({ type: 'upgrade', player: 0, building: turret.id })).toEqual({
      ok: false,
      reason: 'Upgrade in progress',
    });
    run(w, up.time + 5);
    expect(turret.level).toBe(2);
    expect(turret.maxHp).toBe(Math.round(hp0 * up.hp));
    expect(turret.damageMul).toBeCloseTo(dmg0 * (up.damage ?? 1));
    expect(w.issue({ type: 'upgrade', player: 0, building: turret.id })).toEqual({
      ok: false,
      reason: 'Already upgraded',
    });
    expect(w.drainEvents().some((e) => e.type === 'upgraded')).toBe(true);
  });

  it('upgraded power plants produce +50% power; non-upgradable buildings refuse', () => {
    const w = new World(config());
    const hq = w.playerBuildings(0)[0];
    const pp = w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
    run(w, 1);
    const before = w.players[0].powerProduced;
    pp.level = 2;
    run(w, 1);
    expect(w.players[0].powerProduced - before).toBe(BUILDINGS['power-plant'].power * 0.5);
    expect(w.issue({ type: 'upgrade', player: 0, building: hq.id })).toEqual({
      ok: false,
      reason: 'This building cannot be upgraded',
    });
  });
});
