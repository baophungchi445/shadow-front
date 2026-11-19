import type { GameController } from '../../game/GameController';
import type { BuildOption, HudSnapshot, SelectionInfo } from '../../game/hudModel';
import { Icon } from '../Icon';

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
  return (
    <div className="panel pointer-events-auto flex h-full w-72 flex-col p-2.5">
      <div className="panel-title mb-1.5">Selection</div>
      {sel.kind === 'none' && (
        <div className="text-sm text-gray-500">
          Click a unit or drag a box to select. <br />
          Right-click to move / attack.
        </div>
      )}
      {sel.kind === 'units' && sel.single && (
        <div className="flex gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-graphite-600 bg-graphite-800 text-mil-400">
            <Icon id={sel.groups[0].type} className="h-10 w-10" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-display text-base font-semibold text-gray-100">{sel.single.name}</div>
            <div className="mb-1 text-xs text-gray-400">
              {sel.single.owner} · {sel.single.order}
            </div>
            <Bar value={sel.single.hp / sel.single.maxHp} color={hpColor(sel.single.hp / sel.single.maxHp)} />
            <div className="mt-0.5 text-xs tabular-nums text-gray-400">
              HP {sel.single.hp}/{sel.single.maxHp} · {sel.single.weapon}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-gray-500">{sel.single.description}</div>
          </div>
        </div>
      )}
      {sel.kind === 'units' && !sel.single && (
        <div className="grid grid-cols-4 gap-1.5">
          {sel.groups.map((g) => (
            <button
              key={g.type}
              className="relative flex flex-col items-center rounded border border-graphite-600 bg-graphite-800 p-1 text-mil-400 hover:border-mil-500"
              title={`${g.name} — click to select only these`}
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
            <div className="font-display text-base font-semibold text-gray-100">{sel.name}</div>
            <div className="mb-1 text-xs text-gray-400">
              {sel.owner}
              {!sel.complete && ` · Constructing ${Math.round(sel.progress * 100)}%`}
            </div>
            <Bar value={sel.hp / sel.maxHp} color={hpColor(sel.hp / sel.maxHp)} />
            <div className="mt-0.5 text-xs tabular-nums text-gray-400">
              HP {sel.hp}/{sel.maxHp}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-gray-500">{sel.description}</div>
            {sel.own && !sel.complete && (
              <button
                className="btn mt-1.5 px-2 py-0.5 text-xs"
                onClick={() => controller.cancelConstruction(sel.id)}
              >
                Cancel (refund)
              </button>
            )}
            {sel.own && sel.complete && (sel.damaged || sel.repairing) && (
              <button
                className={`btn mt-1.5 px-2 py-0.5 text-xs ${sel.repairing ? 'border-mil-500 text-mil-300' : ''}`}
                title="Repair costs credits over time (50% of building price for a full repair)"
                onClick={() => controller.toggleRepair(sel.id)}
              >
                {sel.repairing ? '🔧 Repairing… (stop)' : '🔧 Repair'}
              </button>
            )}
          </div>
        </div>
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
  if (sel.kind === 'building' && sel.own && sel.research.length) {
    return (
      <div className="panel pointer-events-auto flex h-full flex-1 flex-col p-2.5">
        <div className="panel-title mb-1.5">Research — {sel.name}</div>
        <div className="flex gap-1.5">
          {sel.research.map((r) => (
            <button
              key={r.id}
              disabled={!r.available && r.progress === null}
              title={[
                `${r.name} — ${r.cost} credits`,
                r.description,
                r.reason ?? '',
                r.progress !== null ? 'Click to cancel (refund)' : '',
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
                {r.name}
              </span>
              <span className="mt-0.5 text-[10px] leading-tight text-gray-400">{r.description}</span>
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
          <span>Production — {sel.name}</span>
          <span className="text-gray-500 normal-case tracking-normal">
            Right-click map to set rally point
          </span>
        </div>
        <div className="flex gap-1.5">
          {sel.options.map((o) => (
            <button
              key={o.type}
              disabled={!o.available}
              title={o.reason ?? `${o.name} — ${o.cost} credits`}
              onClick={() => controller.produce(o.type)}
              className="group relative flex w-[74px] flex-col items-center rounded border border-graphite-600 bg-graphite-800 px-1 pb-1 pt-1.5 text-mil-400 transition-colors hover:border-mil-500 hover:bg-graphite-700 disabled:opacity-40"
            >
              <Icon id={o.type} className="h-8 w-8" />
              <span className="mt-0.5 w-full truncate text-center text-[10px] leading-tight text-gray-200">
                {o.name}
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
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Queue</span>
          {sel.queue.length === 0 && <span className="text-xs text-gray-600">empty</span>}
          {sel.queue.map((q, i) => (
            <button
              key={i}
              title="Click to cancel last item (refund)"
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
        </div>
      </div>
    );
  }

  const hasUnits = sel.kind === 'units' && sel.own;
  const cmds: { label: string; key: string; run: () => void; active?: boolean }[] = [
    {
      label: 'Attack-move',
      key: 'F',
      run: () => (controller.commandMode = 'attackMove'),
      active: mode === 'attackMove',
    },
    { label: 'Stop', key: 'X', run: () => controller.stopSelected() },
    { label: 'Hold', key: 'G', run: () => controller.holdSelected() },
    { label: 'Retreat', key: 'R', run: () => controller.retreatSelected() },
  ];
  return (
    <div className="panel pointer-events-auto flex h-full flex-1 flex-col p-2.5">
      <div className="panel-title mb-1.5">Commands</div>
      <div className="flex flex-wrap gap-1.5">
        {cmds.map((c) => (
          <button
            key={c.label}
            disabled={!hasUnits}
            onClick={c.run}
            className={`btn flex items-center gap-2 ${c.active ? 'border-warn-500 text-warn-400' : ''}`}
          >
            {c.label}
            <kbd className="rounded bg-graphite-950 px-1 text-[10px] text-gray-400">{c.key}</kbd>
          </button>
        ))}
        <button className="btn" onClick={() => controller.selectAllArmy()}>
          Select army <kbd className="ml-1 rounded bg-graphite-950 px-1 text-[10px] text-gray-400">Q</kbd>
        </button>
      </div>
      <div className="mt-auto text-[11px] leading-snug text-gray-500">
        Right-click: move / attack · Drag: box select · Double-click: select type · Ctrl+1-9 / 1-9: groups ·
        WASD / arrows / screen edge / middle-drag: pan · Wheel: zoom · Space: last alert / base · - / =: game
        speed
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
  return (
    <div className="panel pointer-events-auto flex h-full w-[340px] flex-col p-2.5">
      <div className="panel-title mb-1.5 flex justify-between">
        <span>Construction</span>
        {placing && (
          <span className="normal-case tracking-normal text-warn-400">
            Placing… right-click / Esc to cancel
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {build.map((b) => (
          <button
            key={b.type}
            disabled={!b.available}
            title={`${b.name} — ${b.cost} credits, ${b.power > 0 ? '+' : ''}${b.power} power${b.reason ? `\n${b.reason}` : ''}`}
            onClick={() => controller.beginPlacement(b.type)}
            className={`relative flex flex-col items-center rounded border bg-graphite-800 px-1 pb-0.5 pt-1 text-mil-400 transition-colors hover:border-mil-500 hover:bg-graphite-700 disabled:opacity-40 ${placing === b.type ? 'border-warn-500' : 'border-graphite-600'}`}
          >
            <Icon id={b.type} className="h-6 w-6" />
            <span className="w-full truncate text-center text-[10px] leading-tight text-gray-200">
              {b.name}
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

export function TeamStatus({ hud }: { hud: HudSnapshot }) {
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
          <span className="ml-auto text-gray-500">{p.raider ? 'Enemy' : `T${p.team + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
