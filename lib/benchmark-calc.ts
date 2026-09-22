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

// One calendar month's time-weighted return next to the three raw dollar
// figures that explain it. TWR is the only one of the four a deposit can't
// flatter -- navChange happily counts a $33,000 transfer in as a gain --
// which is exactly why they're shown together: netFlows names the money
// that moved, navGrowthExFlows is what's left once it's backed out, and
// twr is that same story as a percentage the month's starting size can't
// distort.
export interface MonthPerformance {
  key: string; // YYYY-MM
  twr: number;
  navStart: number; // the prior month's closing value -- see monthlyPerformance
  navEnd: number;
  navChange: number; // navEnd - navStart, deposits/withdrawals included
  netFlows: number; // real deposits (+) and withdrawals (-) detected that month
  navGrowthExFlows: number; // navChange - netFlows, the dollar twin of twr
}

// monthlyPerformance slices the same already flow-adjusted daily return
// series twrForRange consumes into one entry per calendar month, so a
// month-by-month track record reads off the identical numbers the
// Benchmark page's range tabs show -- geometrically linking a month's
// entries here and selecting that month there are the same arithmetic on
// the same inputs, not a second definition that can drift.
//
// actual supplies the NAV dollars (it's the very series the returns were
// derived from), matched by date rather than by index so a gap in either
// series can't silently shift a month's start value by a day.
//
// A month's navStart is deliberately the LAST value before it -- the prior
// month's close -- so navChange spans exactly what twr does. The series'
// first month has no prior close, but its first day's return is 0 by
// construction (the Go side's DailyReturns has no earlier value to compare
// against either), so anchoring that month on its own opening value leaves
// the two consistent rather than double-counting a day.
export function monthlyPerformance(
  dailyReturns: BenchmarkFile["actualDailyReturns"],
  actual: ValuePoint[],
): MonthPerformance[] {
  const valueByDate = new Map(actual.map((p) => [p.label, p.value]));
  const out: MonthPerformance[] = [];
  let prevValue: number | null = null;
  let key = "";
  let product = 1;
  let navStart = 0;
  let navEnd = 0;
  let netFlows = 0;

  const closeMonth = () => {
    if (!key) return;
    const navChange = navEnd - navStart;
    out.push({ key, twr: product - 1, navStart, navEnd, navChange, netFlows, navGrowthExFlows: navChange - netFlows });
  };

  for (const r of dailyReturns) {
    // Carry the last known value forward rather than dropping the day: a
    // missing NAV point costs that day's dollar precision, but its return
    // is still a real return and belongs in the link.
    const value: number | null = valueByDate.get(r.date) ?? prevValue;
    if (value == null) continue; // nothing to anchor on yet
    const monthKey = r.date.slice(0, 7);
    if (monthKey !== key) {
      closeMonth();
      key = monthKey;
      product = 1;
      netFlows = 0;
      navStart = prevValue ?? value;
    }
    product *= 1 + r.return;
    netFlows += r.externalFlow;
    navEnd = value;
    prevValue = value;
  }
  closeMonth();
  return out;
}
