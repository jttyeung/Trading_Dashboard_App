"use client";

// Company financials under the chart, TradingView-style: performance
// (revenue / net income, with net margin as its own small chart rather than a
// second y-axis on the same one), the revenue → net income waterfall, debt vs
// free cash flow vs cash, and EPS actual vs estimate. Data is the company's own
// SEC filings via the daemon (lib/financials.ts); EPS is Finnhub's last four
// quarters, and forward estimates aren't available on its free tier.
//
// Dependency-free SVG like components/charts.tsx. Each chart uses a fixed
// viewBox scaled uniformly (no preserveAspectRatio="none"), so SVG text stays
// undistorted and positions can be shared with the HTML tooltip as percentages.
import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui";
import { peSeries, type Financials, type FinancialPeriod, type PEPoint } from "@/lib/financials";

// Categorical slots 1-3 of the dataviz reference palette, dark steps, checked
// with its validator against --surface (#121826): all pairs pass CVD and
// normal-vision separation and 3:1 contrast.
const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
const AXIS = "#9ca3af";
const GRID = "#27272a";

const W = 360;
const H = 170;
const PAD = { top: 10, right: 6, bottom: 18, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(0)}K`;
  return `${sign}${a.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  return `${v < 0 ? "−" : ""}${a >= 100 || a === 0 ? a.toFixed(0) : a.toFixed(1)}%`;
}

function fmtEps(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
}

// A "nice" axis: 0 always included, about four steps of 1/2/2.5/5 × 10^n.
function niceScale(values: number[], includeZero = true) {
  let min = Math.min(...values, ...(includeZero ? [0] : []));
  let max = Math.max(...values, ...(includeZero ? [0] : []));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  const y = (v: number) => PAD.top + PLOT_H * (1 - (v - lo) / (hi - lo));
  return { ticks, y };
}

// A bar with 4px rounding on its data end only, anchored square at the baseline.
function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return `M${x},${y0}h${w}`;
  if (y1 < y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

function Axis({ ticks, y, fmt }: { ticks: number[]; y: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#52525b" : GRID} strokeWidth={t === 0 ? 1 : 0.5} />
          <text x={PAD.left - 4} y={y(t) + 3} textAnchor="end" fontSize={8.5} fill={AXIS}>
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ labels }: { labels: string[] }) {
  const step = PLOT_W / labels.length;
  // On 8 quarters every label fits at this size; still thin out if more ever arrive.
  const every = labels.length > 8 ? 2 : 1;
  return (
    <g>
      {labels.map((l, i) =>
        i % every === 0 ? (
          <text key={l + i} x={PAD.left + step * (i + 0.5)} y={H - 5} textAnchor="middle" fontSize={8.5} fill={AXIS}>
            {l}
          </text>
        ) : null,
      )}
    </g>
  );
}

function Legend({ items }: { items: { label: string; color: string; ring?: boolean }[] }) {
  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={it.ring ? { boxShadow: `inset 0 0 0 1.5px ${it.color}` } : { backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// Hover/tap target per column, plus the tooltip it drives. The tooltip sits in
// HTML over the SVG at the column's percentage position, flipped to the left
// of the cursor past the midpoint so it never overflows the card.
function useColumns(n: number) {
  const [active, setActive] = useState<number | null>(null);
  const step = PLOT_W / Math.max(n, 1);
  const targets = (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={PAD.left + step * i}
          y={PAD.top}
          width={step}
          height={PLOT_H}
          fill={active === i ? "rgba(255,255,255,0.04)" : "transparent"}
          onMouseEnter={() => setActive(i)}
          onMouseLeave={() => setActive(null)}
          onClick={() => setActive((a) => (a === i ? null : i))}
        />
      ))}
    </g>
  );
  const tooltip = (content: (i: number) => ReactNode) => {
    if (active == null) return null;
    const xPct = ((PAD.left + step * (active + 0.5)) / W) * 100;
    const right = xPct > 50;
    return (
      <div
        className="pointer-events-none absolute top-1 z-10 min-w-[120px] rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px] shadow-lg"
        style={right ? { right: `${100 - xPct + 3}%` } : { left: `${xPct + 3}%` }}
      >
        {content(active)}
      </div>
    );
  };
  return { targets, tooltip, step };
}

function Row({ color, label, value, ring }: { color?: string; label: string; value: string; ring?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1 whitespace-nowrap text-muted">
        {color && (
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={ring ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : { backgroundColor: color }}
          />
        )}
        {label}
      </span>
      <span className="tabular text-text">{value}</span>
    </div>
  );
}

interface BarSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

// Grouped bars on one money axis, 2px gaps between a period's bars.
function GroupedBars({ labels, series, ends }: { labels: string[]; series: BarSeries[]; ends: string[] }) {
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const { targets, tooltip, step } = useColumns(labels.length);
  if (vals.length === 0) return <Empty />;
  const { ticks, y } = niceScale(vals);
  const groupW = Math.min(step * 0.7, 44);
  const gap = 2;
  const barW = (groupW - gap * (series.length - 1)) / series.length;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
        <Axis ticks={ticks} y={y} fmt={fmtMoney} />
        {labels.map((_, i) => {
          const x0 = PAD.left + step * i + (step - groupW) / 2;
          return series.map((s, k) => {
            const v = s.values[i];
            if (v == null) return null;
            return <path key={`${i}-${k}`} d={barPath(x0 + k * (barW + gap), barW, y(0), y(v))} fill={s.color} />;
          });
        })}
        <XLabels labels={labels} />
        {targets}
      </svg>
      {tooltip((i) => (
        <>
          <div className="mb-0.5 font-medium text-text">
            {labels[i]} <span className="font-normal text-muted">· {ends[i]}</span>
          </div>
          {series.map((s) => (
            <Row key={s.label} color={s.color} label={s.label} value={fmtMoney(s.values[i])} />
          ))}
        </>
      ))}
    </div>
  );
}

// Net margin on its own percentage axis, under the performance bars.
function MarginLine({ labels, values }: { labels: string[]; values: (number | null)[] }) {
  const { targets, tooltip, step } = useColumns(labels.length);
  const vals = values.filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const h = 80;
  const inner = h - PAD.top - PAD.bottom;
  const { ticks } = niceScale(vals);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const yy = (v: number) => PAD.top + inner * (1 - (v - lo) / (hi - lo));
  // Zero always shows; an end tick within 12px of it is dropped, not overlapped.
  const shown = [0, lo, hi].filter((t, i, a) => a.indexOf(t) === i && (t === 0 || Math.abs(yy(t) - yy(0)) >= 12));
  const pts = values.map((v, i) => (v == null ? null : { x: PAD.left + step * (i + 0.5), y: yy(v) }));
  let d = "";
  pts.forEach((p, i) => {
    if (!p) return;
    d += `${d && pts[i - 1] ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });
  return (
    <div className="relative mt-1">
      <svg viewBox={`0 0 ${W} ${h}`} className="w-full" role="img" aria-label="Net margin percent">
        {shown.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yy(t)} y2={yy(t)} stroke={t === 0 ? "#52525b" : GRID} strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={PAD.left - 4} y={yy(t) + 3} textAnchor="end" fontSize={8.5} fill={AXIS}>
              {fmtPct(t)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke={ORANGE} strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (p ? <circle key={i} cx={p.x} cy={p.y} r={3} fill={ORANGE} stroke="#121826" strokeWidth={1.5} /> : null))}
        <text x={PAD.left} y={h - 4} fontSize={8.5} fill={AXIS}>
          Net margin
        </text>
        {/* targets span the full chart height, which here is h, not H */}
        <g transform={`scale(1 ${h / H})`}>{targets}</g>
      </svg>
      {tooltip((i) => (
        <>
          <div className="mb-0.5 font-medium text-text">{labels[i]}</div>
          <Row color={ORANGE} label="Net margin" value={fmtPct(values[i])} />
        </>
      ))}
    </div>
  );
}

function Toggle({ value, onChange }: { value: "annual" | "quarterly"; onChange: (v: "annual" | "quarterly") => void }) {
  return (
    <div className="flex rounded-md bg-surface-2 p-0.5 text-[10px] ring-1 ring-inset ring-border">
      {(["annual", "quarterly"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded px-2 py-0.5 capitalize ${value === v ? "bg-surface text-text" : "text-muted"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 p-2">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="text-xs font-medium text-text">{title}</div>
          {note && <div className="truncate text-[10px] text-muted">{note}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="px-1 py-6 text-center text-[11px] text-muted">Not in this company&apos;s filings.</p>;
}

function Performance({ periods, freq, setFreq }: { periods: FinancialPeriod[]; freq: "annual" | "quarterly"; setFreq: (f: "annual" | "quarterly") => void }) {
  const labels = periods.map((p) => p.label);
  return (
    <Panel title="Performance" action={<Toggle value={freq} onChange={setFreq} />}>
      <GroupedBars
        labels={labels}
        ends={periods.map((p) => p.end)}
        series={[
          { label: "Revenue", color: BLUE, values: periods.map((p) => p.revenue) },
          { label: "Net income", color: AQUA, values: periods.map((p) => p.netIncome) },
        ]}
      />
      <MarginLine labels={labels} values={periods.map((p) => p.netMarginPct)} />
      <Legend items={[{ label: "Revenue", color: BLUE }, { label: "Net income", color: AQUA }, { label: "Net margin %", color: ORANGE }]} />
    </Panel>
  );
}

function Debt({ periods, freq, setFreq }: { periods: FinancialPeriod[]; freq: "annual" | "quarterly"; setFreq: (f: "annual" | "quarterly") => void }) {
  return (
    <Panel title="Debt level and coverage" action={<Toggle value={freq} onChange={setFreq} />}>
      <GroupedBars
        labels={periods.map((p) => p.label)}
        ends={periods.map((p) => p.end)}
        series={[
          { label: "Debt", color: ORANGE, values: periods.map((p) => p.debt) },
          { label: "Free cash flow", color: AQUA, values: periods.map((p) => p.freeCashFlow) },
          { label: "Cash", color: BLUE, values: periods.map((p) => p.cash) },
        ]}
      />
      <Legend items={[{ label: "Debt", color: ORANGE }, { label: "Free cash flow", color: AQUA }, { label: "Cash & equivalents", color: BLUE }]} />
    </Panel>
  );
}

// Revenue → net income. Totals stand on the baseline; the steps between them
// float from the previous running total. Color says which: blue total, aqua
// adds, orange subtracts.
function Waterfall({ data }: { data: NonNullable<Financials["waterfall"]> }) {
  type Step = { label: string; value: number; total: boolean };
  const raw: [string, number | null, boolean][] = [
    ["Revenue", data.revenue, true],
    ["COGS", data.costOfRevenue, false],
    ["Gross profit", data.grossProfit, true],
    ["Op expenses", data.operatingExpenses, false],
    ["Op income", data.operatingIncome, true],
    ["Non-op", data.nonOperating, false],
    ["Taxes & other", data.taxesAndOther, false],
    ["Net income", data.netIncome, true],
  ];
  const steps: Step[] = raw.filter(([, v]) => v != null).map(([label, v, total]) => ({ label, value: v as number, total }));
  const { targets, tooltip, step } = useColumns(steps.length);
  if (steps.length < 2) return <Empty />;

  // Running total: a total resets it to its own value; a step adds to it.
  let run = 0;
  const bars = steps.map((s) => {
    const from = s.total ? 0 : run;
    const to = s.total ? s.value : run + s.value;
    run = to;
    return { ...s, from, to };
  });
  const { ticks, y } = niceScale(bars.flatMap((b) => [b.from, b.to]));
  const barW = Math.min(step * 0.62, 34);
  const color = (b: (typeof bars)[number]) => (b.total ? BLUE : b.value >= 0 ? AQUA : ORANGE);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full" role="img" aria-label={`${data.label} revenue to net income`}>
        <Axis ticks={ticks} y={y} fmt={fmtMoney} />
        {bars.map((b, i) => {
          const x = PAD.left + step * i + (step - barW) / 2;
          const next = bars[i + 1];
          return (
            <g key={b.label}>
              <path d={barPath(x, barW, y(b.from), y(b.to))} fill={color(b)} />
              {next && <line x1={x + barW} x2={x + step} y1={y(b.to)} y2={y(b.to)} stroke={AXIS} strokeWidth={0.6} strokeDasharray="2 2" />}
            </g>
          );
        })}
        {/* Two-word labels split onto two lines so eight steps fit a phone width. */}
        {steps.map((s, i) => {
          const [first, ...rest] = s.label.split(" ");
          return (
            <text key={s.label} x={PAD.left + step * (i + 0.5)} y={H - 3} textAnchor="middle" fontSize={8} fill={AXIS}>
              <tspan>{first}</tspan>
              {rest.length > 0 && (
                <tspan x={PAD.left + step * (i + 0.5)} dy={8}>
                  {rest.join(" ")}
                </tspan>
              )}
            </text>
          );
        })}
        {targets}
      </svg>
      {tooltip((i) => (
        <>
          <div className="mb-0.5 font-medium text-text">{bars[i].label}</div>
          <Row color={color(bars[i])} label={data.label} value={fmtMoney(bars[i].value)} />
        </>
      ))}
    </div>
  );
}

function Eps({ eps }: { eps: NonNullable<Financials["eps"]> }) {
  const labels = eps.map((e) => `Q${e.quarter} '${String(e.year).slice(2)}`);
  const { targets, tooltip, step } = useColumns(eps.length);
  const vals = eps.flatMap((e) => [e.actual, e.estimate].filter((v): v is number => v != null));
  if (vals.length === 0) return <Empty />;
  const { ticks, y } = niceScale(vals);
  // A beat is aqua, a miss orange; the tooltip also says which in words.
  const beat = (e: (typeof eps)[number]) => e.actual != null && e.estimate != null && e.actual >= e.estimate;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="EPS actual versus estimate">
        <Axis ticks={ticks} y={y} fmt={(v) => fmtEps(v)} />
        {eps.map((e, i) => {
          const cx = PAD.left + step * (i + 0.5);
          return (
            <g key={labels[i]}>
              {e.estimate != null && <circle cx={cx} cy={y(e.estimate)} r={5} fill="none" stroke={AXIS} strokeWidth={1.5} />}
              {e.actual != null && <circle cx={cx} cy={y(e.actual)} r={5} fill={beat(e) ? AQUA : ORANGE} stroke="#121826" strokeWidth={2} />}
            </g>
          );
        })}
        <XLabels labels={labels} />
        {targets}
      </svg>
      {tooltip((i) => {
        const e = eps[i];
        const surprise = e.actual != null && e.estimate ? ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100 : null;
        return (
          <>
            <div className="mb-0.5 font-medium text-text">
              {labels[i]} <span className="font-normal text-muted">· {e.period}</span>
            </div>
            <Row color={beat(e) ? AQUA : ORANGE} label="Actual" value={fmtEps(e.actual)} />
            <Row color={AXIS} ring label="Estimate" value={fmtEps(e.estimate)} />
            {surprise != null && (
              <div className="mt-0.5 text-muted">
                {beat(e) ? "Beat" : "Missed"} by {fmtPct(Math.abs(surprise))}
              </div>
            )}
          </>
        );
      })}
    </div>
  );
}

function fmtX(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}×`;
}

function fmtMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} '${String(d.getUTCFullYear()).slice(2)}`;
}

// Daily P/E over the chart's own two years of closes. One line on its own
// axis, a dashed line at its median over the same window (the screening
// checklist judges P/E against the stock's own history, not a flat ceiling).
// Median, not mean: one impairment quarter sends GAAP P/E into the hundreds
// for a year (GLW late 2024: ~300× on $0.18 TTM EPS), which pulled its mean
// to 106× while it spent most of the window near 75×,
// and a crosshair tooltip. The axis is capped at 3× the median so a quarter
// of near-zero earnings (P/E in the thousands) doesn't flatten the rest.
function PERatio({ points }: { points: PEPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.map((p) => p.pe).filter((v): v is number => v != null);
  if (vals.length === 0) {
    return <p className="px-1 py-6 text-center text-[11px] text-muted">No P/E: trailing earnings were zero or negative over this window.</p>;
  }
  const sorted = [...vals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const rawMax = sorted[sorted.length - 1];
  const cap = median * 3;
  const capped = rawMax > cap;
  const { ticks, y } = niceScale([capped ? cap : rawMax, sorted[0]], false);
  const top = ticks[ticks.length - 1];
  const yc = (v: number) => y(Math.min(v, top));
  const n = points.length;
  const x = (i: number) => PAD.left + (PLOT_W * i) / Math.max(n - 1, 1);

  let d = "";
  points.forEach((p, i) => {
    if (p.pe == null) return;
    d += `${d && points[i - 1]?.pe != null ? "L" : "M"}${x(i).toFixed(1)},${yc(p.pe).toFixed(1)}`;
  });
  const labelIdx = [0, 1, 2, 3].map((k) => Math.round(((n - 1) * k) / 3));
  const h = hover != null ? points[hover] : null;
  const xPct = hover != null ? (x(hover) / W) * 100 : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label="Price to earnings ratio over time"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const sx = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((sx - PAD.left) / PLOT_W) * (n - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <Axis ticks={ticks} y={y} fmt={(v) => `${v.toFixed(0)}×`} />
        <line x1={PAD.left} x2={W - PAD.right} y1={y(median)} y2={y(median)} stroke={AXIS} strokeWidth={1} strokeDasharray="3 3" />
        <path d={d} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={8.5} fill={AXIS}>
            {fmtMonth(points[i].date)}
          </text>
        ))}
        {h && (
          <g>
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke={AXIS} strokeWidth={0.6} />
            {h.pe != null && <circle cx={x(hover!)} cy={yc(h.pe)} r={4} fill={BLUE} stroke="#121826" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[130px] rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[11px] shadow-lg"
          style={xPct > 50 ? { right: `${100 - xPct + 3}%` } : { left: `${xPct + 3}%` }}
        >
          <div className="mb-0.5 font-medium text-text">{h.date}</div>
          <Row color={BLUE} label="P/E" value={h.pe == null ? "n/a" : fmtX(h.pe)} />
          <Row label="Close" value={`$${h.close.toFixed(2)}`} />
          <Row label="TTM EPS" value={fmtEps(h.ttmEps)} />
        </div>
      )}
      {capped && <p className="px-1 text-[10px] text-muted">Axis capped at {fmtX(top)}; peak was {fmtX(rawMax)}.</p>}
    </div>
  );
}

export function FinancialsPanel({
  data,
  error,
  loading,
  prices,
}: {
  data: Financials | { unavailable: string } | null;
  error: string | null;
  loading: boolean;
  // The chart's own daily closes, so P/E uses the exact prices drawn above.
  prices: { dates: string[]; close: number[] } | null;
}) {
  const [perfFreq, setPerfFreq] = useState<"annual" | "quarterly">("quarterly");
  const [debtFreq, setDebtFreq] = useState<"annual" | "quarterly">("quarterly");
  const ttm = data && "ttmEps" in data ? data.ttmEps : null;
  const pe = useMemo(() => (prices && ttm?.length ? peSeries(prices.dates, prices.close, ttm) : null), [prices, ttm]);

  if (loading && !data) {
    return <Card className="mt-3 px-4 py-6 text-center text-xs text-muted">Loading financials…</Card>;
  }
  if (error) {
    return <Card className="mt-3 px-4 py-4 text-xs text-muted">Financials: {error}</Card>;
  }
  if (!data) return null;
  if ("unavailable" in data) {
    return <Card className="mt-3 px-4 py-4 text-xs text-muted">Financials: {data.unavailable}</Card>;
  }

  const latestPE = pe ? [...pe].reverse().find((p) => p.ttmEps != null) : undefined;
  const peVals = pe?.map((p) => p.pe).filter((v): v is number => v != null) ?? [];
  const peMedian = peVals.length ? [...peVals].sort((a, b) => a - b)[Math.floor(peVals.length / 2)] : null;
  const peNote = latestPE
    ? `Now ${latestPE.pe == null ? "n/a" : fmtX(latestPE.pe)} · 2y median ${fmtX(peMedian)} (dashed) · TTM EPS ${fmtEps(latestPE.ttmEps)}`
    : "Daily close ÷ trailing-year EPS as filed";
  const pick = (f: "annual" | "quarterly") => (f === "annual" ? data.annual : data.quarterly) ?? [];
  const next = data.nextEarnings
    ? `Next earnings ${data.nextEarnings.date}${data.nextEarnings.hour ? ` (${data.nextEarnings.hour})` : ""}`
    : undefined;
  return (
    <Card className="mt-3 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h2 className="text-sm font-semibold">Financials</h2>
        <span className="text-[10px] text-muted">
          {data.entityName} · SEC filings through {data.lastFiled}
        </span>
      </div>
      <div className="grid gap-2">
        <Performance periods={pick(perfFreq)} freq={perfFreq} setFreq={setPerfFreq} />
        <Panel title="Revenue to profit conversion" note={data.waterfall?.label}>
          {data.waterfall ? <Waterfall data={data.waterfall} /> : <Empty />}
          <Legend items={[{ label: "Total", color: BLUE }, { label: "Adds", color: AQUA }, { label: "Subtracts", color: ORANGE }]} />
        </Panel>
        <Debt periods={pick(debtFreq)} freq={debtFreq} setFreq={setDebtFreq} />
        <Panel title="P/E ratio" note={peNote}>
          {pe ? <PERatio points={pe} /> : <p className="px-1 py-6 text-center text-[11px] text-muted">{prices ? "No EPS in this company's filings." : "Waiting for the chart's prices…"}</p>}
        </Panel>
        <Panel title="Earnings per share" note={next ?? "Last four quarters · no forward estimates on the free data tier"}>
          {data.eps && data.eps.length > 0 ? <Eps eps={data.eps} /> : <Empty />}
          <Legend items={[{ label: "Actual (beat)", color: AQUA }, { label: "Actual (miss)", color: ORANGE }, { label: "Estimate", color: AXIS, ring: true }]} />
        </Panel>
      </div>
    </Card>
  );
}
