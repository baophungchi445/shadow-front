import { FACTIONS } from '@shadow-front/game-data';
import { CAMPAIGN, getMission } from '@shadow-front/game-core';
import type { FactionId } from '@shadow-front/shared-types';
import { useApp } from '../stores/appStore';
import { hex } from '../components/Icon';

export function ResultsPage() {
  const { result, match, go, startMatch, lastProgress } = useApp();
  if (!result) return null;
  const mission = getMission(result.campaignMission ?? undefined);
  const next = mission ? CAMPAIGN[CAMPAIGN.indexOf(mission) + 1] : undefined;
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
        {mission && (
          <div className="font-display text-lg font-semibold tracking-widest text-gray-200">
            {mission.title} — {result.victory ? 'mission complete' : 'mission failed'}
          </div>
        )}
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
        {lastProgress && (
          <div
            className="mb-4 rounded border border-graphite-600 bg-graphite-900/60 p-3"
            data-testid="progress"
          >
            <div className="flex items-center gap-4 text-sm">
              <span className="font-display text-lg font-bold text-warn-400">
                +{lastProgress.xpGained} XP
              </span>
              {lastProgress.levelAfter > lastProgress.levelBefore ? (
                <span className="font-display font-bold text-mil-400">
                  ▲ Level up! {lastProgress.levelBefore} → {lastProgress.levelAfter}
                </span>
              ) : (
                <span className="text-gray-400">Level {lastProgress.levelAfter}</span>
              )}
            </div>
            {lastProgress.challenges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" data-testid="challenges-done">
                {lastProgress.challenges.map((c) => (
                  <span
                    key={c.title}
                    className="rounded border border-mil-600/60 bg-mil-700/20 px-2 py-0.5 text-xs text-mil-300"
                  >
                    ✔ {c.period === 'daily' ? 'Daily' : 'Weekly'}: {c.title} (+{c.reward} XP)
                  </span>
                ))}
              </div>
            )}
            {lastProgress.newTitles.length > 0 && (
              <div className="mt-2 text-xs text-warn-400">New title: {lastProgress.newTitles.join(', ')}</div>
            )}
            {lastProgress.unlocked.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {lastProgress.unlocked.map((a) => (
                  <span
                    key={a.id}
                    title={a.description}
                    className="rounded border border-warn-500/60 bg-warn-500/10 px-2 py-0.5 text-xs text-warn-400"
                  >
                    🏆 {a.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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
          {mission ? (
            <button className="btn" onClick={() => go('campaign')}>
              Campaign
            </button>
          ) : (
            <button className="btn" onClick={() => go('skirmish')}>
              New skirmish
            </button>
          )}
          {match && (
            <button
              className={`btn ${mission && result.victory && next ? '' : 'btn-primary'}`}
              onClick={() => startMatch({ ...match, seed: match.seed + 1 })}
            >
              {mission ? 'Retry mission' : 'Rematch'}
            </button>
          )}
          {mission && result.victory && next && match && (
            <button
              className="btn btn-primary"
              onClick={() => startMatch(next.config(match.slots[0].name, match.seed + 1))}
            >
              Next mission ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
