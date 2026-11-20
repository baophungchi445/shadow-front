import { useState } from 'react';
import { CAMPAIGN, missionUnlocked } from '@shadow-front/game-core';
import { getMap } from '@shadow-front/game-data';
import { useApp } from '../stores/appStore';
import { useT } from '../i18n';

export function CampaignPage() {
  const { go, startMatch, completedMissions, profile } = useApp();
  const t = useT();
  const firstOpen = CAMPAIGN.find((m) => !completedMissions.includes(m.id)) ?? CAMPAIGN[0];
  const [selected, setSelected] = useState(firstOpen.id);
  const mission = CAMPAIGN.find((m) => m.id === selected) ?? CAMPAIGN[0];
  const unlocked = missionUnlocked(mission.id, completedMissions);
  const cfg = mission.config('Commander', 1);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)] p-6">
      <div className="panel flex max-h-full w-[980px] max-w-full flex-col overflow-auto p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <div className="panel-title">{t('Campaign')}</div>
            <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">{t('Operations')}</h2>
          </div>
          <button className="btn" onClick={() => go('menu')}>
            {t('◀ Back')}
          </button>
        </div>

        <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-6">
          <ol className="flex flex-col gap-2">
            {CAMPAIGN.map((m, i) => {
              const done = completedMissions.includes(m.id);
              const open = missionUnlocked(m.id, completedMissions);
              return (
                <li key={m.id}>
                  <button
                    className={`w-full rounded border px-3 py-2 text-left transition-colors ${
                      selected === m.id
                        ? 'border-mil-500 bg-mil-700/30'
                        : 'border-graphite-600 bg-graphite-900/80 hover:border-mil-600'
                    } ${open ? '' : 'opacity-50'}`}
                    onClick={() => setSelected(m.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-base font-bold tracking-wider text-gray-100">
                        {i + 1}. {t(m.title)}
                      </span>
                      <span className="text-xs">
                        {done ? (
                          <span className="text-mil-400">{t('✓ complete')}</span>
                        ) : open ? (
                          <span className="text-warn-400">{t('available')}</span>
                        ) : (
                          <span className="text-gray-500">{t('🔒 locked')}</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">{t(m.subtitle)}</div>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col gap-3">
            <div className="font-display text-2xl font-bold tracking-wider text-gray-100">
              {t(mission.title)}
            </div>
            <div className="text-xs uppercase tracking-widest text-gray-500">
              {t('{map} · {credits} credits', {
                map: getMap(cfg.mapId).name,
                credits: cfg.startingCredits.toLocaleString(),
              })}
              {cfg.unitCap ? t(' · unit limit {n}', { n: cfg.unitCap }) : ''}
            </div>
            <p className="text-sm leading-relaxed text-gray-300">{t(mission.briefing)}</p>
            <div>
              <div className="panel-title mb-1">{t('Objectives')}</div>
              <ul className="space-y-1 text-sm text-gray-300">
                {mission.objectives.map((o) => (
                  <li key={o.id}>· {t(o.title)}</li>
                ))}
              </ul>
            </div>
            <div className="mt-auto flex items-center justify-end gap-3 pt-4">
              {!unlocked && (
                <span className="text-sm text-warn-400">{t('Complete the previous mission to unlock.')}</span>
              )}
              <button
                className="btn btn-primary px-8 py-2 text-base"
                disabled={!unlocked}
                onClick={() => startMatch(mission.config(profile.nickname, Math.floor(Math.random() * 1e9)))}
              >
                {t('Start mission ▶')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
