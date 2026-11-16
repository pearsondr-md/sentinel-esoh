export function Bars({
  items,
  selected,
  onSelect,
}: {
  items: Array<{ key?: string; label: string; value: number; tone?: string }>;
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const itemKey = item.key ?? item.label;
        const open = item.value > 0 && onSelect;
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span>{item.label}</span>
              <span className="font-semibold tabular-nums">{item.value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#efe6d6]" role="img" aria-label={`${item.label}: ${item.value}`}>
              <div
                className="h-3 rounded-full"
                style={{
                  width: `${Math.max(item.value === 0 ? 0 : 6, (item.value / max) * 100)}%`,
                  background: item.tone ?? "#c4a15a",
                }}
              />
            </div>
          </>
        );
        return (
          <li key={itemKey}>
            {open ? (
              <button
                className={`w-full rounded-xl px-2 py-1 text-left ${selected === itemKey ? "bg-[#efe6d6]" : "hover:bg-[#f6f0e6]"}`}
                type="button"
                onClick={() => onSelect(itemKey)}
              >
                {body}
              </button>
            ) : (
              <div className="px-2 py-1" title="No records in this bucket.">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Flow({
  steps,
  onSelect,
}: {
  steps: Array<{ key?: string; label: string; who: string; value: number }>;
  onSelect?: (key: string) => void;
}) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2" aria-label="Steps from identify to close">
      {steps.map((step, index) => {
        const stepKey = step.key ?? step.label;
        const open = step.value > 0 && onSelect;
        const card = (
          <>
            <span className="block text-2xl font-semibold tabular-nums">{step.value}</span>
            <span className="block text-sm font-medium">{step.label}</span>
            <span className="block text-xs text-[#6d6256]">{step.who}</span>
          </>
        );
        return (
          <li key={stepKey} className="flex items-center gap-2">
            {open ? (
              <button className="min-w-28 rounded-2xl bg-[#fffdf8] px-3 py-3 text-center ring-1 ring-[#eadfce] hover:ring-[#b8893a]" type="button" onClick={() => onSelect(stepKey)}>
                {card}
              </button>
            ) : (
              <div className="min-w-28 rounded-2xl bg-[#fffdf8] px-3 py-3 text-center ring-1 ring-[#eadfce]" title="No records in this step.">
                {card}
              </div>
            )}
            {index < steps.length - 1 ? <span className="text-[#b8893a]" aria-hidden="true">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
