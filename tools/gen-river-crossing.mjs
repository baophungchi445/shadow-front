// Generates packages/game-data/src/maps/river-crossing.json (Tiled JSON).
// The JSON is the source of truth afterwards: open it in Tiled, edit, save. Re-running overwrites manual edits.
// Usage: node tools/gen-river-crossing.mjs
import { CORNER_SPAWNS, createCanvas, writeTiledMap } from './tiled-lib.mjs';

const c = createCanvas(64, 'grass', 2077);
const { rnd, set, get, disc, line } = c;
const N = c.n;

// River centre line, rotationally symmetric about the map centre.
const riverY = (x) => 31.5 + 3.2 * Math.sin((x - 31.5) / 6.5);

// Dry sand patches and rocky hills (north half; mirrored at the end).
for (let k = 0; k < 7; k++) disc(Math.floor(rnd() * N), Math.floor(rnd() * 26), 2 + rnd() * 3, 'sand', 0.5);
for (let k = 0; k < 11; k++)
  disc(Math.floor(4 + rnd() * 56), Math.floor(12 + rnd() * 14), 1 + rnd() * 1.6, 'rock', 0.4);
line(20, 14, 27, 20, 'rock', 2);
line(38, 12, 44, 16, 'rock', 2);

// Base clearings.
for (const s of CORNER_SPAWNS) disc(s.tx + 1, s.ty + 1, 8.5, 'grass');

// River with sandy banks.
for (let x = 0; x < N; x++) {
  const cy = riverY(x + 0.5);
  for (let y = 0; y < N; y++) {
    const d = Math.abs(y + 0.5 - cy);
    if (d <= 1.6) set(x, y, 'water');
    else if (d <= 2.6 && get(x, y) !== 'rock') set(x, y, 'sand');
  }
}

// Bridges (roads) and shallow fords (sand) across the river.
for (const bx of [11, 31, 51])
  for (let x = bx; x < bx + 2; x++) {
    const cy = riverY(x + 0.5);
    for (let y = Math.floor(cy - 4); y <= Math.ceil(cy + 4); y++) set(x, y, 'road');
  }
for (const fx of [21, 41])
  for (let x = fx; x < fx + 2; x++) {
    const cy = riverY(x + 0.5);
    for (let y = Math.floor(cy - 2); y <= Math.ceil(cy + 2); y++) set(x, y, 'sand');
  }

// Roads from the northern bases to the bridge heads.
const head = (x) => Math.floor(riverY(x + 0.5) - 4);
line(7, 7, 11, head(11), 'road');
line(56, 7, 51, head(51), 'road');
line(11, head(11), 31, head(31), 'road');

// Ore: one field per base and contested fields near the crossings.
for (const [x, y] of [
  [15, 9],
  [48, 9],
])
  disc(x, y, 2.2, 'ore', 0.25);
for (const [x, y] of [
  [25, 22],
  [40, 21],
  [3, 22],
])
  disc(x, y, 1.9, 'ore', 0.25);

c.pads(CORNER_SPAWNS);
c.mirror180();

const pointAt = (x, name) => ({ x, y: Math.floor(riverY(x + 0.5)), name });
writeTiledMap({
  file: 'river-crossing.json',
  name: 'River Crossing',
  description:
    'Green valley split by a winding river. Three bridges and two shallow fords decide every battle.',
  oreAmount: 1400,
  canvas: c,
  spawns: CORNER_SPAWNS,
  points: [pointAt(11, 'West Bridge'), pointAt(31, 'Central Bridge'), pointAt(52, 'East Bridge')],
});
