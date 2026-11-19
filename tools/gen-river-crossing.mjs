// Generates packages/game-data/src/maps/river-crossing.json (Tiled JSON) and its editor tileset image.
// After generation the JSON is the source of truth: open it in Tiled (https://www.mapeditor.org), edit, save —
// the game imports it directly through `parseTiledMap`. Re-running this script overwrites manual edits.
// Usage: node tools/gen-river-crossing.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../packages/game-data/src/maps');
const KINDS = ['sand', 'grass', 'road', 'concrete', 'ore', 'rock', 'water', 'urban'];
const COLORS = [0xc4a46a, 0x6c8744, 0x5c5a55, 0x8a8b86, 0xa98b52, 0x8b7658, 0x2e6a86, 0x4c4f53];
const N = 64;
const T = 32; // tile size in pixels (editor only)

let seed = 2077;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const tiles = new Array(N * N).fill('grass');
const set = (x, y, k) => {
  if (x >= 0 && y >= 0 && x < N && y < N) tiles[y * N + x] = k;
};
const get = (x, y) => tiles[y * N + x];
const disc = (cx, cy, r, k, rough = 0) => {
  const R = Math.ceil(r + 1);
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++)
      if (Math.hypot(i, j) <= r + (rough ? (rnd() - 0.5) * rough * 2 : 0)) set(cx + i, cy + j, k);
};
const line = (x0, y0, x1, y1, k, w = 2) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
  for (let s = 0; s <= steps; s++) {
    const t = steps ? s / steps : 0;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) set(x + i, y + j, k);
  }
};

// River centre line, rotationally symmetric about the map centre.
const riverY = (x) => 31.5 + 3.2 * Math.sin((x - 31.5) / 6.5);

// Dry sand patches and rocky hills (north half; mirrored at the end).
for (let k = 0; k < 7; k++) disc(Math.floor(rnd() * N), Math.floor(rnd() * 26), 2 + rnd() * 3, 'sand', 0.5);
for (let k = 0; k < 11; k++)
  disc(Math.floor(4 + rnd() * 56), Math.floor(12 + rnd() * 14), 1 + rnd() * 1.6, 'rock', 0.4);
line(20, 14, 27, 20, 'rock', 2);
line(38, 12, 44, 16, 'rock', 2);

// Base clearings.
const SPAWNS = [
  { tx: 6, ty: 6 },
  { tx: 55, ty: 55 },
  { tx: 55, ty: 6 },
  { tx: 6, ty: 55 },
];
for (const s of SPAWNS) disc(s.tx + 1, s.ty + 1, 8.5, 'grass');

// River with sandy banks.
for (let x = 0; x < N; x++) {
  const c = riverY(x + 0.5);
  for (let y = 0; y < N; y++) {
    const d = Math.abs(y + 0.5 - c);
    if (d <= 1.6) set(x, y, 'water');
    else if (d <= 2.6 && get(x, y) !== 'rock') set(x, y, 'sand');
  }
}

// Bridges (roads) and shallow fords (sand) across the river.
const BRIDGES = [11, 31, 51];
const FORDS = [21, 41];
for (const bx of BRIDGES)
  for (let x = bx; x < bx + 2; x++) {
    const c = riverY(x + 0.5);
    for (let y = Math.floor(c - 4); y <= Math.ceil(c + 4); y++) set(x, y, 'road');
  }
for (const fx of FORDS)
  for (let x = fx; x < fx + 2; x++) {
    const c = riverY(x + 0.5);
    for (let y = Math.floor(c - 2); y <= Math.ceil(c + 2); y++) set(x, y, 'sand');
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

// Concrete pads under the HQs.
for (const s of SPAWNS)
  for (let j = -1; j < 4; j++) for (let i = -1; i < 4; i++) set(s.tx + i, s.ty + j, 'concrete');

// 180° rotational symmetry: the southern half is the rotated northern half (fair 1v1 and 2v2).
for (let y = 32; y < N; y++)
  for (let x = 0; x < N; x++) tiles[y * N + x] = tiles[(N - 1 - y) * N + (N - 1 - x)];

const pointAt = (x, name) => ({ x, y: Math.floor(riverY(x + 0.5)), name });
const points = [pointAt(11, 'West Bridge'), pointAt(31, 'Central Bridge'), pointAt(52, 'East Bridge')];

let objId = 1;
const pointObj = (name, px, py, props) => ({
  id: objId++,
  name,
  type: '',
  x: px,
  y: py,
  width: 0,
  height: 0,
  rotation: 0,
  visible: true,
  point: true,
  ...(props ? { properties: props } : {}),
});

const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  width: N,
  height: N,
  tilewidth: T,
  tileheight: T,
  infinite: false,
  nextlayerid: 4,
  nextobjectid: 0,
  properties: [
    { name: 'name', type: 'string', value: 'River Crossing' },
    {
      name: 'description',
      type: 'string',
      value:
        'Green valley split by a winding river. Three bridges and two shallow fords decide every battle.',
    },
    { name: 'oreAmount', type: 'int', value: 1400 },
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'shadow-front-terrain',
      tilewidth: T,
      tileheight: T,
      tilecount: KINDS.length,
      columns: KINDS.length,
      margin: 0,
      spacing: 0,
      image: 'terrain-tiles.png',
      imagewidth: T * KINDS.length,
      imageheight: T,
      tiles: KINDS.map((k, id) => ({ id, properties: [{ name: 'kind', type: 'string', value: k }] })),
    },
  ],
  layers: [
    {
      id: 1,
      name: 'terrain',
      type: 'tilelayer',
      width: N,
      height: N,
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      data: tiles.map((k) => KINDS.indexOf(k) + 1),
    },
    {
      id: 2,
      name: 'spawns',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      // Spawn = top-left tile of the 3×3 HQ.
      objects: SPAWNS.map((s, i) =>
        pointObj(`Spawn ${i + 1}`, s.tx * T + T / 2, s.ty * T + T / 2, [
          { name: 'index', type: 'int', value: i },
        ]),
      ),
    },
    {
      id: 3,
      name: 'points',
      type: 'objectgroup',
      draworder: 'topdown',
      x: 0,
      y: 0,
      opacity: 1,
      visible: true,
      objects: points.map((p) => pointObj(p.name, p.x * T + T / 2, p.y * T + T / 2)),
    },
  ],
};
map.nextobjectid = objId;

// Terrain as one row per line so diffs stay readable.
const rows = [];
for (let y = 0; y < N; y++) rows.push(map.layers[0].data.slice(y * N, (y + 1) * N).join(','));
const json = JSON.stringify(map, null, 1).replace(
  /"data": \[[\s\S]*?\]/,
  `"data": [\n${rows.join(',\n')}\n]`,
);
writeFileSync(join(OUT, 'river-crossing.json'), json + '\n');

// Editor tileset image: one flat swatch per terrain kind (matches the in-game base colours).
function crcTable() {
  return Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
}
function png(w, h, rgba) {
  const table = crcTable();
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const W = T * KINDS.length;
const img = Buffer.alloc(W * T * 4);
for (let y = 0; y < T; y++)
  for (let x = 0; x < W; x++) {
    const c = COLORS[Math.floor(x / T)];
    const edge = x % T === 0 || y === 0 ? 0.8 : 1;
    const o = (y * W + x) * 4;
    img[o] = ((c >> 16) & 255) * edge;
    img[o + 1] = ((c >> 8) & 255) * edge;
    img[o + 2] = (c & 255) * edge;
    img[o + 3] = 255;
  }
writeFileSync(join(OUT, 'terrain-tiles.png'), png(W, T, img));
console.log('wrote river-crossing.json + terrain-tiles.png');
