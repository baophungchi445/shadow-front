import type { HudSnapshot } from '../../game/hudModel';

/** Objective checklist shown during the tutorial mission. */
export function TutorialPanel({ tutorial }: { tutorial: NonNullable<HudSnapshot['tutorial']> }) {
  const { index, steps } = tutorial;
  const current = steps[index];
  return (
    <div className="panel pointer-events-auto w-80 p-3" data-testid="tutorial-panel">
      <div className="panel-title mb-1 flex justify-between">
        <span>Tutorial</span>
        <span className="text-gray-500">
          {Math.min(index + 1, steps.length)}/{steps.length}
        </span>
      </div>
      {current ? (
        <>
          <div className="font-display text-base font-semibold text-gray-100">{current.title}</div>
          <div className="mt-1 text-xs leading-relaxed text-gray-300">{current.hint}</div>
        </>
      ) : (
        <div className="font-display text-base font-semibold text-mil-400">
          Training complete — you are ready for a skirmish!
        </div>
      )}
      <ol className="mt-2 space-y-0.5 text-[11px]">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={i < index ? 'text-mil-400' : i === index ? 'text-gray-100' : 'text-gray-600'}
          >
            {i < index ? '✓' : i === index ? '▶' : '·'} {s.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
