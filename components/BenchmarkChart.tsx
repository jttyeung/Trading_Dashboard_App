// Three-line comparison chart for the Pre-OTU-vs-S&P-500-vs-actual view.
// Same hand-rolled inline-SVG technique as InteractiveSparkline/PnlView's
// own charts (no charting library in this repo) — viewBox + preserveAspectRatio
// so the line paths stretch to any width. Every series is normalized to "%
// change since its own first point" and plotted against a shared 0..1
// x-axis fraction rather than a raw date scale — the same per-series trend-%
// math HomeHeroSim already does, just applied to three series at once.
//
// Axis ticks, the end-of-line value labels, and the end dots are HTML
// overlays positioned by percentage (not native SVG text/circles) — same
// reason InteractiveSparkline's own crosshair dot is an overlay: a glyph or
// circle inside a non-uniformly-stretched SVG distorts, a plain positioned
// div never does.
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

function fmtPct(pct: number): string {
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct * 100).toFixed(1)}%`;
}

function fmtAxisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function BenchmarkChart({ series, width = 360, height = 200 }: { series: Series[]; width?: number; height?: number }) {
  const padTop = 8;
  const padBottom = 8;
  const padX = 4;

  const pctSeries = series.map((s) => toPctSeries(s.points));
  const allPct = pctSeries.flat();
  if (allPct.length === 0) {
    return <p className="text-[11px] text-muted">Not enough data yet to chart.</p>;
  }
  const min = Math.min(0, ...allPct);
  const max = Math.max(0, ...allPct);
  const span = max - min || 1;
  const plotH = height - padTop - padBottom;
  const yv = (pct: number) => padTop + plotH * (1 - (pct - min) / span);
  const yPct = (pct: number) => (yv(pct) / height) * 100;
  const zeroY = yv(0);

  const ticks = Array.from(new Set([min, 0, max].map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => b - a);

  const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]);
  const firstDate = longest.points[0]?.label;
  const lastDate = longest.points[longest.points.length - 1]?.label;

  return (
    <div className="relative pl-9 pr-14">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Pre-OTU basket vs. S&P 500 vs. actual portfolio, % change since cutoff"
      >
        {ticks.map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={yv(t)}
            y2={yv(t)}
            stroke="currentColor"
            strokeOpacity={t === 0 ? 0.18 : 0.08}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {series.map((s, si) => {
          const pcts = pctSeries[si];
          const n = pcts.length;
          if (n < 2) return null;
          const stepX = (width - padX * 2) / (n - 1);
          const xi = (i: number) => padX + i * stepX;
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

      {/* y-axis %-labels, left overlay */}
      {ticks.map((t) => (
        <div
          key={t}
          className="pointer-events-none absolute left-0 -translate-y-1/2 whitespace-nowrap text-[9px] tabular text-muted"
          style={{ top: `${yPct(t)}%` }}
        >
          {fmtPct(t)}
        </div>
      ))}

      {/* x-axis date labels, bottom overlay */}
      {firstDate && <div className="pointer-events-none absolute bottom-[-16px] left-0 text-[9px] text-muted">{fmtAxisDate(firstDate)}</div>}
      {lastDate && <div className="pointer-events-none absolute bottom-[-16px] right-14 text-[9px] text-muted">{fmtAxisDate(lastDate)}</div>}

      {/* end-of-line value labels + dots, right overlay */}
      {series.map((s, si) => {
        const pcts = pctSeries[si];
        if (pcts.length === 0) return null;
        const lastPct = pcts[pcts.length - 1];
        return (
          <div
            key={s.label}
            className="pointer-events-none absolute right-0 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap text-[10px] font-semibold"
            style={{ top: `${yPct(lastPct)}%`, color: s.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {fmtPct(lastPct)}
          </div>
        );
      })}
    </div>
  );
}

export type { Series as BenchmarkSeries };
