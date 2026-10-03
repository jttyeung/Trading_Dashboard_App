"use client";

// Small dependency-free SVG chart pieces shared by the panels under Chart a
// Ticker (FinancialsPanel, InsiderPanel) and the options volume leaders. Each
// chart uses a fixed viewBox scaled uniformly (no preserveAspectRatio="none"),
// so SVG text stays undistorted and positions can be shared with the HTML
// tooltip as percentages.
import { useState, type ReactNode } from "react";

// Categorical slots 1-3 of the dataviz reference palette, dark steps, checked
// with its validator against --surface (#121826): all pairs pass CVD and
// normal-vision separation and 3:1 contrast.
export const BLUE = "#3987e5";
export const ORANGE = "#d95926";
export const AQUA = "#199e70";
export const AXIS = "#9ca3af";
export const GRID = "#27272a";

export const W = 360;
export const H = 170;
export const PAD = { top: 10, right: 6, bottom: 18, left: 40 };
export const PLOT_W = W - PAD.left - PAD.right;
export const PLOT_H = H - PAD.top - PAD.bottom;

export function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(0)}K`;
  return `${sign}${a.toFixed(0)}`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  return `${v < 0 ? "−" : ""}${a >= 100 || a === 0 ? a.toFixed(0) : a.toFixed(1)}%`;
}

export function fmtEps(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
}

// A "nice" axis: 0 always included, about four steps of 1/2/2.5/5 × 10^n.
export function niceScale(values: number[], includeZero = true) {
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
export function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return `M${x},${y0}h${w}`;
  if (y1 < y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export function Axis({ ticks, y, fmt }: { ticks: number[]; y: (v: number) => number; fmt: (v: number) => string }) {
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

export function XLabels({ labels }: { labels: string[] }) {
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

export function Legend({ items }: { items: { label: string; color: string; ring?: boolean }[] }) {
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
export function useColumns(n: number) {
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

export function Row({ color, label, value, ring }: { color?: string; label: string; value: string; ring?: boolean }) {
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

export function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
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

export function Empty() {
  return <p className="px-1 py-6 text-center text-[11px] text-muted">Not in this company&apos;s filings.</p>;
}

