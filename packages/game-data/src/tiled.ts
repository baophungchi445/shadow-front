import type { MapDef, MapId, MapSpawn, TileKind } from '@shadow-front/shared-types';

/**
 * Minimal Tiled (https://www.mapeditor.org) JSON importer → `MapDef`.
 *
 * Authoring contract (orthogonal map, embedded tileset, JSON / .tmj format):
 * - Tile layer `terrain`: every tile set, each tileset tile has a string property `kind` (a `TileKind`).
 * - Object layer `spawns`: point objects; optional int property `index` orders them (else layer order).
 * - Object layer `points`: point objects named after the strategic point.
 * - Map properties: `name` (string), `description` (string), `oreAmount` (int).
 * Object positions are in pixels and are converted to tiles with the map's tile size.
 */

interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

interface TiledObject {
  name?: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledLayer {
  type: string;
  name: string;
  width?: number;
  height?: number;
  data?: number[] | string;
  encoding?: string;
  objects?: TiledObject[];
}

interface TiledTileset {
  firstgid: number;
  name?: string;
  source?: string;
  tiles?: { id: number; properties?: TiledProperty[] }[];
}

export interface TiledMap {
  orientation: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  infinite?: boolean;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

const TILE_KINDS: readonly TileKind[] = [
  'sand',
  'grass',
  'road',
  'concrete',
  'ore',
  'rock',
  'water',
  'urban',
  'snow',
  'forest',
];
/** Tiled stores flip/rotation flags in the top bits of a gid. */
const GID_MASK = 0x1fffffff;

export class TiledImportError extends Error {
  constructor(mapId: string, message: string) {
    super(`Tiled map "${mapId}": ${message}`);
    this.name = 'TiledImportError';
  }
}

const prop = (props: TiledProperty[] | undefined, name: string): unknown =>
  props?.find((p) => p.name === name)?.value;

export function parseTiledMap(json: TiledMap, id: MapId): MapDef {
  const fail = (msg: string): never => {
    throw new TiledImportError(id, msg);
  };
  if (json.orientation !== 'orthogonal') fail(`orientation must be "orthogonal" (got "${json.orientation}")`);
  if (json.infinite) fail('infinite maps are not supported');
  const { width, height, tilewidth, tileheight } = json;
  if (!(width > 0 && height > 0 && tilewidth > 0 && tileheight > 0)) fail('invalid map size');

  // gid → TileKind lookup from embedded tilesets.
  const kinds = new Map<number, TileKind>();
  for (const ts of json.tilesets) {
    if (ts.source) fail(`external tileset "${ts.source}" is not supported — embed the tileset in the map`);
    for (const t of ts.tiles ?? []) {
      const kind = prop(t.properties, 'kind');
      if (kind === undefined) continue;
      if (typeof kind !== 'string' || !TILE_KINDS.includes(kind as TileKind))
        fail(`tileset "${ts.name ?? ts.firstgid}" tile ${t.id} has unknown kind "${String(kind)}"`);
      kinds.set(ts.firstgid + t.id, kind as TileKind);
    }
  }

  const terrain = json.layers.find((l) => l.type === 'tilelayer' && l.name === 'terrain');
  if (!terrain) return fail('missing tile layer "terrain"');
  if (!Array.isArray(terrain.data))
    return fail(
      'layer "terrain" must use CSV/array encoding (Map → Map Properties → Tile Layer Format: CSV)',
    );
  if (terrain.data.length !== width * height)
    fail(`layer "terrain" has ${terrain.data.length} tiles, expected ${width * height}`);
  const tiles: TileKind[] = terrain.data.map((raw, i) => {
    const gid = raw & GID_MASK;
    const kind = kinds.get(gid);
    if (!kind)
      fail(`tile at (${i % width}, ${Math.floor(i / width)}) has gid ${gid} without a "kind" property`);
    return kind as TileKind;
  });

  const toTile = (o: TiledObject) => ({ x: Math.floor(o.x / tilewidth), y: Math.floor(o.y / tileheight) });
  const inside = (t: { x: number; y: number }) => t.x >= 0 && t.y >= 0 && t.x < width && t.y < height;
  const objects = (name: string) =>
    json.layers.find((l) => l.type === 'objectgroup' && l.name === name)?.objects ??
    fail(`missing object layer "${name}"`);

  const spawnObjs = [...objects('spawns')].sort(
    (a, b) => Number(prop(a.properties, 'index') ?? 0) - Number(prop(b.properties, 'index') ?? 0),
  );
  if (spawnObjs.length < 2) fail('needs at least 2 spawns');
  const spawns: MapSpawn[] = spawnObjs.map((o) => {
    const t = toTile(o);
    // The HQ (3×3) is placed with its top-left corner at the spawn tile.
    if (!inside(t) || t.x + 3 > width || t.y + 3 > height)
      fail(`spawn at (${t.x}, ${t.y}) is outside the map`);
    return { tx: t.x, ty: t.y };
  });

  const strategicPoints = objects('points').map((o, i) => {
    const t = toTile(o);
    if (!inside(t)) fail(`strategic point ${o.name || i} is outside the map`);
    return { x: t.x, y: t.y, name: o.name || `Point ${i + 1}` };
  });

  const name = prop(json.properties, 'name');
  const oreAmount = Number(prop(json.properties, 'oreAmount') ?? 1200);
  if (!(oreAmount > 0)) fail('oreAmount must be a positive number');
  return {
    id,
    name: typeof name === 'string' && name ? name : id,
    description: String(prop(json.properties, 'description') ?? ''),
    width,
    height,
    tiles,
    oreAmount,
    spawns,
    strategicPoints,
  };
}
