import type { HudSnapshot } from '../../game/hudModel';
import { GAME_SPEEDS } from '../../game/GameController';
import { useT } from '../../i18n';

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function TopBar({
  hud,
  onMenu,
  onSpeed,
}: {
  hud: HudSnapshot;
  onMenu: () => void;
  onSpeed: (s: number) => void;
}) {
  const t = useT();
  const low = hud.powerUsed > hud.powerProduced;
  const ratio = hud.powerProduced ? Math.min(1, hud.powerUsed / hud.powerProduced) : 1;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-2">
      <div className="panel pointer-events-auto flex items-center gap-4 px-3 py-1.5">
        <div className="font-display text-lg font-bold tracking-[0.2em] text-gray-100">
          SHADOW<span className="text-mil-500"> FRONT</span>
        </div>
        <div className="h-6 w-px bg-graphite-600" />
        <div className="flex items-center gap-2" title={t('Credits')}>
          <span className="text-warn-400">◆</span>
          <span className="font-display text-lg font-semibold tabular-nums text-gray-100">
            {hud.credits.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2" title={t('Power used / produced')}>
          <span className={low ? 'text-alert-500' : 'text-mil-400'}>⚡</span>
          <div className="h-2 w-20 overflow-hidden rounded bg-graphite-700">
            <div
              className={`h-full ${low ? 'bg-alert-500' : ratio > 0.85 ? 'bg-warn-500' : 'bg-mil-500'}`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <span className={`font-display text-sm tabular-nums ${low ? 'text-alert-500' : 'text-gray-300'}`}>
            {hud.powerUsed}/{hud.powerProduced}
          </span>
          {low && (
            <span className="font-display text-xs font-bold uppercase text-alert-500">{t('Low power')}</span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5"
          title={t('Population used / limit (queued units included)')}
          data-testid="supply"
        >
          <span className="text-gray-400">👥</span>
          <span
            className={`font-display text-sm tabular-nums ${
              hud.supply.cap && hud.supply.used >= hud.supply.cap ? 'text-alert-500' : 'text-gray-300'
            }`}
          >
            {hud.supply.used}
            {hud.supply.cap ? `/${hud.supply.cap}` : ''}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          title={t('Strategic points held by your team (+6 credits/s each)')}
        >
          <span className="text-sky-400">⚑</span>
          <span className="font-display text-sm tabular-nums text-gray-300">
            {hud.points.owned}/{hud.points.total}
          </span>
        </div>
      </div>

      <div className="panel pointer-events-auto px-4 py-1 text-center">
        <div className="font-display text-xl font-semibold tabular-nums text-gray-100">
          {fmtTime(hud.time)}
        </div>
        {hud.ctf ? (
          <div className="text-[11px] uppercase tracking-widest text-gray-400" data-testid="ctf">
            {t('Capture the flag')} ·{' '}
            <span className="font-semibold text-mil-400">{t('You {n}', { n: hud.ctf.mine })}</span> ·{' '}
            <span className="font-semibold text-alert-500">{t('Enemy {n}', { n: hud.ctf.enemy })}</span> /{' '}
            {hud.ctf.target} ·{' '}
            <span className={hud.ctf.ownFlag === 'home' ? 'text-gray-300' : 'font-semibold text-alert-500'}>
              {t('our flag {state}', { state: t(hud.ctf.ownFlag) })}
            </span>
          </div>
        ) : hud.domination ? (
          <div className="text-[11px] uppercase tracking-widest text-gray-400" data-testid="domination">
            {t('Domination')} ·{' '}
            <span className="font-semibold text-mil-400">{t('You {n}', { n: hud.domination.mine })}</span> ·{' '}
            <span className="font-semibold text-alert-500">
              {t('Enemy {n}', { n: hud.domination.enemy })}
            </span>{' '}
            / {hud.domination.target}
          </div>
        ) : hud.survival ? (
          <div className="text-[11px] uppercase tracking-widest text-gray-400" data-testid="wave-status">
            <span className="font-semibold text-warn-400">
              {t('Wave {a}/{b}', { a: hud.survival.wave, b: hud.survival.total })}
            </span>
            {hud.survival.nextIn !== null ? (
              <span className={hud.survival.nextIn <= 20 ? ' text-alert-500' : ''}>
                {t(' · next in {t}', { t: fmtTime(hud.survival.nextIn) })}
              </span>
            ) : (
              <span>{t(' · final wave')}</span>
            )}
            {hud.survival.hostiles > 0 && <span>{t(' · {n} hostiles', { n: hud.survival.hostiles })}</span>}
          </div>
        ) : (
          <div className="text-[11px] uppercase tracking-widest text-gray-400">
            {t(
              hud.mission === 'tutorial'
                ? 'Tutorial: follow the objectives'
                : hud.mission === 'decapitation'
                  ? 'Objective: destroy enemy HQ'
                  : 'Objective: destroy all enemy forces',
            )}
          </div>
        )}
      </div>

      <div className="pointer-events-auto flex gap-2">
        {(hud.conditions.weather !== 'clear' || hud.conditions.dayTime !== 'day') && (
          <div
            className="panel flex items-center gap-1 px-2 text-sm text-gray-300"
            data-testid="conditions"
            title={t('Vision {n}% of normal', { n: Math.round(hud.conditions.vision * 100) })}
          >
            <span>{hud.conditions.daylight > 0.5 ? '☀' : '☾'}</span>
            {hud.conditions.weather !== 'clear' && (
              <span>{{ rain: '🌧', snow: '❄', sandstorm: '🌪' }[hud.conditions.weather] ?? ''}</span>
            )}
            <span className="text-[11px] uppercase tracking-widest text-gray-400">
              {t(hud.conditions.phase[0].toUpperCase() + hud.conditions.phase.slice(1))}
            </span>
          </div>
        )}
        <div className="panel flex items-center gap-0.5 p-0.5" title={t('Game speed (- / =)')}>
          {GAME_SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className={`rounded px-2 py-1 font-display text-sm font-semibold tabular-nums transition-colors ${
                hud.speed === s
                  ? 'bg-mil-600 text-white'
                  : 'text-gray-400 hover:bg-graphite-700 hover:text-gray-100'
              }`}
            >
              ×{s}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onMenu} title={t('Menu (P / F10)')}>
          {t('☰ Menu')}
        </button>
      </div>
    </div>
  );
}
