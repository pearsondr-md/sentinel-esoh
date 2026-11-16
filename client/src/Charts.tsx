export function Bars({ items }: { items: Array<{ label: string; value: number; tone?: string }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
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
        </li>
      ))}
    </ul>
  );
}

export function Flow({ steps }: { steps: Array<{ label: string; who: string; value: number }> }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-2" aria-label="Steps from identify to close">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-2">
          <div className="min-w-28 rounded-2xl bg-[#fffdf8] px-3 py-3 text-center ring-1 ring-[#eadfce]">
            <span className="block text-2xl font-semibold tabular-nums">{step.value}</span>
            <span className="block text-sm font-medium">{step.label}</span>
            <span className="block text-xs text-[#6d6256]">{step.who}</span>
          </div>
          {index < steps.length - 1 ? <span className="text-[#b8893a]" aria-hidden="true">→</span> : null}
        </li>
      ))}
    </ol>
  );
}
