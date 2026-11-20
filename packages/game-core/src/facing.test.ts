import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { World } from './world';
import { frontOf } from './front';

const config: MatchConfig = {
  mapId: 'desert-storm',
  mission: 'annihilation',
  startingCredits: 20000,
  seed: 8,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'ai', name: 'AI', faction: 'eastern', team: 1, difficulty: 'normal', personality: 'warlord' },
  ],
};

describe('building facing (v0.12)', () => {
  it('front edge point per facing', () => {
    const b = { tx: 10, ty: 20, w: 2, h: 2 };
    expect(frontOf({ ...b, facing: 0 }, 1)).toEqual({ x: 11, y: 23 });
    expect(frontOf({ ...b, facing: 1 }, 1)).toEqual({ x: 13, y: 21 });
    expect(frontOf({ ...b, facing: 2 }, 1)).toEqual({ x: 11, y: 19 });
    expect(frontOf({ ...b, facing: 3 }, 1)).toEqual({ x: 9, y: 21 });
  });

  it('the build command stores the facing (invalid → 0) and units leave through the front', () => {
    for (const facing of [0, 1, 2, 3]) {
      const w = new World(config);
      const hq = w.playerBuildings(0)[0];
      w.createBuilding(0, 'power-plant', hq.tx + 4, hq.ty, true);
      const tx = hq.tx;
      const ty = hq.ty + 5;
      expect(w.issue({ type: 'build', player: 0, building: 'barracks', tx, ty, facing }).ok).toBe(true);
      const b = w.playerBuildings(0).find((x) => x.type === 'barracks')!;
      expect(b.facing).toBe(facing);
      b.complete = true;
      b.progress = 1;
      b.hp = b.maxHp;
      const before = new Set(w.playerUnits(0).map((u) => u.id));
      expect(w.issue({ type: 'produce', player: 0, producer: b.id, unit: 'rifleman' }).ok).toBe(true);
      let u = null;
      for (let i = 0; i < 400 && !u; i++) {
        w.step();
        u = w.playerUnits(0).find((x) => !before.has(x.id)) ?? null;
      }
      expect(u).not.toBeNull();
      // Spawned on the front side of the footprint.
      const side = [u!.y >= b.ty + b.h, u!.x >= b.tx + b.w, u!.y <= b.ty, u!.x <= b.tx][facing];
      expect(side).toBe(true);
    }
    const w = new World(config);
    const hq = w.playerBuildings(0)[0];
    expect(
      w.issue({ type: 'build', player: 0, building: 'power-plant', tx: hq.tx + 4, ty: hq.ty, facing: 7 }).ok,
    ).toBe(true);
    expect(w.playerBuildings(0).find((x) => x.type === 'power-plant')!.facing).toBe(0);
  });
});
