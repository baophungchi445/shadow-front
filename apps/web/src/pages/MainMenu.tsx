import { levelInfo, titleName } from '@shadow-front/game-core';
import { useApp } from '../stores/appStore';
import { useT } from '../i18n';
import { Avatar } from '../components/Avatar';

function Backdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#24301f_0%,#12161b_45%,#0b0e11_100%)]" />
      {/* Tactical grid in isometric perspective */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.12]" preserveAspectRatio="none">
        <defs>
          <pattern id="iso" width="64" height="32" patternUnits="userSpaceOnUse">
            <path d="M0 16 32 0 64 16 32 32Z" fill="none" stroke="#9cc96a" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#iso)" />
      </svg>
      {/* Radar */}
      <div className="absolute right-[8%] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full border border-mil-600/30">
        <div className="absolute inset-[15%] rounded-full border border-mil-600/25" />
        <div className="absolute inset-[32%] rounded-full border border-mil-600/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-mil-600/20" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-mil-600/20" />
        <div className="radar-sweep absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(127,178,74,0.28),transparent_22%)]" />
        <div className="absolute left-[30%] top-[38%] h-2 w-2 rounded-full bg-warn-500 shadow-[0_0_10px_#e98a2b]" />
        <div className="absolute left-[64%] top-[60%] h-2 w-2 rounded-full bg-alert-500 shadow-[0_0_10px_#e04848]" />
        <div className="absolute left-[55%] top-[28%] h-1.5 w-1.5 rounded-full bg-mil-400 shadow-[0_0_10px_#9cc96a]" />
      </div>
      <div className="scanlines absolute inset-0" />
    </div>
  );
}

export function MainMenu() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const lvl = levelInfo(profile.xp);
  const t = useT();
  const items: { label: string; sub: string; action: () => void; primary?: boolean }[] = [
    { label: 'Play', sub: 'Skirmish or Survival vs AI', action: () => go('skirmish'), primary: true },
    { label: 'Campaign', sub: 'Tutorial and story missions', action: () => go('campaign') },
    // Multiplayer is hidden while development focuses on local play vs AI (see docs/DEVELOPMENT_ROADMAP.md).
    { label: 'Profile', sub: 'Level, statistics, achievements', action: () => go('profile') },
    { label: 'Army', sub: 'Units, buildings & factions', action: () => go('army') },
    { label: 'Map editor', sub: 'Draw your own battlefield', action: () => go('editor') },
    { label: 'Settings', sub: 'Camera & controls', action: () => go('settings') },
  ];
  return (
    <div className="relative h-full w-full">
      <Backdrop />
      <div className="relative z-10 flex h-full flex-col justify-center px-[8%]">
        <div className="mb-1 font-display text-sm font-semibold uppercase tracking-[0.5em] text-mil-500">
          {t('Modern Warfare RTS')}
        </div>
        <h1 className="font-display text-7xl font-bold tracking-[0.12em] text-gray-100 drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
          SHADOW <span className="text-mil-500">FRONT</span>
        </h1>
        <div className="mb-10 mt-2 text-sm tracking-widest text-gray-400">
          {t('BUILD YOUR ARMY · COMMAND YOUR TEAM · CONQUER THE BATTLEFIELD')}
        </div>
        <div className="flex w-80 flex-col gap-2">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.action}
              className={`group flex items-center justify-between rounded border px-4 py-3 text-left transition-all hover:translate-x-1 ${
                it.primary
                  ? 'border-mil-500 bg-mil-700/40 hover:bg-mil-600/50'
                  : 'border-graphite-600 bg-graphite-900/80 hover:border-mil-500'
              }`}
            >
              <div>
                <div className="font-display text-xl font-bold uppercase tracking-[0.2em] text-gray-100">
                  {t(it.label)}
                </div>
                <div className="text-xs text-gray-400">{t(it.sub)}</div>
              </div>
              <span className="text-mil-400 opacity-0 transition-opacity group-hover:opacity-100">▶</span>
            </button>
          ))}
        </div>
        <button
          className="absolute right-[4%] top-6 rounded border border-graphite-600 bg-graphite-900/80 px-3 py-2 text-left hover:border-mil-500"
          onClick={() => go('profile')}
          data-testid="profile-badge"
        >
          <div className="flex items-center gap-2.5">
            <Avatar icon={profile.avatar.icon} color={profile.avatar.color} size={38} />
            <div>
              <div className="font-display text-sm font-bold tracking-wider text-gray-100">
                {profile.nickname}{' '}
                <span className="text-xs font-normal text-warn-400">· {t(titleName(profile))}</span>
              </div>
              <div className="text-[11px] text-gray-400">
                {t('Level {level} · {n} achievements', {
                  level: lvl.level,
                  n: Object.keys(profile.achievements).length,
                })}
              </div>
              <div className="mt-1 h-1 w-40 overflow-hidden rounded bg-graphite-700">
                <div className="h-full bg-mil-500" style={{ width: `${(lvl.into / lvl.needed) * 100}%` }} />
              </div>
            </div>
          </div>
        </button>
        <div className="absolute bottom-5 left-[8%] text-[11px] text-gray-600">
          {t(
            'v0.15 prototype · procedural placeholder graphics & audio · offline skirmish, survival & campaign vs AI',
          )}
        </div>
      </div>
    </div>
  );
}
