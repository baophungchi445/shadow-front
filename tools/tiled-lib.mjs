// Shared helpers for the map generators: a tile canvas with drawing primitives and a Tiled JSON writer.
// Generated maps are starting points; afterwards the JSON in packages/game-data/src/maps is the source of truth
// (open it in Tiled, edit, save). Re-running a generator overwrites manual edits.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OUT = join(dirname(fileURLToPath(import.meta.url)), '../packages/game-data/src/maps');
// New kinds are appended so existing maps keep their tile ids.
export const KINDS = ['sand', 'grass', 'road', 'concrete', 'ore', 'rock', 'water', 'urban', 'snow', 'forest'];
const COLORS = [
  0xc4a46a, 0x6c8744, 0x5c5a55, 0x8a8b86, 0xa98b52, 0x8b7658, 0x2e6a86, 0x4c4f53, 0xdfe6ea, 0x35512a,
];
const T = 32; // tile size in pixels (editor only)

/** Standard 4 corner spawns (top-left tile of the 3×3 HQ). */
export const CORNER_SPAWNS = [
  { tx: 6, ty: 6 },
  { tx: 55, ty: 55 },
  { tx: 55, ty: 6 },
  { tx: 6, ty: 55 },
];

/** Square tile canvas with a deterministic RNG and drawing primitives. */
export function createCanvas(n, base, seedValue) {
  let seed = seedValue;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tiles = new Array(n * n).fill(base);
  const set = (x, y, k) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < n && y < n) tiles[y * n + x] = k;
  };
  const get = (x, y) => tiles[y * n + x];
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
  const rect = (x, y, w, h, k) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, k);
  };
  /** 180° rotational symmetry: the southern half becomes the rotated northern half (fair 1v1 / 2v2). */
  const mirror180 = () => {
    for (let y = n / 2; y < n; y++)
      for (let x = 0; x < n; x++) tiles[y * n + x] = tiles[(n - 1 - y) * n + (n - 1 - x)];
  };
  /** Concrete pads under the HQs. */
  const pads = (spawns) => {
    for (const s of spawns)
      for (let j = -1; j < 4; j++) for (let i = -1; i < 4; i++) set(s.tx + i, s.ty + j, 'concrete');
  };
  return { n, tiles, rnd, set, get, disc, line, rect, mirror180, pads };
}

/** Writes `<file>` (Tiled JSON, embedded tileset) and the shared editor tileset image. */
export function writeTiledMap({ file, name, description, oreAmount, canvas, spawns, points }) {
  const N = canvas.n;
  let objId = 1;
  const pointObj = (objName, px, py, props) => ({
    id: objId++,
    name: objName,
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
      { name: 'name', type: 'string', value: name },
      { name: 'description', type: 'string', value: description },
      { name: 'oreAmount', type: 'int', value: oreAmount },
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
        data: canvas.tiles.map((k) => KINDS.indexOf(k) + 1),
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
        objects: spawns.map((s, i) =>
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
  writeFileSync(join(OUT, file), json + '\n');
  writeTileset();
  console.log(`wrote ${file} + terrain-tiles.png`);
}

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

/** Editor tileset image: one flat swatch per terrain kind (matches the in-game base colours). */
function writeTileset() {
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
}
