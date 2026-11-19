import { SURVIVAL, waveComposition } from '@shadow-front/game-data';
import type { Entity, Unit } from '../types';
import type { World } from '../world';

/**
 * Survival wave director.
 *
 * Waves are part of the mode itself (like a scenario script), not an AI player: units are spawned
 * for free at entry points that are announced in advance, then attack-move toward the nearest
 * defender building. Defenders play by the normal economy rules.
 */
export function updateWaves(world: World): void {
  const s = world.survival;
  if (!s) return;
  const t = world.tick;

  if (s.wave < s.total) {
    if (t === s.nextWaveTick - SURVIVAL.warningTicks) {
      world.emit({
        type: 'waveIncoming',
        wave: s.wave + 1,
        x: s.nextEntry.x,
        y: s.nextEntry.y,
        inTicks: s.nextWaveTick - t,
      });
    }
    if (t >= s.nextWaveTick) spawnWave(world);
  }

  if (t % SURVIVAL.retargetTicks === 0) retarget(world);
}

function spawnWave(world: World): void {
  const s = world.survival!;
  s.wave++;
  const entry = s.nextEntry;
  const types = waveComposition(s.wave, s.difficulty, world.rng);
  const spots = world.grid.spreadTiles(Math.floor(entry.x), Math.floor(entry.y), types.length);
  const units: Unit[] = [];
  types.forEach((type, i) => {
    const tile = spots[i] ?? { x: Math.floor(entry.x), y: Math.floor(entry.y) };
    units.push(world.createUnit(s.raider, type, tile.x + 0.5, tile.y + 0.5));
  });
  world.emit({ type: 'waveSpawned', wave: s.wave, x: entry.x, y: entry.y, count: units.length });

  const target = nearestDefenderTarget(world, entry.x, entry.y);
  if (target && units.length)
    world.issue({
      type: 'move',
      player: s.raider,
      units: units.map((u) => u.id),
      x: target.x,
      y: target.y,
      attackMove: true,
    });

  if (s.wave < s.total) {
    s.nextWaveTick = world.tick + SURVIVAL.intervalTicks;
    s.nextEntry = s.entries[Math.floor(world.rng() * s.entries.length)];
  }
}

/** Sends idle wave units at the nearest defender building (or unit if no buildings remain). */
function retarget(world: World): void {
  const s = world.survival!;
  const idle = world.playerUnits(s.raider).filter((u) => u.order.type === 'idle' && u.targetId === null);
  if (!idle.length) return;
  // Group by nearest target so a wave does not scatter.
  const byTarget = new Map<Entity, number[]>();
  for (const u of idle) {
    const target = nearestDefenderTarget(world, u.x, u.y);
    if (!target) return;
    const ids = byTarget.get(target) ?? [];
    ids.push(u.id);
    byTarget.set(target, ids);
  }
  for (const [target, ids] of byTarget)
    world.issue({ type: 'move', player: s.raider, units: ids, x: target.x, y: target.y, attackMove: true });
}

function nearestDefenderTarget(world: World, x: number, y: number): Entity | null {
  const raiderTeam = world.players[world.survival!.raider].team;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const b of world.buildings()) {
    if (b.team === raiderTeam) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (best) return best;
  for (const u of world.units()) {
    if (u.team === raiderTeam) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}
