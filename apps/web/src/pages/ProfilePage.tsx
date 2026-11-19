import { useState } from 'react';
import type { FactionId } from '@shadow-front/shared-types';
import {
  ACHIEVEMENTS,
  TITLES,
  activeChallenges,
  currentChallenges,
  levelInfo,
} from '@shadow-front/game-core';
import { FACTIONS, FACTION_IDS } from '@shadow-front/game-data';
import { useApp } from '../stores/appStore';
import { hex } from '../components/Icon';

const MISSION_LABEL: Record<string, string> = {
  annihilation: 'Annihilation',
  decapitation: 'Decapitation',
  survival: 'Survival',
  tutorial: 'Tutorial',
  domination: 'Domination',
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
          <div>
            <div className="panel-title">Profile (saved in this browser)</div>
            <h2 className="font-display text-3xl font-bold tracking-widest text-gray-100">
              {profile.nickname}
            </h2>
          </div>
          <button className="btn" onClick={() => go('menu')}>
            ◀ Back
          </button>
        </div>

        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4">
            <section>
              <div className="panel-title mb-1">Nickname</div>
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
                  Save
                </button>
              </div>
            </section>
            <section>
              <div className="panel-title mb-1">Emblem</div>
              <div className="flex gap-2">
                {FACTION_IDS.map((f: FactionId) => (
                  <button
                    key={f}
                    title={FACTIONS[f].name}
                    onClick={() => updateProfile({ emblem: f })}
                    className={`h-8 w-8 rounded border-2 ${profile.emblem === f ? 'border-gray-100' : 'border-transparent'}`}
                    style={{ background: hex(FACTIONS[f].color) }}
                  />
                ))}
              </div>
              <div className="mt-1 text-xs text-gray-500">{FACTIONS[profile.emblem].name}</div>
            </section>
            <section>
              <div className="panel-title mb-1">Title</div>
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
                    {t.name}
                    {t.unlocked(profile) ? '' : ` — 🔒 ${t.requirement}`}
                  </option>
                ))}
              </select>
            </section>
            <section>
              <div className="panel-title mb-1">Level</div>
              <div className="font-display text-4xl font-bold text-mil-400">{lvl.level}</div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-graphite-700">
                <div className="h-full bg-mil-500" style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
              </div>
              <div className="mt-1 text-xs tabular-nums text-gray-400">
                {lvl.into} / {lvl.needed} XP to level {lvl.level + 1} · {profile.xp} XP total
              </div>
            </section>
            <section>
              <div className="panel-title mb-1">Statistics</div>
              <table className="w-full text-sm">
                <tbody>
                  {stats.map(([k, v]) => (
                    <tr key={k} className="border-t border-graphite-800">
                      <td className="py-0.5 text-gray-400">{k}</td>
                      <td className="text-right tabular-nums text-gray-100">{v}</td>
                    </tr>
                  ))}
                  {FACTION_IDS.map((f) => (
                    <tr key={f} className="border-t border-graphite-800">
                      <td className="py-0.5 text-gray-500">Wins · {FACTIONS[f].name}</td>
                      <td className="text-right tabular-nums text-gray-300">{st.factionWins[f] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              {confirmReset ? (
                <div className="flex items-center gap-2 text-xs text-warn-400">
                  Erase level, stats, history and achievements?
                  <button
                    className="btn px-2 py-0.5 text-xs"
                    onClick={() => {
                      resetProfile();
                      setConfirmReset(false);
                    }}
                  >
                    Yes, reset
                  </button>
                  <button className="btn px-2 py-0.5 text-xs" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="btn px-2 py-0.5 text-xs" onClick={() => setConfirmReset(true)}>
                  Reset progress…
                </button>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section data-testid="challenges">
              <div className="panel-title mb-2">Challenges</div>
              <div className="grid grid-cols-2 gap-3">
                {periods.map(({ label, list }) => (
                  <div key={label}>
                    <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">
                      {label} · resets {label === 'Daily' ? 'every day' : 'every Monday'} (UTC)
                    </div>
                    {list.map((c) => {
                      const done = ch.done.includes(c.id);
                      const prog = Math.min(c.goal, ch.progress[c.id] ?? 0);
                      return (
                        <div key={c.id} className="mb-1.5 rounded border border-graphite-700 p-1.5">
                          <div className="flex justify-between text-xs">
                            <span className={done ? 'text-mil-400' : 'text-gray-200'}>
                              {done ? '✔ ' : ''}
                              {c.title}
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
                            {done ? 'complete' : `${prog} / ${c.goal}`}
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
                Achievements · {Object.keys(profile.achievements).length}/{ACHIEVEMENTS.length}
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
                        {at ? '🏆' : '🔒'} {a.title}
                      </div>
                      <div className="text-[11px] text-gray-400">{a.description}</div>
                      {at && (
                        <div className="text-[10px] text-gray-500">{new Date(at).toLocaleDateString()}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="panel-title mb-2">Recent matches</div>
              {profile.history.length === 0 ? (
                <div className="text-sm text-gray-500">No matches yet.</div>
              ) : (
                <table className="w-full text-sm" data-testid="history">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-gray-500">
                      <th className="py-1">Result</th>
                      <th>Mode</th>
                      <th>Map</th>
                      <th>Faction</th>
                      <th className="text-right">Time</th>
                      <th className="text-right">Kills</th>
                      <th className="text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.history.map((h) => (
                      <tr key={h.at} className="border-t border-graphite-800 tabular-nums">
                        <td className={`py-1 font-semibold ${h.victory ? 'text-mil-400' : 'text-alert-500'}`}>
                          {h.victory ? 'Victory' : 'Defeat'}
                        </td>
                        <td className="text-gray-300">{MISSION_LABEL[h.mission] ?? h.mission}</td>
                        <td className="text-gray-300">{h.mapName}</td>
                        <td className="text-gray-400">{FACTIONS[h.faction].name}</td>
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
