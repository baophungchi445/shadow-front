import type { HudSnapshot } from '../../game/hudModel';
import { useT } from '../../i18n';

/** Objective checklist shown in the tutorial and campaign missions. */
export function ObjectivesPanel({ objectives }: { objectives: NonNullable<HudSnapshot['objectives']> }) {
  const { title, ordered, index, steps } = objectives;
  const current = steps[index];
  const doneCount = steps.filter((s) => s.done).length;
  const t = useT();
  return (
    <div className="panel pointer-events-auto w-80 p-3" data-testid="objectives-panel">
      <div className="panel-title mb-1 flex justify-between">
        <span>{t(title)}</span>
        <span className="text-gray-500">
          {ordered
            ? `${Math.min(index + 1, steps.length)}/${steps.length}`
            : t('{a}/{b} done', { a: doneCount, b: steps.length })}
        </span>
      </div>
      {current ? (
        <>
          <div className="font-display text-base font-semibold text-gray-100">{t(current.title)}</div>
          <div className="mt-1 text-xs leading-relaxed text-gray-300">{t(current.hint)}</div>
        </>
      ) : (
        <div className="font-display text-base font-semibold text-mil-400">{t('All objectives complete!')}</div>
      )}
      <ol className="mt-2 space-y-0.5 text-[11px]">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={
              s.done
                ? 'text-mil-400'
                : i === index
                  ? 'text-gray-100'
                  : ordered
                    ? 'text-gray-600'
                    : 'text-gray-400'
            }
          >
            {s.done ? '✓' : i === index ? '▶' : '·'} {t(s.title)}
          </li>
        ))}
      </ol>
    </div>
  );
}
