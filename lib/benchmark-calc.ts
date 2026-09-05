// Pure, environment-agnostic benchmark math -- deliberately its own module,
// separate from lib/benchmark.ts's server-only data loader (which touches
// fs/next-headers via example-mode.ts). BenchmarkView.tsx is a "use client"
// component, and importing anything from lib/benchmark.ts there pulls its
// whole module graph -- next/headers included -- into the client bundle,
// which Next.js rejects outright. Confirmed live: this exact import caused
// a real 500 on /benchmark before this file was split out.
import type { BenchmarkFile, ValuePoint } from "./types";
import { inRange, type Range } from "./date-range";

// twrForRange geometrically links every daily return falling inside range
// into one time-weighted return for that window -- the real, deposit/
// withdrawal-adjusted alternative to a raw (last-first)/first comparison on
// actual[]'s own dollar values. Reuses the same Range/inRange shape as
// every other closed-history filter in this app (see date-range.ts), so it
// plugs directly into RangeTabs' existing RANGES/resolveRange. Returns 0
// for an empty/no-match window.
export function twrForRange(dailyReturns: BenchmarkFile["actualDailyReturns"], range: Range): number {
  let product = 1;
  for (const r of dailyReturns) {
    if (inRange(r.date, range)) product *= 1 + r.return;
  }
  return product - 1;
}

// actualTWRSeries builds a cumulative-return value series (starting at
// 100, compounding by each day's already flow-adjusted return) for
// BenchmarkChart to plot in place of Actual's own raw dollar values.
// BenchmarkChart computes its own displayed % (both the plotted line's
// shape and its end-of-line badge/axis label) as "% change since this
// series' own first point" -- feeding it the RAW actual[] dollar values
// means that internal calc re-derives the same un-adjusted number
// twrForRange exists to correct, so the chart visually contradicts its
// own legend. Feeding it this cumulative series instead means
// BenchmarkChart's identical "% since first point" math lands on the
// exact same number as twrForRange for the same range, by construction
// (a cumulative-product series' own start/end % change over N days IS
// the geometric link of those N daily returns) -- one calculation, shown
// consistently everywhere on the page, not two that can disagree.
export function actualTWRSeries(dailyReturns: BenchmarkFile["actualDailyReturns"], range: Range): ValuePoint[] {
  let cum = 100;
  const points: ValuePoint[] = [];
  for (const r of dailyReturns) {
    if (!inRange(r.date, range)) continue;
    cum *= 1 + r.return;
    points.push({ label: r.date, value: cum });
  }
  return points;
}
