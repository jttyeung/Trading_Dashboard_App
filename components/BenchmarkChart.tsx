// Three-line comparison chart for the frozen-portfolio-vs-S&P-500 view.
// Same hand-rolled inline-SVG technique as InteractiveSparkline/PnlView's
// own charts (no charting library in this repo) — viewBox + preserveAspectRatio
// so it stretches to any width. Unlike a single-series sparkline, each line
// here has a different length/date range, so every series is normalized to
// "% change since its own first point" and plotted against a shared 0..1
// x-axis fraction rather than a raw date scale — the same per-series trend-%
// math HomeHeroSim already does, just applied to more than one series at once.
import type { ValuePoint } from "@/lib/types";

interface Series {
  label: string;
  points: ValuePoint[];
  color: string;
}

function toPctSeries(points: ValuePoint[]): number[] {
  const first = points[0]?.value;
  if (!first) return points.map(() => 0);
  return points.map((p) => (p.value - first) / first);
}

export function BenchmarkChart({ series, width = 360, height = 160 }: { series: Series[]; width?: number; height?: number }) {
  const pad = 6;
  const pctSeries = series.map((s) => toPctSeries(s.points));
  const allPct = pctSeries.flat();
  if (allPct.length === 0) {
    return <p className="text-[11px] text-muted">Not enough data yet to chart.</p>;
  }
  const min = Math.min(0, ...allPct);
  const max = Math.max(0, ...allPct);
  const span = max - min || 1;
  const yv = (pct: number) => pad + (height - pad * 2) * (1 - (pct - min) / span);
  const zeroY = yv(0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" preserveAspectRatio="none" role="img" aria-label="Frozen basket vs. S&P 500 vs. actual portfolio, % change since cutoff">
      {/* zero-line, so "flat" and "up vs. down" are legible at a glance */}
      <line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {series.map((s, si) => {
        const pcts = pctSeries[si];
        const n = pcts.length;
        if (n < 2) return null;
        const stepX = (width - pad * 2) / (n - 1);
        const xi = (i: number) => pad + i * stepX;
        const d = pcts.map((v, i) => `${i === 0 ? "M" : "L"}${xi(i).toFixed(1)},${yv(v).toFixed(1)}`).join(" ");
        return (
          <path
            key={s.label}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

export type { Series as BenchmarkSeries };
