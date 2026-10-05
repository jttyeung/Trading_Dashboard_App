"use client";

// The Auto Trader page's comparison chart: each paper account's % change
// since it started, against SPY over the same days. One shared y-axis (all
// series are % since start, so no second scale is ever needed); the four
// accounts take the dataviz reference palette's first four categorical slots
// in a fixed order (General, Safe, Aggressive, Quant — color follows the
// account, never its rank), validated against all three dashboard themes;
// SPY is the benchmark, so it's a neutral dashed line rather than a fifth
// hue. Same inline-SVG + HTML-overlay technique as BenchmarkChart (a
// stretched SVG distorts text and dots; positioned divs don't), plus a
// crosshair + tooltip on hover/touch. Labels and values wear text colors;
// only the swatches carry the series color.
import { useMemo, useRef, useState } from "react";
import type { PctPoint } from "@/lib/autotrader";

export interface ChartSeries {
  key: string; // general | safe | aggressive | quant — picks the color slot
  label: string;
  points: PctPoint[];
}

const SLOT: Record<string, string> = {
  general: "var(--at-1)",
  safe: "var(--at-2)",
  aggressive: "var(--at-3)",
  quant: "var(--at-4)",
};
const SPY_COLOR = "var(--muted)";

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)}%`;
const day = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
};

const W = 600;
const H = 220;
const PAD_Y = 10;

export function AutotraderChart({ series, spy }: { series: ChartSeries[]; spy: PctPoint[] }) {
  const all = useMemo(
    () => [
      ...series.map((s) => ({
        ...s,
        color: SLOT[s.key] ?? SPY_COLOR,
        dashed: false,
      })),
      { key: "spy", label: "SPY", points: spy, color: SPY_COLOR, dashed: true },
    ],
    [series, spy],
  );
  const dates = useMemo(() => [...new Set(all.flatMap((s) => s.points.map((p) => p.date)))].sort(), [all]);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  if (dates.length < 2) {
    return <p className="py-6 text-center text-[11px] text-muted">The chart starts once the accounts have two days behind them.</p>;
  }
  const byDate = all.map((s) => new Map(s.points.map((p) => [p.date, p.pct])));
  const values = byDate.flatMap((m) => [...m.values()]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 0.01;
  const x = (i: number) => (i / (dates.length - 1)) * W;
  const y = (v: number) => PAD_Y + (H - 2 * PAD_Y) * (1 - (v - min) / span);
  const yPct = (v: number) => (y(v) / H) * 100;
  const ticks = [...new Set([max, 0, min].map((v) => Math.round(v * 1000) / 1000))];

  // End labels, nudged apart so close finishes don't overprint.
  const ends = all
    .map((s, si) => {
      const last = [...dates].reverse().find((d) => byDate[si].has(d));
      return last
        ? {
            key: s.key,
            label: s.label,
            color: s.color,
            v: byDate[si].get(last)!,
            top: yPct(byDate[si].get(last)!),
          }
        : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.top - b.top);
  for (let i = 1; i < ends.length; i++) ends[i].top = Math.max(ends[i].top, ends[i - 1].top + 9);

  function onMove(e: React.PointerEvent) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (dates.length - 1)));
  }

  const hoverLeft = hover === null ? 0 : (hover / (dates.length - 1)) * 100;

  return (
    <div className="at-viz">
      <style>{`
        .at-viz { --at-1: #3987e5; --at-2: #d95926; --at-3: #199e70; --at-4: #c98500; }
        .theme-light .at-viz { --at-1: #2a78d6; --at-2: #eb6834; --at-3: #1baf7a; --at-4: #eda100; }
      `}</style>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted" aria-hidden="true">
        {all.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <svg width="14" height="6">
              <line x1="0" x2="14" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "3 2" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="pl-10 pr-20">
        <div className="relative">
          <div ref={box} className="relative touch-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-52 w-full"
              role="img"
              aria-label="Auto Trader accounts and SPY, % change since start"
            >
              {ticks.map((t) => (
                <line
                  key={t}
                  x1={0}
                  x2={W}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="currentColor"
                  strokeOpacity={t === 0 ? 0.25 : 0.08}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {all.map((s, si) => {
                const pts = dates
                  .map((d, i) => (byDate[si].has(d) ? `${x(i).toFixed(1)},${y(byDate[si].get(d)!).toFixed(1)}` : null))
                  .filter(Boolean);
                if (pts.length < 2) return null;
                return (
                  <polyline
                    key={s.key}
                    points={pts.join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            {hover !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-current opacity-30" style={{ left: `${hoverLeft}%` }} />
                {all.map((s, si) =>
                  byDate[si].has(dates[hover]) ? (
                    <span
                      key={s.key}
                      className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--surface)]"
                      style={{
                        left: `${hoverLeft}%`,
                        top: `${yPct(byDate[si].get(dates[hover])!)}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  ) : null,
                )}
                <div
                  className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-lg bg-surface-2 px-2 py-1.5 text-[10px] shadow-lg ring-1 ring-border"
                  style={hoverLeft > 55 ? { right: `${100 - hoverLeft + 2}%` } : { left: `${hoverLeft + 2}%` }}
                >
                  <div className="mb-0.5 font-semibold text-text">{day(dates[hover])}</div>
                  {all.map((s, si) =>
                    byDate[si].has(dates[hover]) ? (
                      <div key={s.key} className="flex items-center justify-between gap-3 text-muted">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="tabular text-text">{pct(byDate[si].get(dates[hover])!)}</span>
                      </div>
                    ) : null,
                  )}
                </div>
              </>
            )}
          </div>
          {ticks.map((t) => (
            <div
              key={t}
              className="pointer-events-none absolute -left-10 -translate-y-1/2 text-[9px] tabular text-muted"
              style={{ top: `${yPct(t)}%` }}
            >
              {pct(t)}
            </div>
          ))}
          {ends.map((e) => (
            <div
              key={e.key}
              className="pointer-events-none absolute -right-20 flex w-[4.75rem] -translate-y-1/2 items-center gap-1 whitespace-nowrap text-[10px] text-muted"
              style={{ top: `${e.top}%` }}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="tabular text-text">{pct(e.v)}</span> {e.label.replace("Auto Trader · ", "")}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-muted">
          <span>{day(dates[0])}</span>
          <span>{day(dates[dates.length - 1])}</span>
        </div>
      </div>
    </div>
  );
}
