import { useEffect, useRef, useState } from 'react';
import type {
  Difficulty,
  FactionId,
  MapId,
  MatchSlot,
  MissionType,
  Personality,
} from '@shadow-front/shared-types';
import {
  DEFAULT_UNIT_CAP,
  FACTIONS,
  FACTION_IDS,
  MAP_IDS,
  PERSONALITIES,
  PLAYER_COLORS,
  SURVIVAL,
  UNIT_CAP_OPTIONS,
  getMap,
} from '@shadow-front/game-data';
import { useApp } from '../stores/appStore';
import { TILE_COLORS } from '../game/render/terrain';
import { hex } from '../components/Icon';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'insane'];
const PERSONALITY_IDS = Object.keys(PERSONALITIES) as Personality[];

/** Spawn markers: defenders green; enemies red (in Survival, the unused spawns are wave entry points). */
function MapPreview({
  mapId,
  mapSeed,
  slots,
  survival,
}: {
  mapId: MapId;
  mapSeed: number;
  slots: number;
  survival: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const m = getMap(mapId, mapSeed);
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = m.width;
    tmp.height = m.height;
    const t = tmp.getContext('2d')!;
    const img = t.createImageData(m.width, m.height);
    m.tiles.forEach((k, i) => {
      const col = TILE_COLORS[k];
      img.data.set([(col >> 16) & 255, (col >> 8) & 255, col & 255, 255], i * 4);
    });
    t.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const k = c.width / (m.width * Math.SQRT2);
    ctx.translate(c.width / 2, 0);
    ctx.scale(1, 0.5);
    ctx.rotate(Math.PI / 4);
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0);
    m.spawns.forEach((s, i) => {
      if (!survival && i >= slots) return;
      ctx.fillStyle = (survival ? i < slots : i === 0) ? '#9cf06a' : '#e04848';
      ctx.fillRect(s.tx - 1, s.ty - 1, 5, 5);
    });
  }, [mapId, mapSeed, slots, survival]);
  return <canvas ref={ref} width={360} height={180} className="w-full" />;
}

interface AiSlot {
  faction: FactionId;
  difficulty: Difficulty;
  personality: Personality;
  team: number;
}

interface SavedSetup {
  mapId: MapId;
  mission: MissionType;
  credits: number;
  name: string;
  faction: FactionId;
  ais: AiSlot[];
  waveDifficulty: Difficulty;
  waves: number;
  unitCap: number;
  mapSeed: number;
  /** Army colour; 0 = faction colour. */
  color: number;
}

const SETUP_KEY = 'shadow-front.skirmish';
const DEFAULT_SETUP: SavedSetup = {
  mapId: 'desert-storm',
  mission: 'annihilation',
  credits: 5000,
  name: 'Commander',
  faction: 'western',
  ais: [{ faction: 'eastern', difficulty: 'normal', personality: 'warlord', team: 1 }],
  waveDifficulty: 'normal',
  waves: SURVIVAL.defaultWaves,
  unitCap: DEFAULT_UNIT_CAP,
  mapSeed: 1,
  color: 0,
};

/** Last used setup (per browser). Invalid or missing data falls back to defaults. */
function loadSetup(): SavedSetup {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return DEFAULT_SETUP;
    const s = { ...DEFAULT_SETUP, ...(JSON.parse(raw) as Partial<SavedSetup>) };
    const ok =
      MAP_IDS.includes(s.mapId) &&
      FACTION_IDS.includes(s.faction) &&
      Array.isArray(s.ais) &&
      DIFFICULTIES.includes(s.waveDifficulty) &&
      (SURVIVAL.waveOptions as readonly number[]).includes(s.waves) &&
      (UNIT_CAP_OPTIONS as readonly number[]).includes(s.unitCap) &&
      s.ais.every(
        (a) =>
          FACTION_IDS.includes(a.faction) &&
          DIFFICULTIES.includes(a.difficulty) &&
          PERSONALITY_IDS.includes(a.personality),
      );
    return ok ? s : DEFAULT_SETUP;
  } catch {
    return DEFAULT_SETUP;
  }
}

function saveSetup(s: SavedSetup): void {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable — setup simply is not remembered.
  }
}

export function SkirmishSetup() {
  const { go, startMatch, profile } = useApp();
  const [initial] = useState(() => {
    const s = loadSetup();
    // The profile nickname is the default commander name.
    return s.name === DEFAULT_SETUP.name ? { ...s, name: profile.nickname } : s;
  });
  const [mapId, setMapId] = useState<MapId>(initial.mapId);
  const [mission, setMission] = useState<MissionType>(initial.mission);
  const [credits, setCredits] = useState(initial.credits);
  const [name, setName] = useState(initial.name);
  const [faction, setFaction] = useState<FactionId>(initial.faction);
  const [ais, setAis] = useState<AiSlot[]>(initial.ais);
  const [waveDifficulty, setWaveDifficulty] = useState<Difficulty>(initial.waveDifficulty);
  const [waves, setWaves] = useState(initial.waves);
  const [unitCap, setUnitCap] = useState(initial.unitCap);
  const [color, setColor] = useState(Number.isFinite(initial.color) ? initial.color : 0);
  const [mapSeed, setMapSeed] = useState(Number.isFinite(initial.mapSeed) ? initial.mapSeed : 1);
  const map = getMap(mapId, mapSeed);
  const survival = mission === 'survival';
  // Survival keeps at least one spawn free as a wave entry point; every AI is an ally.
  const maxAi = map.spawns.length - (survival ? 2 : 1);
  const teams = new Set([0, ...ais.map((a) => a.team)]);
  const valid = survival ? ais.length <= maxAi : teams.size >= 2;

  const update = (i: number, patch: Partial<AiSlot>) =>
    setAis(ais.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const start = () => {
    const slots: MatchSlot[] = [
      { kind: 'human', name: name.trim() || 'Commander', faction, team: 0, color: color || undefined },
      ...ais.map((a, i) => ({
        kind: 'ai' as const,
        name: `${PERSONALITIES[a.personality].name} ${i + 1}`,
        faction: a.faction,
        team: survival ? 0 : a.team,
        difficulty: a.difficulty,
        personality: a.personality,
      })),
    ];
    saveSetup({
      mapId,
      mission,
      credits,
      name,
      faction,
      ais,
      waveDifficulty,
      waves,
      unitCap,
      mapSeed,
      color,
    });
    startMatch({
      mapId,
      mission,
      startingCredits: credits,
      seed: Math.floor(Math.random() * 1e9),
      slots,
      survival: survival ? { difficulty: waveDifficulty, waves } : undefined,
      unitCap,
      mapSeed: mapId === 'random' ? mapSeed : undefined,
    });
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)] p-6">
      <div className="panel flex max-h-full w-[1120px] max-w-full flex-col overflow-auto p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <div className="panel-title">Skirmish</div>
            <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">Match Setup</h2>
          </div>
          <button className="btn" onClick={() => go('menu')}>
            ◀ Back
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6">
          <div className="flex flex-col gap-5">
            <section>
              <div className="panel-title mb-2">You</div>
              <div className="flex gap-2">
                <input
                  className="field w-48"
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                />
                <select
                  className="field flex-1"
                  value={faction}
                  onChange={(e) => setFaction(e.target.value as FactionId)}
                >
                  {FACTION_IDS.map((f) => (
                    <option key={f} value={f}>
                      {FACTIONS[f].name} — {FACTIONS[f].style}
                    </option>
                  ))}
                </select>
                <span className="field w-20 text-center text-gray-400">Team 1</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5" data-testid="army-color">
                <span className="mr-1 text-xs text-gray-400">Army colour</span>
                <button
                  title="Faction colour"
                  onClick={() => setColor(0)}
                  className={`h-6 rounded border-2 px-1.5 text-[10px] text-gray-200 ${color === 0 ? 'border-gray-100' : 'border-graphite-600'}`}
                  style={{ background: hex(FACTIONS[faction].color) }}
                >
                  auto
                </button>
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    title={hex(c)}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded border-2 ${color === c ? 'border-gray-100' : 'border-transparent'}`}
                    style={{ background: hex(c) }}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="panel-title mb-2 flex items-center justify-between">
                <span>{survival ? 'AI Allies (optional)' : 'AI Commanders'}</span>
                <button
                  className="btn px-2 py-0.5 text-xs"
                  disabled={ais.length >= maxAi}
                  onClick={() =>
                    setAis([
                      ...ais,
                      {
                        faction: FACTION_IDS[(ais.length + 1) % 5],
                        difficulty: 'normal',
                        personality: 'rush',
                        team: 1,
                      },
                    ])
                  }
                >
                  + Add AI
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {ais.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ background: hex(FACTIONS[a.faction].color) }}
                    />
                    <select
                      className="field w-44"
                      value={a.faction}
                      onChange={(e) => update(i, { faction: e.target.value as FactionId })}
                    >
                      {FACTION_IDS.map((f) => (
                        <option key={f} value={f}>
                          {FACTIONS[f].name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field w-24"
                      value={a.difficulty}
                      onChange={(e) => update(i, { difficulty: e.target.value as Difficulty })}
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d[0].toUpperCase() + d.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field w-28"
                      value={a.personality}
                      title={PERSONALITIES[a.personality].description}
                      onChange={(e) => update(i, { personality: e.target.value as Personality })}
                    >
                      {PERSONALITY_IDS.map((p) => (
                        <option key={p} value={p}>
                          {PERSONALITIES[p].name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field w-24"
                      value={survival ? 0 : a.team}
                      disabled={survival}
                      onChange={(e) => update(i, { team: Number(e.target.value) })}
                    >
                      <option value={0}>Team 1 (ally)</option>
                      <option value={1}>Team 2</option>
                      <option value={2}>Team 3</option>
                    </select>
                    <button
                      className="btn px-2 py-1 text-xs"
                      disabled={!survival && ais.length <= 1}
                      onClick={() => setAis(ais.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                AI commanders follow the same economy rules as you and only see what their units see.
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div>
                <div className="panel-title mb-2">Mission</div>
                <select
                  className="field w-full"
                  value={mission}
                  onChange={(e) => setMission(e.target.value as MissionType)}
                >
                  <option value="annihilation">Annihilation — destroy all enemy forces</option>
                  <option value="decapitation">Decapitation — destroy enemy HQ</option>
                  <option value="ctf">Capture the Flag — bring the enemy flag home, first to 3</option>
                  <option value="domination">Domination — hold points to score, first to 1500</option>
                  <option value="survival">Survival — hold out against enemy waves</option>
                </select>
              </div>
              <div>
                <div className="panel-title mb-2">Starting credits</div>
                <select
                  className="field w-full"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                >
                  {[3000, 5000, 8000, 12000].map((c) => (
                    <option key={c} value={c}>
                      {c.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="panel-title mb-2">Unit limit</div>
                <select
                  className="field w-full"
                  value={unitCap}
                  title="Population per commander: infantry 1, light vehicles 2, tanks/artillery/helicopters 3, heavy tanks 4"
                  onChange={(e) => setUnitCap(Number(e.target.value))}
                >
                  {UNIT_CAP_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c ? `${c} population` : 'Unlimited'}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {survival && (
              <section className="grid grid-cols-2 gap-4">
                <div>
                  <div className="panel-title mb-2">Wave strength</div>
                  <select
                    className="field w-full"
                    value={waveDifficulty}
                    onChange={(e) => setWaveDifficulty(e.target.value as Difficulty)}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d[0].toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="panel-title mb-2">Waves</div>
                  <select
                    className="field w-full"
                    value={waves}
                    onChange={(e) => setWaves(Number(e.target.value))}
                  >
                    {SURVIVAL.waveOptions.map((n) => (
                      <option key={n} value={n}>
                        {n} waves
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 text-xs text-gray-500">
                  First wave after 3:00, then one every 1:30, each larger than the last; every 5th wave is
                  heavy. Waves enter from the unused spawns (red on the map) and are announced 20 s in
                  advance.
                </div>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="panel-title">Map</div>
            <div className="grid grid-cols-2 gap-2">
              {MAP_IDS.map((id) => (
                <button
                  key={id}
                  className={`btn ${mapId === id ? 'btn-primary' : ''}`}
                  onClick={() => setMapId(id)}
                >
                  {id === 'random' ? '🎲 Random' : getMap(id).name}
                </button>
              ))}
            </div>
            {mapId === 'random' && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{map.name}</span>
                <button
                  className="btn px-2 py-0.5 text-xs"
                  onClick={() => setMapSeed(1 + Math.floor(Math.random() * 999999))}
                >
                  🎲 New map
                </button>
              </div>
            )}
            <div className="rounded border border-graphite-600 bg-graphite-950 p-2">
              <MapPreview mapId={mapId} mapSeed={mapSeed} slots={ais.length + 1} survival={survival} />
            </div>
            <div className="text-sm text-gray-400">{map.description}</div>
            <div className="text-xs text-gray-500">
              {map.width}×{map.height} tiles · up to {map.spawns.length} commanders
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {!valid && (
            <span className="text-sm text-warn-400">
              {survival
                ? `Survival on this map allows at most ${maxAi} AI allies.`
                : 'At least one AI must be on an enemy team.'}
            </span>
          )}
          <button className="btn btn-primary px-8 py-2 text-base" disabled={!valid} onClick={start}>
            Deploy ▶
          </button>
        </div>
      </div>
    </div>
  );
}
