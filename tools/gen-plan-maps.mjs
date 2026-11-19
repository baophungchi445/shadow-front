// Generates the four maps named in docs/PLAN.md §6 as Tiled JSON in packages/game-data/src/maps:
// Snowfield, Forest Warfare, Island Conflict, Industrial Zone.
// Every map has the 4 corner spawns and 180° rotational symmetry (fair 1v1 and 2v2).
// After generation the JSON files are the source of truth (edit them in Tiled); re-running overwrites manual edits.
// Usage: node tools/gen-plan-maps.mjs
import { CORNER_SPAWNS, createCanvas, writeTiledMap } from './tiled-lib.mjs';

const N = 64;
const homeOre = (c) => {
  c.disc(15, 9, 2.2, 'ore', 0.25);
  c.disc(48, 9, 2.2, 'ore', 0.25);
};
const clearBases = (c, kind) => {
  for (const s of CORNER_SPAWNS) c.disc(s.tx + 1, s.ty + 1, 8.5, kind);
};
const clearAround = (c, pts, kind) => {
  for (const p of pts)
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c.set(p.x + i, p.y + j, kind);
};

// ------------------------------------------------------------------ Snowfield
{
  const c = createCanvas(N, 'snow', 4401);
  const { rnd, disc, line } = c;
  for (let k = 0; k < 8; k++) disc(Math.floor(rnd() * N), Math.floor(rnd() * 30), 1.5 + rnd() * 2.5, 'forest', 0.5);
  for (let k = 0; k < 10; k++) disc(Math.floor(4 + rnd() * 56), Math.floor(12 + rnd() * 18), 0.8 + rnd() * 1.4, 'rock', 0.4);
  // Frozen lakes (impassable open water) with a land bridge through the middle.
  disc(22, 27, 3.2, 'water', 0.3);
  disc(44, 22, 2.6, 'water', 0.3);
  line(16, 20, 24, 14, 'rock', 2); // ridge
  clearBases(c, 'snow');
  line(7, 7, 31, 31, 'road', 2);
  line(56, 7, 33, 30, 'road', 2);
  homeOre(c);
  disc(31, 18, 1.8, 'ore', 0.25);
  disc(6, 30, 1.8, 'ore', 0.25);
  c.pads(CORNER_SPAWNS);
  c.mirror180();
  const points = [
    { x: 31, y: 31, name: 'Frozen Crossroads' },
    { x: 31, y: 18, name: 'North Camp' },
    { x: 32, y: 45, name: 'South Camp' },
  ];
  clearAround(c, points, 'snow');
  writeTiledMap({
    file: 'snowfield.json',
    name: 'Snowfield',
    description: 'Frozen plains with pine groves, icy lakes and a rocky ridge. Long sightlines, few chokepoints.',
    oreAmount: 1300,
    canvas: c,
    spawns: CORNER_SPAWNS,
    points,
  });
}

// ------------------------------------------------------------------ Forest Warfare
{
  const c = createCanvas(N, 'grass', 5150);
  const { rnd, disc, line, get, set } = c;
  // Dense woods everywhere in the northern half…
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < N; x++) if (rnd() < 0.55 + 0.25 * Math.sin(x * 0.4) * Math.cos(y * 0.35)) set(x, y, 'forest');
  // …smoothed into groves: lonely forest tiles become grass.
  for (let y = 1; y < 31; y++)
    for (let x = 1; x < N - 1; x++) {
      if (get(x, y) !== 'forest') continue;
      let n = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (get(x + dx, y + dy) === 'forest') n++;
      if (n <= 1) set(x, y, 'grass');
    }
  // Trails and clearings carved through the woods.
  line(7, 7, 31, 31, 'grass', 3);
  line(56, 7, 32, 31, 'grass', 3);
  line(7, 9, 7, 31, 'grass', 3);
  line(56, 9, 56, 31, 'grass', 3);
  line(10, 20, 50, 20, 'grass', 2);
  line(7, 7, 31, 31, 'road', 1);
  for (const [x, y, r] of [
    [31, 31, 5],
    [20, 19, 3.5],
    [44, 21, 3.5],
  ])
    disc(x, y, r, 'grass');
  clearBases(c, 'grass');
  homeOre(c);
  disc(20, 19, 1.6, 'ore', 0.2);
  c.pads(CORNER_SPAWNS);
  c.mirror180();
  const points = [
    { x: 31, y: 31, name: 'Old Clearing' },
    { x: 44, y: 21, name: 'Hunter Lodge' },
    { x: 19, y: 42, name: 'Woodcutter Camp' },
  ];
  clearAround(c, points, 'grass');
  writeTiledMap({
    file: 'forest-warfare.json',
    name: 'Forest Warfare',
    description: 'Thick woods split by trails and clearings. Ambushes everywhere; armies must use the paths.',
    oreAmount: 1400,
    canvas: c,
    spawns: CORNER_SPAWNS,
    points,
  });
}

// ------------------------------------------------------------------ Island Conflict
{
  const c = createCanvas(N, 'water', 6262);
  const { rnd, disc, line } = c;
  // Base islands in the corners, a central island, and sand causeways between them.
  for (const s of CORNER_SPAWNS) disc(s.tx + 1, s.ty + 1, 11, 'sand', 0.6);
  disc(31, 31, 8, 'grass', 0.8);
  disc(31, 31, 6, 'sand', 0.4);
  line(12, 12, 27, 27, 'sand', 3); // NW base → centre
  line(51, 12, 36, 27, 'sand', 3); // NE base → centre
  line(16, 7, 47, 7, 'sand', 2); // northern coastal causeway between the two northern bases
  line(7, 16, 7, 31, 'sand', 3); // west causeway (north half)…
  line(54, 16, 54, 31, 'sand', 3); // …and its east twin, which the 180° mirror turns into the west causeway's southern half
  for (let k = 0; k < 6; k++) disc(Math.floor(10 + rnd() * 44), Math.floor(4 + rnd() * 24), 0.8 + rnd(), 'rock', 0.3);
  clearBases(c, 'sand');
  homeOre(c);
  disc(31, 26, 1.8, 'ore', 0.2);
  c.pads(CORNER_SPAWNS);
  c.mirror180();
  const points = [
    { x: 31, y: 31, name: 'Central Isle' },
    { x: 31, y: 7, name: 'North Causeway' },
    { x: 32, y: 56, name: 'South Causeway' },
  ];
  clearAround(c, points, 'sand');
  writeTiledMap({
    file: 'island-conflict.json',
    name: 'Island Conflict',
    description: 'Island bases joined by narrow sand causeways around a central isle. Aircraft rule; ground armies queue at the crossings.',
    oreAmount: 1300,
    canvas: c,
    spawns: CORNER_SPAWNS,
    points,
  });
}

// ------------------------------------------------------------------ Industrial Zone
{
  const c = createCanvas(N, 'concrete', 7373);
  const { rnd, rect, line } = c;
  // Factory blocks between a road grid; a canal splits the zone.
  for (let k = 0; k < 64; k += 9) {
    rect(k, 0, 2, 32, 'road');
    rect(0, k, N, 2, 'road');
  }
  for (let by = 0; by < 4; by++)
    for (let bx = 0; bx < 8; bx++) {
      const x = bx * 9 + 2;
      const y = by * 9 + 2;
      const r = rnd();
      if (r < 0.45) rect(x, y, 6, 6, 'urban');
      else if (r < 0.6) {
        rect(x, y, 3, 6, 'urban');
        rect(x + 4, y + 1, 2, 2, 'rock');
      }
    }
  line(0, 29, 26, 29, 'water', 2);
  rect(9, 28, 2, 4, 'road'); // bridge
  rect(18, 28, 2, 4, 'road'); // bridge
  clearBases(c, 'concrete');
  homeOre(c);
  c.disc(31, 22, 2, 'ore', 0.2);
  c.pads(CORNER_SPAWNS);
  c.mirror180();
  const points = [
    { x: 31, y: 31, name: 'Refinery' },
    { x: 31, y: 22, name: 'Rail Yard' },
    { x: 32, y: 41, name: 'Docks' },
  ];
  clearAround(c, points, 'concrete');
  writeTiledMap({
    file: 'industrial-zone.json',
    name: 'Industrial Zone',
    description: 'Factories, rail yards and a canal. Tight streets favour infantry and close-range armor.',
    oreAmount: 1500,
    canvas: c,
    spawns: CORNER_SPAWNS,
    points,
  });
}
