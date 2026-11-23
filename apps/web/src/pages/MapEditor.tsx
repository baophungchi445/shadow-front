import { useEffect, useMemo, useRef, useState } from 'react';
import type { TileKind } from '@shadow-front/shared-types';
import {
  CUSTOM_MAP_SIZES,
  TILE_KINDS,
  blankMap,
  customMapErrors,
  navalInfo,
  decodeTiles,
  encodeTiles,
  toMapDef,
  type StoredMap,
} from '@shadow-front/game-data';
import { useApp } from '../stores/appStore';
import { TILE_COLORS } from '../game/render/terrain';
import { deleteCustomMap, loadCustomMaps, upsertCustomMap } from '../game/customMaps';
import { useT } from '../i18n';

type Tool = TileKind | 'spawn' | 'point';

const TILE_LABELS: Record<TileKind, string> = {
  sand: 'Sand',
  grass: 'Grass',
  road: 'Road',
  concrete: 'Concrete',
  ore: 'Ore',
  rock: 'Rock (blocked)',
  water: 'Water (blocked)',
  urban: 'Buildings (blocked)',
  snow: 'Snow',
  forest: 'Forest (blocked)',
  hill: 'Hill (high ground)',
};

const CANVAS = 640;
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const POINT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

interface Editing {
  name: string;
  width: number;
  height: number;
  tiles: TileKind[];
  spawns: { tx: number; ty: number }[];
  points: { x: number; y: number; name: string }[];
}

const fromStored = (m: StoredMap): Editing => ({
  name: m.name,
  width: m.width,
  height: m.height,
  tiles: decodeTiles(m.tiles),
  spawns: m.spawns.map((s) => ({ ...s })),
  points: m.points.map((p) => ({ ...p })),
});

const toStored = (e: Editing): StoredMap => ({
  name: e.name.trim() || 'Custom map',
  width: e.width,
  height: e.height,
  tiles: encodeTiles(e.tiles),
  spawns: e.spawns,
  points: e.points,
});

/**
 * Map editor (offline): paint terrain and ore, place 2–4 spawns and strategic points, mirror for fairness,
 * validate with the same rules the game uses, save in this browser and play the map in a skirmish.
 */
export function MapEditor() {
  const { go } = useApp();
  const t = useT();
  const [maps, setMaps] = useState(loadCustomMaps);
  const [ed, setEd] = useState<Editing>(() => fromStored(maps[0] ?? blankMap('My map', 64)));
  const [tool, setTool] = useState<Tool>('rock');
  const [brush, setBrush] = useState(3);
  const [mirror, setMirror] = useState(true);
  const [size, setSize] = useState<number>(64);
  const [note, setNote] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const cell = Math.floor(CANVAS / Math.max(ed.width, ed.height));
  const errors = useMemo(() => customMapErrors(toMapDef(toStored(ed))), [ed]);
  const naval = useMemo(() => navalInfo(toMapDef(toStored(ed))), [ed]);
  const harbours = naval.harbours.flatMap((ok, i) => (ok ? [i + 1] : []));

  // ---------------------------------------------------------------- drawing
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    for (let y = 0; y < ed.height; y++)
      for (let x = 0; x < ed.width; x++) {
        const k = ed.tiles[y * ed.width + x];
        ctx.fillStyle = css(TILE_COLORS[k]);
        ctx.fillRect(x * cell, y * cell, cell, cell);
        if (k === 'ore') {
          ctx.fillStyle = '#f2c94a';
          ctx.fillRect(x * cell + cell * 0.3, y * cell + cell * 0.3, cell * 0.4, cell * 0.4);
        }
      }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= ed.width; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, ed.height * cell);
      ctx.stroke();
    }
    for (let j = 0; j <= ed.height; j += 4) {
      ctx.beginPath();
      ctx.moveTo(0, j * cell + 0.5);
      ctx.lineTo(ed.width * cell, j * cell + 0.5);
      ctx.stroke();
    }
    ed.spawns.forEach((s, i) => {
      ctx.fillStyle = 'rgba(156,240,106,0.85)';
      ctx.fillRect(s.tx * cell, s.ty * cell, cell * 3, cell * 3);
      ctx.strokeStyle = '#0b0e11';
      ctx.strokeRect(s.tx * cell + 0.5, s.ty * cell + 0.5, cell * 3, cell * 3);
      ctx.fillStyle = '#0b0e11';
      ctx.font = `bold ${Math.max(10, cell * 1.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), (s.tx + 1.5) * cell, (s.ty + 1.5) * cell);
    });
    for (const p of ed.points) {
      ctx.fillStyle = '#6fc3ff';
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b0e11';
      ctx.stroke();
    }
  }, [ed, cell]);

  // ---------------------------------------------------------------- editing
  const tileAt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * (CANVAS / cell));
    const y = Math.floor(((e.clientY - r.top) / r.height) * (CANVAS / cell));
    return x >= 0 && y >= 0 && x < ed.width && y < ed.height ? { x, y } : null;
  };
  const mirrored = (x: number, y: number) => ({ x: ed.width - 1 - x, y: ed.height - 1 - y });

  const paint = (x: number, y: number, kind: TileKind) => {
    setEd((cur) => {
      const tiles = cur.tiles.slice();
      const r = Math.floor(brush / 2);
      const put = (cx: number, cy: number) => {
        for (let j = -r; j <= r; j++)
          for (let i = -r; i <= r; i++) {
            const px = cx + i;
            const py = cy + j;
            if (px >= 0 && py >= 0 && px < cur.width && py < cur.height) tiles[py * cur.width + px] = kind;
          }
      };
      put(x, y);
      if (mirror) put(cur.width - 1 - x, cur.height - 1 - y);
      return { ...cur, tiles };
    });
  };

  const toggleSpawn = (x: number, y: number) => {
    setEd((cur) => {
      const hit = cur.spawns.findIndex((s) => x >= s.tx - 1 && x <= s.tx + 3 && y >= s.ty - 1 && y <= s.ty + 3);
      if (hit >= 0) {
        const s = cur.spawns[hit];
        const twin = { tx: cur.width - 3 - s.tx, ty: cur.height - 3 - s.ty };
        return {
          ...cur,
          spawns: cur.spawns.filter(
            (o, i) => i !== hit && !(mirror && o.tx === twin.tx && o.ty === twin.ty),
          ),
        };
      }
      const add = [{ tx: x - 1, ty: y - 1 }];
      if (mirror) add.push({ tx: cur.width - 3 - (x - 1), ty: cur.height - 3 - (y - 1) });
      const spawns = [...cur.spawns, ...add].slice(0, 4);
      return { ...cur, spawns };
    });
  };

  const togglePoint = (x: number, y: number) => {
    setEd((cur) => {
      const hit = cur.points.findIndex((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1);
      if (hit >= 0) {
        const p = cur.points[hit];
        const m = mirrored(p.x, p.y);
        return {
          ...cur,
          points: cur.points.filter((o, i) => i !== hit && !(mirror && o.x === m.x && o.y === m.y)),
        };
      }
      const add = [{ x, y }];
      const m = mirrored(x, y);
      if (mirror && (m.x !== x || m.y !== y)) add.push(m);
      const points = [...cur.points, ...add]
        .slice(0, 8)
        .map((p, i) => ({ ...p, name: `Point ${POINT_NAMES[i]}` }));
      return { ...cur, points };
    });
  };

  const onDown = (e: React.PointerEvent) => {
    const p = tileAt(e);
    if (!p) return;
    if (tool === 'spawn') toggleSpawn(p.x, p.y);
    else if (tool === 'point') togglePoint(p.x, p.y);
    else {
      painting.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
      paint(p.x, p.y, tool);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!painting.current || tool === 'spawn' || tool === 'point') return;
    const p = tileAt(e);
    if (p) paint(p.x, p.y, tool);
  };
  const onUp = () => (painting.current = false);

  // ---------------------------------------------------------------- storage
  const save = () => {
    const stored = toStored(ed);
    setMaps(upsertCustomMap(stored));
    setEd({ ...ed, name: stored.name });
    setNote(t('Saved "{name}".', { name: stored.name }));
  };
  const play = () => {
    const stored = toStored(ed);
    setMaps(upsertCustomMap(stored));
    try {
      const raw = JSON.parse(localStorage.getItem('shadow-front.skirmish') ?? '{}') as Record<string, unknown>;
      localStorage.setItem(
        'shadow-front.skirmish',
        JSON.stringify({ ...raw, mapId: 'custom', customName: stored.name }),
      );
    } catch {
      // Storage unavailable: the player picks the map in the setup screen.
    }
    go('skirmish');
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)] p-4">
      <div className="panel flex max-h-full w-[1120px] max-w-full flex-col overflow-auto p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">{t('Map editor')}</h2>
          <button className="btn" onClick={() => go('menu')}>
            {t('◀ Back')}
          </button>
        </div>
        <div className="grid grid-cols-[640px_minmax(0,1fr)] gap-5">
          <canvas
            ref={canvas}
            width={CANVAS}
            height={CANVAS}
            className="cursor-crosshair rounded border border-graphite-600 bg-graphite-950"
            style={{ touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            data-testid="editor-canvas"
          />
          <div className="flex min-w-0 flex-col gap-3 text-sm">
            <section className="flex gap-2">
              <input
                className="field flex-1"
                value={ed.name}
                maxLength={24}
                onChange={(e) => setEd({ ...ed, name: e.target.value })}
                data-testid="map-name"
              />
              <select className="field" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                {CUSTOM_MAP_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}×{s}
                  </option>
                ))}
              </select>
              <button className="btn px-2 text-xs" onClick={() => setEd(fromStored(blankMap(t('New map'), size)))}>
                {t('New')}
              </button>
            </section>
            <section>
              <div className="panel-title mb-1">{t('Terrain brush')}</div>
              <div className="grid grid-cols-5 gap-1" data-testid="palette">
                {TILE_KINDS.map((k) => (
                  <button
                    key={k}
                    title={t(TILE_LABELS[k])}
                    onClick={() => setTool(k)}
                    data-tool={k}
                    className={`h-8 rounded border-2 text-[10px] font-semibold ${tool === k ? 'border-warn-400' : 'border-graphite-700'}`}
                    style={{ background: css(TILE_COLORS[k]), color: k === 'snow' || k === 'sand' ? '#222' : '#eee' }}
                  >
                    {t(TILE_LABELS[k].split(' ')[0])}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-gray-400">{t('Brush size')}</span>
                {[1, 3, 5, 9].map((b) => (
                  <button
                    key={b}
                    className={`btn px-2 py-0.5 text-xs ${brush === b ? 'border-warn-500 text-warn-400' : ''}`}
                    onClick={() => setBrush(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </section>
            <section className="flex flex-wrap items-center gap-2">
              <button
                className={`btn px-2 py-1 text-xs ${tool === 'spawn' ? 'border-warn-500 text-warn-400' : ''}`}
                onClick={() => setTool('spawn')}
                data-tool="spawn"
              >
                {t('Spawn (HQ 3×3)')} · {ed.spawns.length}/4
              </button>
              <button
                className={`btn px-2 py-1 text-xs ${tool === 'point' ? 'border-warn-500 text-warn-400' : ''}`}
                onClick={() => setTool('point')}
                data-tool="point"
              >
                {t('Strategic point')} · {ed.points.length}/8
              </button>
              <label className="flex items-center gap-1 text-xs text-gray-300" title={t('Paint and place symmetrically (180° rotation) so every side is fair')}>
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} data-testid="mirror" />
                {t('Mirror (fair map)')}
              </label>
            </section>
            <div className="text-[11px] text-gray-500">
              {t('Click a spawn or point again to remove it. Drag to paint terrain.')}
            </div>
            <section data-testid="map-check">
              {errors.length ? (
                <ul className="space-y-0.5 text-xs text-warn-400">
                  {errors.map((e) => (
                    <li key={e}>⚠ {t.msg(e)}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs font-semibold text-mil-400">✔ {t('Map is playable')}</div>
              )}
              <div className="mt-1 text-xs text-gray-400" data-testid="naval-info">
                ⚓{' '}
                {harbours.length
                  ? t('Navy: open sea of {n} tiles; Naval Yard possible at spawn {list}', {
                      n: naval.largestSea,
                      list: harbours.join(', '),
                    })
                  : t('Navy: no harbour — needs a sea of 300+ water tiles touching open ground near a spawn')}
              </div>
            </section>
            <section className="flex gap-2">
              <button className="btn" onClick={save} data-testid="save-map">
                {t('Save')}
              </button>
              <button className="btn btn-primary" disabled={errors.length > 0} onClick={play} data-testid="play-map">
                {t('Play this map ▶')}
              </button>
            </section>
            {note && <div className="text-xs text-mil-300">{note}</div>}
            <section>
              <div className="panel-title mb-1">{t('Saved maps')}</div>
              {maps.length === 0 && <div className="text-xs text-gray-500">{t('No saved maps yet.')}</div>}
              <ul className="space-y-1" data-testid="saved-maps">
                {maps.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-200">
                      {m.name} <span className="text-gray-500">· {m.width}×{m.height} · {m.spawns.length}P</span>
                    </span>
                    <span className="flex gap-1">
                      <button className="btn px-2 py-0.5 text-xs" onClick={() => setEd(fromStored(m))}>
                        {t('Load')}
                      </button>
                      <button className="btn px-2 py-0.5 text-xs" onClick={() => setMaps(deleteCustomMap(m.name))}>
                        {t('Delete')}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
