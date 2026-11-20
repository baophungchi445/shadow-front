import type { Formation } from '@shadow-front/shared-types';
import { RANK_NAMES, type GameController } from '../../game/GameController';
import { FORMATIONS, FORMATION_NAMES } from '../../game/formations';

const FORMATION_HINTS: Record<Formation, string> = {
  spread: 'Loose group around the target; everyone moves at full speed',
  line: 'Side by side across the direction of travel; the group keeps pace with its slowest unit',
  column: 'Two abreast, one pair behind the other (good for roads and bridges)',
  wedge: 'Arrowhead with the toughest units at the tip',
};
import type { BuildOption, HudSnapshot, SelectionInfo } from '../../game/hudModel';
import { Icon } from '../Icon';
import { useApp } from '../../stores/appStore';
import { keyLabel, type HotkeyAction } from '../../game/keybinds';
import { useT } from '../../i18n';

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-graphite-700">
      <div
        className="h-full transition-[width]"
        style={{ width: `${Math.round(value * 100)}%`, background: color }}
      />
    </div>
  );
}

const hpColor = (f: number) => (f > 0.6 ? '#6fd24a' : f > 0.3 ? '#f2c94a' : '#e04848');

/** Left: details about the current selection. */
export function SelectionPanel({ sel, controller }: { sel: SelectionInfo; controller: GameController }) {
  const t = useT();
  return (
    <div className="panel pointer-events-auto flex h-full w-72 flex-col p-2.5">
      <div className="panel-title mb-1.5">{t('Selection')}</div>
      {sel.kind === 'none' && (
        <div className="text-sm text-gray-500">
          {t('Click a unit or drag a box to select.')} <br />
          {t('Right-click to move / attack.')}
        </div>
      )}
      {sel.kind === 'units' && sel.single && (
        <div className="flex gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-graphite-600 bg-graphite-800 text-mil-400">
            <Icon id={sel.groups[0].type} className="h-10 w-10" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-display text-base font-semibold text-gray-100">
              {t(sel.single.name)}
              {sel.single.rank > 0 && (
                <span className="ml-2 text-xs text-warn-400" title="Veterancy: +10% damage and HP per rank">
                  {'▲'.repeat(sel.single.rank)} {RANK_NAMES[sel.single.rank]}
                </span>
              )}
            </div>
            <div className="mb-1 text-xs text-gray-400">
              {sel.single.owner} · {t(sel.single.order)}
            </div>
            <Bar value={sel.single.hp / sel.single.maxHp} color={hpColor(sel.single.hp / sel.single.maxHp)} />
            <div className="mt-0.5 text-xs tabular-nums text-gray-400">
              HP {sel.single.hp}/{sel.single.maxHp} ·{' '}
              {sel.single.weapon === 'Unarmed' ? t('Unarmed') : sel.single.weapon}
            </div>
            {sel.single.cargo && (
              <CargoRow cargo={sel.single.cargo} onUnload={() => controller.unloadSelected()} />
            )}
            {sel.single.smokeIn !== null && (
              <div className="mt-1 text-xs text-gray-400" data-testid="smoke-status">
                💨{' '}
                {sel.single.smokeIn === 0
                  ? t('Smoke grenade ready')
                  : t('Smoke grenade in {n} s', { n: sel.single.smokeIn })}
              </div>
            )}
            {sel.single.deploysTo && (
              <DeployRow name={sel.single.deploysTo} onDeploy={() => controller.deploySelected()} />
            )}
            <div className="mt-1 text-[11px] leading-tight text-gray-500">{t(sel.single.description)}</div>
          </div>
        </div>
      )}
      {sel.kind === 'units' && !sel.single && (
        <div className="grid grid-cols-4 gap-1.5">
          {sel.groups.map((g) => (
            <button
              key={g.type}
              className="relative flex flex-col items-center rounded border border-graphite-600 bg-graphite-800 p-1 text-mil-400 hover:border-mil-500"
              title={t('{name} — click to select only these', { name: t(g.name) })}
              onClick={() =>
                controller.setSelection(
                  controller
                    .selectedOwnUnits()
                    .filter((u) => u.type === g.type)
                    .map((u) => u.id),
                )
              }
            >
              <Icon id={g.type} className="h-7 w-7" />
              <span className="absolute right-1 top-0.5 font-display text-xs font-bold text-gray-100">
                {g.count}
              </span>
              <div className="mt-0.5 w-full">
                <Bar value={g.hp} color={hpColor(g.hp)} />
              </div>
            </button>
          ))}
        </div>
      )}
      {sel.kind === 'building' && (
        <div className="flex gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-graphite-600 bg-graphite-800 text-mil-400">
            <Icon id={sel.type} className="h-10 w-10" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-display text-base font-semibold text-gray-100">
              {t(sel.name)}
              {sel.level > 1 && (
                <span className="ml-2 text-xs text-warn-400">{t('★ Level {n}', { n: sel.level })}</span>
              )}
            </div>
            <div className="mb-1 text-xs text-gray-400">
              {sel.owner}
              {!sel.complete && t(' · Constructing {n}%', { n: Math.round(sel.progress * 100) })}
            </div>
            <Bar value={sel.hp / sel.maxHp} color={hpColor(sel.hp / sel.maxHp)} />
            <div className="mt-0.5 text-xs tabular-nums text-gray-400">
              HP {sel.hp}/{sel.maxHp}
            </div>
            {sel.cargo && sel.complete && (
              <CargoRow cargo={sel.cargo} onUnload={() => controller.unloadSelected()} />
            )}
            <div className="mt-1 text-[11px] leading-tight text-gray-500">{t(sel.description)}</div>
            {sel.own && !sel.complete && (
              <button
                className="btn mt-1.5 px-2 py-0.5 text-xs"
                onClick={() => controller.cancelConstruction(sel.id)}
              >
                {t('Cancel (refund)')}
              </button>
            )}
            {sel.own && sel.complete && (sel.damaged || sel.repairing) && (
              <button
                className={`btn mt-1.5 px-2 py-0.5 text-xs ${sel.repairing ? 'border-mil-500 text-mil-300' : ''}`}
                title={t('Repair costs credits over time (50% of building price for a full repair)')}
                onClick={() => controller.toggleRepair(sel.id)}
              >
                {t(sel.repairing ? '🔧 Repairing… (stop)' : '🔧 Repair')}
              </button>
            )}
            {sel.upgrade && (
              <button
                className="btn ml-1.5 mt-1.5 px-2 py-0.5 text-xs"
                disabled={sel.upgrade.progress !== null || !sel.upgrade.affordable}
                title={t('Level 2: more HP (defenses also more damage, power plants +50% power)')}
                onClick={() => controller.upgradeBuilding(sel.id)}
              >
                {sel.upgrade.progress !== null
                  ? t('⬆ Upgrading {n}%', { n: Math.round(sel.upgrade.progress * 100) })
                  : t('⬆ Upgrade ({cost})', { cost: sel.upgrade.cost })}
              </button>
            )}
            {sel.sellValue !== null && (
              <button
                className="btn ml-1.5 mt-1.5 px-2 py-0.5 text-xs"
                title={t('Sell: 50% of the price × remaining HP; queued units are refunded')}
                onClick={() => controller.sellBuilding(sel.id)}
              >
                {t('$ Sell (+{n})', { n: sel.sellValue })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Deploy button for a Mobile Command Vehicle (shares the unload hotkey). */
function DeployRow({ name, onDeploy }: { name: string; onDeploy: () => void }) {
  const key = useApp((st) => keyLabel(st.settings.keybinds.unload));
  const t = useT();
  return (
    <div className="mt-1 flex items-center gap-2 text-xs" data-testid="deploy">
      <button
        className="btn px-2 py-0.5 text-xs"
        onClick={onDeploy}
        title={t('Unfold into a {name} here (needs a free 3×3 spot)', { name: t(name) })}
      >
        {t('Deploy')} <kbd className="ml-1 rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{key}</kbd>
      </button>
      <span className="text-gray-500">→ {t(name)}</span>
    </div>
  );
}

/** Passengers inside a transport / bunker with an Unload button. */
function CargoRow({ cargo, onUnload }: { cargo: { count: number; capacity: number }; onUnload: () => void }) {
  const key = useApp((st) => keyLabel(st.settings.keybinds.unload));
  const t = useT();
  return (
    <div className="mt-1 flex items-center gap-2 text-xs" data-testid="cargo">
      <span className="text-gray-300">{t('👥 {a}/{b} inside', { a: cargo.count, b: cargo.capacity })}</span>
      {cargo.count > 0 ? (
        <button className="btn px-2 py-0.5 text-xs" onClick={onUnload}>
          {t('Unload')}{' '}
          <kbd className="ml-1 rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{key}</kbd>
        </button>
      ) : (
        <span className="text-gray-500">{t('select infantry, right-click here to get in')}</span>
      )}
    </div>
  );
}

/** Centre: unit commands or production for the selected building. */
export function CommandPanel({
  sel,
  controller,
  mode,
}: {
  sel: SelectionInfo;
  controller: GameController;
  mode: string;
}) {
  const kb = useApp((st) => st.settings.keybinds);
  const formation = useApp((st) => st.settings.formation);
  const t = useT();
  const k = (a: HotkeyAction) => keyLabel(kb[a]);
  if (sel.kind === 'building' && sel.own && sel.research.length) {
    return (
      <div className="panel pointer-events-auto flex h-full flex-1 flex-col p-2.5">
        <div className="panel-title mb-1.5">{t('Research — {name}', { name: t(sel.name) })}</div>
        <div className="flex gap-1.5">
          {sel.research.map((r) => (
            <button
              key={r.id}
              disabled={!r.available && r.progress === null}
              title={[
                t('{name} — {cost} credits', { name: t(r.name), cost: r.cost }),
                t(r.description),
                r.reason ? t.msg(r.reason) : '',
                r.progress !== null ? t('Click to cancel (refund)') : '',
              ]
                .filter(Boolean)
                .join('\n')}
              onClick={() =>
                r.progress !== null ? controller.cancelResearch(sel.id) : controller.research(sel.id, r.id)
              }
              className={`relative flex w-[132px] flex-col rounded border bg-graphite-800 px-2 py-1.5 text-left transition-colors hover:border-mil-500 hover:bg-graphite-700 disabled:opacity-40 ${
                r.done ? 'border-mil-600' : r.progress !== null ? 'border-violet-400' : 'border-graphite-600'
              }`}
            >
              <span className="text-[11px] font-semibold leading-tight text-gray-100">
                {r.done ? '✓ ' : ''}
                {t(r.name)}
              </span>
              <span className="mt-0.5 text-[10px] leading-tight text-gray-400">{t(r.description)}</span>
              {!r.done && <span className="mt-0.5 text-[10px] tabular-nums text-warn-400">◆{r.cost}</span>}
              {r.progress !== null && (
                <div className="mt-1">
                  <Bar value={r.progress} color="#a78bfa" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (sel.kind === 'building' && sel.own && sel.options.length) {
    return (
      <div className="panel pointer-events-auto flex h-full flex-1 flex-col p-2.5">
        <div className="panel-title mb-1.5 flex justify-between">
          <span>{t('Production — {name}', { name: t(sel.name) })}</span>
          <span className="text-gray-500 normal-case tracking-normal">
            {t('Right-click map to set rally point')}
          </span>
        </div>
        <div className="flex gap-1.5">
          {sel.options.map((o) => (
            <button
              key={o.type}
              disabled={!o.available}
              title={
                o.reason ? t.msg(o.reason) : t('{name} — {cost} credits', { name: t(o.name), cost: o.cost })
              }
              onClick={() => controller.produce(o.type)}
              className="group relative flex w-[74px] flex-col items-center rounded border border-graphite-600 bg-graphite-800 px-1 pb-1 pt-1.5 text-mil-400 transition-colors hover:border-mil-500 hover:bg-graphite-700 disabled:opacity-40"
            >
              <Icon id={o.type} className="h-8 w-8" />
              <span className="mt-0.5 w-full truncate text-center text-[10px] leading-tight text-gray-200">
                {t(o.name)}
              </span>
              <span className="text-[10px] tabular-nums text-warn-400">◆{o.cost}</span>
              {o.queued > 0 && (
                <span className="absolute right-1 top-0.5 rounded bg-mil-600 px-1 font-display text-[10px] font-bold text-white">
                  {o.queued}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-1.5 pt-1.5">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">{t('Queue')}</span>
          {sel.queue.length === 0 && <span className="text-xs text-gray-600">{t('empty')}</span>}
          {sel.queue.map((q, i) => (
            <button
              key={i}
              title={t('Click to cancel last item (refund)')}
              onClick={() => controller.cancelProduction(sel.id)}
              className="relative h-8 w-8 rounded border border-graphite-600 bg-graphite-800 p-1 text-gray-300 hover:border-alert-500"
            >
              <Icon id={q.type} className="h-full w-full" />
              {i === 0 && (
                <div className="absolute inset-x-0.5 bottom-0.5">
                  <Bar value={q.progress} color="#6fc3ff" />
                </div>
              )}
            </button>
          ))}
          {sel.unitUpgrades.length > 0 && (
            <div className="ml-auto flex items-center gap-1" data-testid="unit-upgrades">
              <span className="text-[10px] uppercase tracking-widest text-gray-500">{t('Upgrades')}</span>
              {sel.unitUpgrades.map((u) => (
                <button
                  key={u.type}
                  disabled={!u.available && u.progress === null}
                  title={[
                    t('Upgrade {name}: +20% HP, +15% damage for every {name} — {cost} credits', {
                      name: t(u.name),
                      cost: u.cost,
                    }),
                    u.reason ? t.msg(u.reason) : '',
                    u.progress !== null ? t('Click to cancel (refund)') : '',
                  ]
                    .filter(Boolean)
                    .join('\n')}
                  onClick={() =>
                    u.progress !== null
                      ? controller.cancelUnitUpgrade(sel.id)
                      : controller.upgradeUnit(sel.id, u.type)
                  }
                  className={`relative h-8 w-8 rounded border bg-graphite-800 p-1 text-mil-400 hover:border-mil-500 disabled:opacity-40 ${
                    u.done
                      ? 'border-mil-600'
                      : u.progress !== null
                        ? 'border-violet-400'
                        : 'border-graphite-600'
                  }`}
                >
                  <Icon id={u.type} className="h-full w-full" />
                  <span className="absolute -right-0.5 -top-1 text-[10px] font-bold text-warn-400">
                    {u.done ? '★' : '⬆'}
                  </span>
                  {u.progress !== null && (
                    <div className="absolute inset-x-0.5 bottom-0.5">
                      <Bar value={u.progress} color="#a78bfa" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasUnits = sel.kind === 'units' && sel.own;
  const cmds: { label: string; key: string; run: () => void; active?: boolean }[] = [
    {
      label: 'Attack-move',
      key: k('attackMove'),
      run: () => (controller.commandMode = 'attackMove'),
      active: mode === 'attackMove',
    },
    {
      label: 'Patrol',
      key: k('patrol'),
      run: () => (controller.commandMode = 'patrol'),
      active: mode === 'patrol',
    },
    {
      label: 'Smoke',
      key: k('smoke'),
      run: () => (controller.commandMode = 'smoke'),
      active: mode === 'smoke',
    },
    { label: 'Stop', key: k('stop'), run: () => controller.stopSelected() },
    { label: 'Hold', key: k('hold'), run: () => controller.holdSelected() },
    { label: 'Retreat', key: k('retreat'), run: () => controller.retreatSelected() },
  ];
  return (
    <div className="panel pointer-events-auto flex h-full flex-1 flex-col p-2.5">
      <div className="panel-title mb-1.5">{t('Commands')}</div>
      <div className="flex flex-wrap gap-1.5">
        {cmds.map((c) => (
          <button
            key={c.label}
            disabled={!hasUnits}
            onClick={c.run}
            className={`btn flex items-center gap-2 ${c.active ? 'border-warn-500 text-warn-400' : ''}`}
          >
            {t(c.label)}
            <kbd className="rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{c.key}</kbd>
          </button>
        ))}
        <button className="btn" onClick={() => controller.selectAllArmy()}>
          {t('Select army')}{' '}
          <kbd className="ml-1 rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{k('selectArmy')}</kbd>
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs" data-testid="formation">
        <span className="mr-1 text-gray-500">
          {t('Formation')}{' '}
          <kbd className="rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{k('formation')}</kbd>
        </span>
        {FORMATIONS.map((f) => (
          <button
            key={f}
            onClick={() => controller.setFormation(f)}
            title={t(FORMATION_HINTS[f])}
            className={`btn px-2 py-0.5 text-xs ${formation === f ? 'border-warn-500 text-warn-400' : ''}`}
          >
            {t(FORMATION_NAMES[f])}
          </button>
        ))}
      </div>
      <div className="mt-auto text-[11px] leading-snug text-gray-500">
        {t(
          'Right-click: move / attack / get in · {patrol}: patrol · {unload}: unload / deploy · Drag: box select · Double-click: select type · Ctrl+1-9 / 1-9: groups · WASD / arrows / screen edge / middle-drag: pan · Wheel: zoom · {alert}: last alert / base · - / =: game speed',
          { patrol: k('patrol'), unload: k('unload'), alert: k('alert') },
        )}
      </div>
    </div>
  );
}

/** Right: construction menu. */
export function BuildPanel({
  build,
  controller,
  placing,
}: {
  build: BuildOption[];
  controller: GameController;
  placing: string | null;
}) {
  const t = useT();
  const retreatKey = useApp((st) => keyLabel(st.settings.keybinds.retreat));
  return (
    <div className="panel pointer-events-auto flex h-full w-[470px] flex-col p-2.5">
      <div className="panel-title mb-1.5 flex justify-between">
        <span>{t('Construction')}</span>
        {placing && (
          <span className="normal-case tracking-normal text-warn-400">
            {t('Placing… {key}: rotate · right-click / Esc to cancel', { key: retreatKey })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {build.map((b) => (
          <button
            key={b.type}
            disabled={!b.available}
            title={`${t(b.name)} — ${t('{cost} credits, {power} power', { cost: b.cost, power: `${b.power > 0 ? '+' : ''}${b.power}` })}${b.reason ? `\n${t.msg(b.reason)}` : ''}`}
            onClick={() => controller.beginPlacement(b.type)}
            className={`relative flex flex-col items-center rounded border bg-graphite-800 px-1 pb-0.5 pt-1 text-mil-400 transition-colors hover:border-mil-500 hover:bg-graphite-700 disabled:opacity-40 ${placing === b.type ? 'border-warn-500' : 'border-graphite-600'}`}
          >
            <Icon id={b.type} className="h-5 w-5" />
            <span className="w-full truncate text-center text-[10px] leading-tight text-gray-200">
              {t(b.name)}
            </span>
            <span className="text-[10px] tabular-nums text-warn-400">◆{b.cost}</span>
            {b.constructing !== null && (
              <div className="absolute inset-x-1 top-0.5">
                <Bar value={b.constructing} color="#e2b23a" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TeamStatus({ hud, controller }: { hud: HudSnapshot; controller?: GameController }) {
  return (
    <div className="mt-1.5 space-y-0.5">
      {hud.players.map((p, i) => (
        <div
          key={i}
          className={`flex items-center gap-1.5 text-[11px] ${p.defeated ? 'text-gray-600 line-through' : 'text-gray-300'}`}
        >
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: `#${p.color.toString(16).padStart(6, '0')}` }}
          />
          <span className="truncate">
            {p.name}
            {p.you ? ' (you)' : ''}
          </span>
          {p.ally && controller && (
            <button
              className="pointer-events-auto rounded border border-graphite-600 px-1 text-[10px] text-warn-400 hover:border-warn-500"
              title="Send 500 credits to this teammate"
              disabled={hud.credits < 500}
              onClick={() => controller.sendCredits(p.id, 500)}
            >
              +500◆
            </button>
          )}
          <span className="ml-auto text-gray-500">{p.raider ? 'Enemy' : `T${p.team + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
