// Generates packages/game-data/src/maps/highland-pass.json (Tiled JSON).
// The JSON is the source of truth afterwards: open it in Tiled, edit, save. Re-running overwrites manual edits.
// Usage: node tools/gen-highland-pass.mjs
import { CORNER_SPAWNS, createCanvas, writeTiledMap } from './tiled-lib.mjs';

const c = createCanvas(64, 'sand', 9091);
const { rnd, set, get, disc, line, rect } = c;
const N = c.n;
const C = 31.5; // map centre

// Grass meadows and scattered boulders in the lowlands (north half; mirrored at the end).
for (let k = 0; k < 6; k++) disc(Math.floor(rnd() * N), Math.floor(rnd() * 28), 2.5 + rnd() * 3, 'grass', 0.6);
for (let k = 0; k < 14; k++) {
  const x = Math.floor(2 + rnd() * 60);
  const y = Math.floor(2 + rnd() * 28);
  if (Math.hypot(x - C, y - C) > 17) disc(x, y, 0.8 + rnd() * 1.4, 'rock', 0.4);
}

// Plateau wall: a rock ring around the centre with four passes (N, S, E, W).
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - C;
    const dy = y + 0.5 - C;
    const r = Math.hypot(dx, dy);
    const inPass = Math.abs(dx) <= 1.6 || Math.abs(dy) <= 1.6;
    if (r >= 12.5 && r <= 15 && !inPass) set(x, y, 'rock');
    else if (r < 12.5) set(x, y, 'concrete');
  }

// Hill town on the plateau: 2×2 blocks between streets, a plaza in the middle.
for (let by = 20; by < 44; by += 5)
  for (let bx = 20; bx < 44; bx += 5) {
    if (Math.hypot(bx + 1 - C, by + 1 - C) > 10.5) continue;
    if (Math.abs(bx + 1 - C) < 4 && Math.abs(by + 1 - C) < 4) continue; // plaza
    if (rnd() < 0.75) rect(bx, by, 2, 2, 'urban');
  }
// Streets through the passes.
rect(30, 14, 4, 36, 'road');
rect(14, 30, 36, 4, 'road');
// Rich ore inside the town.
disc(25, 27, 1.8, 'ore', 0.2);
disc(38, 27, 1.6, 'ore', 0.2);

// Base clearings, home ore and roads to the nearest passes.
for (const s of CORNER_SPAWNS) disc(s.tx + 1, s.ty + 1, 8.5, 'sand');
for (const [x, y] of [
  [15, 9],
  [48, 9],
])
  disc(x, y, 2.2, 'ore', 0.25);
disc(3, 26, 1.8, 'ore', 0.25); // remote field on the west edge
line(8, 8, 30, 14, 'road');
line(55, 8, 33, 14, 'road');
line(7, 9, 14, 30, 'road');

c.pads(CORNER_SPAWNS);
c.mirror180();

// Keep the four pass openings clear of anything the mirror or boulders might have put there.
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - C;
    const dy = y + 0.5 - C;
    const r = Math.hypot(dx, dy);
    if (r >= 11 && r <= 17 && (Math.abs(dx) <= 1.6 || Math.abs(dy) <= 1.6) && get(x, y) === 'rock')
      set(x, y, 'road');
  }

writeTiledMap({
  file: 'highland-pass.json',
  name: 'Highland Pass',
  description:
    'A walled hill town on a central plateau with rich ore, reachable only through four narrow passes. Hold the passes, take the town.',
  oreAmount: 1300,
  canvas: c,
  spawns: CORNER_SPAWNS,
  points: [
    { x: 31, y: 16, name: 'North Pass' },
    { x: 31, y: 31, name: 'Town Square' },
    { x: 32, y: 47, name: 'South Pass' },
  ],
});
