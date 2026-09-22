import { Empty } from "@/components/ui";

/**
 * A single-series bar chart, in plain HTML.
 *
 * One series throughout, so there is no legend: the heading names the measure
 * and every bar carries its own value as a direct label. Colour is one
 * sequential blue, validated against both page surfaces for the 3:1 contrast
 * floor, and it encodes nothing on its own - drop the colour and the chart
 * still reads, because the length and the printed number carry the magnitude.
 *
 * Built from divs rather than SVG because the whole chart is one axis and a
 * set of lengths; SVG would buy nothing and cost a viewBox to keep in step.
 */
export function BarChart({
  data,
  label,
  empty = "Nothing logged yet.",
}: {
  data: Array<{ key: string; value: number; caption?: string }>;
  label: string;
  empty?: string;
}) {
  if (data.length === 0) return <Empty>{empty}</Empty>;

  // Scale to the tallest bar, with a floor of 1 so a lone value does not
  // divide by zero and does not render as a full-width bar either.
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{label}</figcaption>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-[#898781] tabular-nums">{d.key}</span>
            <span className="flex h-5 items-center" aria-hidden>
              <span
                // 4px rounded data-end, anchored flush to the baseline at the
                // left so bar lengths stay honestly comparable.
                className="block h-2.5 rounded-r-[4px] bg-[#2a78d6] dark:bg-[#3987e5]"
                style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
              />
            </span>
            <span className="text-xs font-medium tabular-nums">
              {d.value}
              {d.caption ? <span className="ml-1 text-[#898781]">{d.caption}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A headline number. Not every measure deserves a plot. */
export function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-slate/60">
      <p className="text-xs uppercase tracking-wide text-[#898781]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {caption ? <p className="mt-1 text-xs text-[#898781]">{caption}</p> : null}
    </div>
  );
}
