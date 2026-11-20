import { useState } from 'react';
import type { FactionId } from '@shadow-front/shared-types';
import {
  ACHIEVEMENTS,
  TITLES,
  MASTERY_MAX,
  activeChallenges,
  currentChallenges,
  levelInfo,
  masteryInfo,
  unitMasteryInfo,
  AVATAR_COLORS,
  AVATAR_ICONS,
  UNIT_MASTERY_MAX,
} from '@shadow-front/game-core';
import type { UnitTypeId } from '@shadow-front/shared-types';
import { FACTIONS, FACTION_IDS, UNITS, UNIT_IDS } from '@shadow-front/game-data';
import { useApp } from '../stores/appStore';
import { Icon, hex } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { useT } from '../i18n';

const MISSION_LABEL: Record<string, string> = {
  annihilation: 'Annihilation',
  decapitation: 'Decapitation',
  survival: 'Survival',
  tutorial: 'Tutorial',
  domination: 'Domination',
  ctf: 'Capture the Flag',
};

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

/** Offline player profile: nickname, emblem, level, statistics, achievements and match history. */
export function ProfilePage() {
  const { go, profile, updateProfile, resetProfile } = useApp();
  const [name, setName] = useState(profile.nickname);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = useT();
  const tr = t;
  const lvl = levelInfo(profile.xp);
  const st = profile.stats;
  const ch = currentChallenges(profile.challenges, Date.now());
  const periods = [
    { label: 'Daily', list: activeChallenges('daily', ch.day) },
    { label: 'Weekly', list: activeChallenges('weekly', ch.week) },
  ];
  const winRate = st.matches ? Math.round((st.wins / st.matches) * 100) : 0;
  const stats: [string, string | number][] = [
    ['Matches', st.matches],
    ['Wins', st.wins],
    ['Losses', st.losses],
    ['Win rate', `${winRate}%`],
    ['Enemies destroyed', st.kills],
    ['Units built', st.unitsBuilt],
    ['Units lost', st.unitsLost],
    ['Credits earned', st.creditsEarned.toLocaleString()],
    ['Time played', fmtDuration(st.playTimeSec)],
  ];

  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a2118_0%,#0b0e11_70%)] p-6">
      <div className="panel flex max-h-full w-[1100px] max-w-full flex-col overflow-auto p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div className="flex items-center gap-3">
            <Avatar icon={profile.avatar.icon} color={profile.avatar.color} size={52} />
            <div>
              <div className="panel-title">{t('Profile (saved in this browser)')}</div>
              <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">
                {profile.nickname}
              </h2>
            </div>
          </div>
          <button className="btn" onClick={() => go('menu')}>
            {t('◀ Back')}
          </button>
        </div>

        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4">
            <section>
              <div className="panel-title mb-1">{t('Nickname')}</div>
              <div className="flex gap-2">
                <input
                  className="field flex-1"
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="nickname"
                />
                <button
                  className="btn"
                  disabled={!name.trim() || name.trim() === profile.nickname}
                  onClick={() => updateProfile({ nickname: name.trim() })}
                >
                  {t('Save')}
                </button>
              </div>
            </section>
            <section data-testid="avatar-picker">
              <div className="panel-title mb-1">{t('Avatar')}</div>
              <div className="flex flex-wrap gap-1.5">
                {AVATAR_ICONS.map((i) => (
                  <button
                    key={i}
                    title={i}
                    data-icon={i}
                    onClick={() => updateProfile({ avatar: { ...profile.avatar, icon: i } })}
                    className={`rounded-full border-2 ${profile.avatar.icon === i ? 'border-warn-400' : 'border-transparent'}`}
                  >
                    <Avatar icon={i} color={profile.avatar.color} size={30} />
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    data-color={c}
                    onClick={() => updateProfile({ avatar: { ...profile.avatar, color: c } })}
                    className={`h-5 w-5 rounded-full border-2 ${profile.avatar.color === c ? 'border-gray-100' : 'border-transparent'}`}
                    style={{ background: hex(c) }}
                  />
                ))}
              </div>
            </section>
            <section>
              <div className="panel-title mb-1">{t('Emblem')}</div>
              <div className="flex gap-2">
                {FACTION_IDS.map((f: FactionId) => (
                  <button
                    key={f}
                    title={t(FACTIONS[f].name)}
                    onClick={() => updateProfile({ emblem: f })}
                    className={`h-8 w-8 rounded border-2 ${profile.emblem === f ? 'border-gray-100' : 'border-transparent'}`}
                    style={{ background: hex(FACTIONS[f].color) }}
                  />
                ))}
              </div>
              <div className="mt-1 text-xs text-gray-500">{t(FACTIONS[profile.emblem].name)}</div>
            </section>
            <section>
              <div className="panel-title mb-1">{t('Title')}</div>
              <select
                className="field w-full"
                value={
                  TITLES.find((t) => t.id === profile.title && t.unlocked(profile))
                    ? profile.title
                    : 'recruit'
                }
                onChange={(e) => updateProfile({ title: e.target.value })}
                data-testid="title"
              >
                {TITLES.map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.unlocked(profile)}>
                    {tr(t.name)}
                    {t.unlocked(profile) ? '' : ` — 🔒 ${tr(t.requirement)}`}
                  </option>
                ))}
              </select>
            </section>
            <section>
              <div className="panel-title mb-1">{t('Level')}</div>
              <div className="font-display text-4xl font-bold text-mil-400">{lvl.level}</div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-graphite-700">
                <div className="h-full bg-mil-500" style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
              </div>
              <div className="mt-1 text-xs tabular-nums text-gray-400">
                {t('{into} / {needed} XP to level {next} · {total} XP total', {
                  into: lvl.into,
                  needed: lvl.needed,
                  next: lvl.level + 1,
                  total: profile.xp,
                })}
              </div>
            </section>
            <section>
              <div className="panel-title mb-1">{t('Statistics')}</div>
              <table className="w-full text-sm">
                <tbody>
                  {stats.map(([k, v]) => (
                    <tr key={k} className="border-t border-graphite-800">
                      <td className="py-0.5 text-gray-400">{t(k)}</td>
                      <td className="text-right tabular-nums text-gray-100">{v}</td>
                    </tr>
                  ))}
                  {FACTION_IDS.map((f) => (
                    <tr key={f} className="border-t border-graphite-800">
                      <td className="py-0.5 text-gray-500">
                        {t('Wins · {faction}', { faction: t(FACTIONS[f].name) })}
                      </td>
                      <td className="text-right tabular-nums text-gray-300">{st.factionWins[f] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              {confirmReset ? (
                <div className="flex items-center gap-2 text-xs text-warn-400">
                  {t('Erase level, stats, history and achievements?')}
                  <button
                    className="btn px-2 py-0.5 text-xs"
                    onClick={() => {
                      resetProfile();
                      setConfirmReset(false);
                    }}
                  >
                    {t('Yes, reset')}
                  </button>
                  <button className="btn px-2 py-0.5 text-xs" onClick={() => setConfirmReset(false)}>
                    {t('Cancel')}
                  </button>
                </div>
              ) : (
                <button className="btn px-2 py-0.5 text-xs" onClick={() => setConfirmReset(true)}>
                  {t('Reset progress…')}
                </button>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section data-testid="mastery">
              <div className="panel-title mb-2">{t('Faction mastery')}</div>
              <div className="grid grid-cols-5 gap-2">
                {FACTION_IDS.map((f) => {
                  const m = masteryInfo(profile.mastery[f] ?? 0);
                  return (
                    <div
                      key={f}
                      className="rounded border border-graphite-700 p-1.5"
                      title={t(FACTIONS[f].name)}
                    >
                      <div className="flex items-center gap-1 text-[11px] text-gray-300">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: hex(FACTIONS[f].color) }}
                        />
                        <span className="truncate">{t(FACTIONS[f].name)}</span>
                      </div>
                      <div className="font-display text-lg font-bold text-gray-100">
                        {m.level >= MASTERY_MAX ? 'MAX' : `Lv ${m.level}`}
                      </div>
                      <div className="h-1 overflow-hidden rounded bg-graphite-700">
                        <div
                          className="h-full bg-mil-500"
                          style={{ width: `${(m.into / m.needed) * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] tabular-nums text-gray-500">
                        {m.level >= MASTERY_MAX ? t('mastered') : `${m.into} / ${m.needed} XP`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section data-testid="unit-mastery">
              <div className="panel-title mb-2">{t('Unit mastery')}</div>
              {(() => {
                const rows = UNIT_IDS.map((u: UnitTypeId) => ({
                  u,
                  r: profile.unitMastery[u],
                  m: unitMasteryInfo(profile.unitMastery[u]),
                }))
                  .filter((x) => x.m.points > 0)
                  .sort((a, b) => b.m.points - a.m.points);
                if (!rows.length)
                  return (
                    <div className="text-xs text-gray-500">
                      {t('Build units and destroy enemies with them to gain unit mastery.')}
                    </div>
                  );
                return (
                  <div className="grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
                    {rows.map(({ u, r, m }) => (
                      <div
                        key={u}
                        className="flex items-center gap-1.5 rounded border border-graphite-700 p-1"
                        title={t('{built} built · {kills} kills · {points} points', {
                          built: r?.built ?? 0,
                          kills: r?.kills ?? 0,
                          points: m.points,
                        })}
                      >
                        <Icon id={u} className="h-6 w-6 shrink-0 text-mil-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] text-gray-300">{t(UNITS[u].name)}</div>
                          <div className="text-[10px] text-warn-400">
                            {'★'.repeat(m.level)}
                            <span className="text-graphite-600">
                              {'★'.repeat(UNIT_MASTERY_MAX - m.level)}
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded bg-graphite-700">
                            <div
                              className="h-full bg-mil-500"
                              style={{ width: `${(m.into / m.needed) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
            <section data-testid="challenges">
              <div className="panel-title mb-2">{t('Challenges')}</div>
              <div className="grid grid-cols-2 gap-3">
                {periods.map(({ label, list }) => (
                  <div key={label}>
                    <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">
                      {t(
                        label === 'Daily'
                          ? '{period} · resets every day (UTC)'
                          : '{period} · resets every Monday (UTC)',
                        { period: t(label) },
                      )}
                    </div>
                    {list.map((c) => {
                      const done = ch.done.includes(c.id);
                      const prog = Math.min(c.goal, ch.progress[c.id] ?? 0);
                      return (
                        <div key={c.id} className="mb-1.5 rounded border border-graphite-700 p-1.5">
                          <div className="flex justify-between text-xs">
                            <span className={done ? 'text-mil-400' : 'text-gray-200'}>
                              {done ? '✔ ' : ''}
                              {t(c.title)}
                            </span>
                            <span className="text-warn-400">+{c.reward} XP</span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded bg-graphite-700">
                            <div
                              className={`h-full ${done ? 'bg-mil-500' : 'bg-warn-500'}`}
                              style={{ width: `${(done ? 1 : prog / c.goal) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] tabular-nums text-gray-500">
                            {done ? t('complete') : `${prog} / ${c.goal}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="panel-title mb-2">
                {t('Achievements · {n}/{total}', {
                  n: Object.keys(profile.achievements).length,
                  total: ACHIEVEMENTS.length,
                })}
              </div>
              <div className="grid grid-cols-3 gap-2" data-testid="achievements">
                {ACHIEVEMENTS.map((a) => {
                  const at = profile.achievements[a.id];
                  return (
                    <div
                      key={a.id}
                      className={`rounded border p-2 ${at ? 'border-warn-500/60 bg-warn-500/10' : 'border-graphite-700 opacity-50'}`}
                    >
                      <div className="text-sm font-semibold text-gray-100">
                        {at ? '🏆' : '🔒'} {t(a.title)}
                      </div>
                      <div className="text-[11px] text-gray-400">{t(a.description)}</div>
                      {at && (
                        <div className="text-[10px] text-gray-500">{new Date(at).toLocaleDateString()}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="panel-title mb-2">{t('Recent matches')}</div>
              {profile.history.length === 0 ? (
                <div className="text-sm text-gray-500">{t('No matches yet.')}</div>
              ) : (
                <table className="w-full text-sm" data-testid="history">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-gray-500">
                      <th className="py-1">{t('Result')}</th>
                      <th>{t('Mode')}</th>
                      <th>{t('Map')}</th>
                      <th>{t('Faction')}</th>
                      <th className="text-right">{t('Time')}</th>
                      <th className="text-right">{t('Kills')}</th>
                      <th className="text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.history.map((h) => (
                      <tr key={h.at} className="border-t border-graphite-800 tabular-nums">
                        <td className={`py-1 font-semibold ${h.victory ? 'text-mil-400' : 'text-alert-500'}`}>
                          {t(h.victory ? 'Victory' : 'Defeat')}
                        </td>
                        <td className="text-gray-300">{t(MISSION_LABEL[h.mission] ?? h.mission)}</td>
                        <td className="text-gray-300">{h.mapName}</td>
                        <td className="text-gray-400">{t(FACTIONS[h.faction].name)}</td>
                        <td className="text-right text-gray-300">{fmtDuration(h.durationSec)}</td>
                        <td className="text-right text-gray-300">{h.kills}</td>
                        <td className="text-right text-warn-400">+{h.xp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
