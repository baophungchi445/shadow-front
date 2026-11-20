import { describe, expect, it } from 'vitest';
import type { MatchConfig } from '@shadow-front/shared-types';
import { BALANCE, getMap } from '@shadow-front/game-data';
import { World } from './world';

const config = (mapId: MatchConfig['mapId']): MatchConfig => ({
  mapId,
  mission: 'annihilation',
  startingCredits: 5000,
  seed: 6,
  slots: [
    { kind: 'human', name: 'P1', faction: 'western', team: 0 },
    { kind: 'human', name: 'P2', faction: 'eastern', team: 1 },
  ],
});

function firstTile(w: World, kind: string): { tx: number; ty: number } {
  const i = w.map.tiles.findIndex((t) => t === kind);
  if (i < 0) throw new Error(`no ${kind}`);
  return { tx: i % w.map.width, ty: Math.floor(i / w.map.width) };
}

describe('destructible terrain (v0.12)', () => {
  it('woods burn down to grass and city blocks collapse into rubble, opening the tile', () => {
    const w = new World(config('forest-warfare'));
    const f = firstTile(w, 'forest');
    expect(w.grid.walkable(f.tx, f.ty)).toBe(false);
    const v0 = w.grid.version;
    w.damageTerrain(f.tx + 0.5, f.ty + 0.5, 0.5, BALANCE.forestHp / 2);
    expect(w.map.tiles[f.ty * w.map.width + f.tx]).toBe('forest');
    w.damageTerrain(f.tx + 0.5, f.ty + 0.5, 0.5, BALANCE.forestHp);
    expect(w.map.tiles[f.ty * w.map.width + f.tx]).toBe('grass');
    expect(w.grid.walkable(f.tx, f.ty)).toBe(true);
    expect(w.grid.version).toBeGreaterThan(v0);
    expect(
      w.drainEvents().some((e) => e.type === 'terrainDestroyed' && e.was === 'forest' && e.kind === 'grass'),
    ).toBe(true);

    const u = new World(config('urban-conflict'));
    const b = firstTile(u, 'urban');
    u.damageTerrain(b.tx + 0.5, b.ty + 0.5, 0.5, BALANCE.urbanHp * 2);
    expect(u.map.tiles[b.ty * u.map.width + b.tx]).toBe('concrete');
    expect(u.grid.walkable(b.tx, b.ty)).toBe(true);
  });

  it('the shared map definition is not modified', () => {
    const w = new World(config('forest-warfare'));
    const f = firstTile(w, 'forest');
    w.damageTerrain(f.tx + 0.5, f.ty + 0.5, 1, 10_000);
    expect(getMap('forest-warfare').tiles[f.ty * w.map.width + f.tx]).toBe('forest');
    expect(new World(config('forest-warfare')).map.tiles[f.ty * w.map.width + f.tx]).toBe('forest');
  });

  it('artillery shelling a wood clears it; bullets do not', () => {
    const w = new World(config('forest-warfare'));
    const f = firstTile(w, 'forest');
    const idx = f.ty * w.map.width + f.tx;
    // Rifle fire has no splash: the tile is untouched.
    const rifle = w.createUnit(0, 'rifleman', 1, 1);
    w.projectiles.push({
      id: w.allocId(),
      owner: 0,
      team: 0,
      sourceId: rifle.id,
      x: f.tx + 0.5,
      y: f.ty + 0.5,
      tx: f.tx + 0.5,
      ty: f.ty + 0.5,
      targetId: null,
      homing: false,
      weapon: rifle.def.weapon!,
      damageMul: 1,
      air: false,
      crit: false,
      startX: f.tx,
      startY: f.ty,
      apex: 0,
    });
    w.step();
    expect(w.map.tiles[idx]).toBe('forest');
    const arty = w.createUnit(0, 'mobile-artillery', 1, 1);
    for (let k = 0; k < 6 && w.map.tiles[idx] === 'forest'; k++) {
      w.projectiles.push({
        id: w.allocId(),
        owner: 0,
        team: 0,
        sourceId: arty.id,
        x: f.tx + 0.5,
        y: f.ty + 0.5,
        tx: f.tx + 0.5,
        ty: f.ty + 0.5,
        targetId: null,
        homing: false,
        weapon: arty.def.weapon!,
        damageMul: 1,
        air: false,
        crit: false,
        startX: f.tx,
        startY: f.ty,
        apex: 1,
      });
      w.step();
    }
    expect(w.map.tiles[idx]).toBe('grass');
  });
});
