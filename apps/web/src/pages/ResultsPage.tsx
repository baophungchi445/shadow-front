import { FACTIONS } from '@shadow-front/game-data';
import type { FactionId } from '@shadow-front/shared-types';
import { useApp } from '../stores/appStore';
import { hex } from '../components/Icon';

export function ResultsPage() {
  const { result, match, go, startMatch } = useApp();
  if (!result) return null;
  const mins = Math.floor(result.durationSec / 60);
  const secs = String(result.durationSec % 60).padStart(2, '0');
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)]">
      <div className="panel w-[820px] p-6">
        <div
          className={`font-display text-6xl font-bold tracking-[0.3em] ${result.victory ? 'text-mil-400' : 'text-alert-500'}`}
        >
          {result.waves ? (result.victory ? 'SURVIVED' : 'OVERRUN') : result.victory ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div className="mb-5 text-sm text-gray-400">
          {result.mapName} · {mins}:{secs}
          {result.waves && (
            <span>
              {' '}
              · Survival:{' '}
              {result.victory
                ? `all ${result.waves.total} waves repelled`
                : `fell during wave ${result.waves.reached}/${result.waves.total}`}
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-gray-500">
              <th className="py-1">Commander</th>
              <th>Faction</th>
              <th>Team</th>
              <th className="text-right">Units built</th>
              <th className="text-right">Lost</th>
              <th className="text-right">Kills</th>
              <th className="text-right">Buildings</th>
              <th className="text-right">Credits earned</th>
            </tr>
          </thead>
          <tbody>
            {result.players.map((p, i) => (
              <tr key={i} className="border-t border-graphite-700 tabular-nums">
                <td className="py-1.5">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: hex(p.color) }}
                  />
                  {p.name}
                  {p.isAI ? <span className="ml-1 text-xs text-gray-500">AI</span> : null}
                  {p.defeated ? <span className="ml-2 text-xs text-alert-500">eliminated</span> : null}
                </td>
                <td className="text-gray-400">{FACTIONS[p.faction as FactionId].name}</td>
                <td className="text-gray-400">{p.raider ? 'Enemy' : p.team + 1}</td>
                <td className="text-right">{p.stats.unitsBuilt}</td>
                <td className="text-right">{p.stats.unitsLost}</td>
                <td className="text-right">{p.stats.kills}</td>
                <td className="text-right">{p.stats.buildingsBuilt}</td>
                <td className="text-right">{Math.round(p.stats.creditsEarned).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn" onClick={() => go('menu')}>
            Main menu
          </button>
          <button className="btn" onClick={() => go('skirmish')}>
            New skirmish
          </button>
          {match && (
            <button
              className="btn btn-primary"
              onClick={() => startMatch({ ...match, seed: match.seed + 1 })}
            >
              Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
