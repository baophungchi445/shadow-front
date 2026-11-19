import {
  BUILDABLE,
  BUILDINGS,
  DAMAGE_TABLE,
  FACTIONS,
  FACTION_IDS,
  TICK_RATE,
  UNITS,
  UNIT_IDS,
} from '@shadow-front/game-data';
import type { ArmorClass, WeaponType } from '@shadow-front/shared-types';
import { useApp } from '../stores/appStore';
import { Icon, hex } from '../components/Icon';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const go = useApp((s) => s.go);
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)] p-6">
      <div className="panel flex max-h-full w-[1040px] flex-col p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">{title}</h2>
          <button className="btn" onClick={() => go('menu')}>
            ◀ Back
          </button>
        </div>
        <div className="min-h-0 overflow-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

/** Codex generated directly from game-data (single source of truth). */
export function ArmyPage() {
  const armors: ArmorClass[] = ['infantry', 'light', 'heavy', 'air', 'building'];
  return (
    <Shell title="Army Codex">
      <div className="panel-title mb-2">Units</div>
      <div className="mb-6 grid grid-cols-3 gap-2">
        {UNIT_IDS.map((id) => {
          const u = UNITS[id];
          return (
            <div key={id} className="flex gap-3 rounded border border-graphite-700 bg-graphite-850 p-2.5">
              <Icon id={id} className="h-10 w-10 shrink-0 text-mil-400" />
              <div className="text-xs text-gray-400">
                <div className="font-display text-base font-semibold text-gray-100">{u.name}</div>
                <div>
                  ◆{u.cost} · {(u.buildTime / TICK_RATE).toFixed(0)}s · HP {u.hp} · {u.armor} armor
                </div>
                <div>
                  {u.weapon ? `${u.weapon.type} ${u.weapon.damage} dmg, range ${u.weapon.range}` : 'Unarmed'}{' '}
                  · from {BUILDINGS[u.producedBy].name}
                </div>
                <div className="mt-1 text-gray-500">{u.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-title mb-2">Buildings</div>
      <div className="mb-6 grid grid-cols-4 gap-2">
        {(['headquarters', ...BUILDABLE] as const).map((id) => {
          const b = BUILDINGS[id];
          return (
            <div key={id} className="flex gap-2 rounded border border-graphite-700 bg-graphite-850 p-2">
              <Icon id={id} className="h-8 w-8 shrink-0 text-mil-400" />
              <div className="text-[11px] text-gray-400">
                <div className="font-display text-sm font-semibold text-gray-100">{b.name}</div>◆{b.cost} ·{' '}
                {b.power > 0 ? '+' : ''}
                {b.power}⚡ · {b.w}×{b.h}
                <div className="text-gray-500">{b.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="panel-title mb-2">Counter table (damage multiplier)</div>
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left">weapon \ armor</th>
                {armors.map((a) => (
                  <th key={a}>{a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(DAMAGE_TABLE) as WeaponType[]).map((w) => (
                <tr key={w} className="border-t border-graphite-700">
                  <td className="py-1 text-gray-300">{w}</td>
                  {armors.map((a) => {
                    const v = DAMAGE_TABLE[w][a];
                    return (
                      <td
                        key={a}
                        className={`text-center ${v >= 1.2 ? 'text-mil-400' : v <= 0.3 ? 'text-alert-500' : 'text-gray-300'}`}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="panel-title mb-2">Factions</div>
          <div className="space-y-1.5">
            {FACTION_IDS.map((f) => {
              const d = FACTIONS[f];
              const m = d.modifiers;
              const mods = [
                m.unitHp !== 1 && `unit HP ×${m.unitHp}`,
                m.buildingHp !== 1 && `building HP ×${m.buildingHp}`,
                m.vehicleSpeed !== 1 && `vehicle speed ×${m.vehicleSpeed}`,
                m.speed !== 1 && `speed ×${m.speed}`,
                m.vision !== 1 && `vision ×${m.vision}`,
                m.airCost !== 1 && `air cost ×${m.airCost}`,
                ...Object.entries(m.damage).map(([k, v]) => `${k} dmg ×${v}`),
              ].filter(Boolean);
              return (
                <div key={f} className="flex items-start gap-2 text-xs">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: hex(d.color) }}
                  />
                  <div>
                    <span className="font-semibold text-gray-100">{d.name}</span>{' '}
                    <span className="text-gray-500">— {d.style}</span>
                    <div className="text-gray-400">{mods.join(' · ')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function VolumeSlider() {
  const { settings, updateSettings } = useApp();
  return (
    <label className="flex items-center justify-between gap-4">
      <span>Sound volume</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings.volume}
        onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
      />
      <span className="w-8 tabular-nums text-gray-400">{Math.round(settings.volume * 100)}</span>
    </label>
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useApp();
  return (
    <Shell title="Settings">
      <div className="max-w-md space-y-4 text-sm">
        <label className="flex items-center justify-between">
          <span>Edge scrolling</span>
          <input
            type="checkbox"
            checked={settings.edgeScroll}
            onChange={(e) => updateSettings({ edgeScroll: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Camera scroll speed</span>
          <input
            type="range"
            min={0.4}
            max={2}
            step={0.1}
            value={settings.scrollSpeed}
            onChange={(e) => updateSettings({ scrollSpeed: Number(e.target.value) })}
          />
          <span className="w-8 tabular-nums text-gray-400">{settings.scrollSpeed.toFixed(1)}</span>
        </label>
        <VolumeSlider />
      </div>
    </Shell>
  );
}

export function MultiplayerPage() {
  return (
    <Shell title="Multiplayer">
      <div className="max-w-2xl space-y-3 text-sm text-gray-300">
        <p>
          Online Co-op (1–5 players vs AI) is scheduled for <b>Phase 6–7</b> of the roadmap. The NestJS +
          Socket.IO lobby server (<code>apps/server</code>) already supports rooms, ready state, faction
          selection and bot slots, but the authoritative match simulation and the in-game network sync are not
          implemented yet.
        </p>
        <p className="text-gray-500">
          This screen intentionally does not fake an online match. Use <b>Play</b> for a full offline skirmish
          against AI commanders, including AI allies on your team.
        </p>
      </div>
    </Shell>
  );
}
