"use client";

// Pre-OTU-vs-S&P-500-vs-actual screen: one chart with all three series over
// the same cutoff-to-today window (Pre-OTU and S&P 500 are exactly
// reconstructable; Actual is a close approximation of the account's real
// activity — see lib/types.ts's BenchmarkFile doc comment for what it can
// and can't capture), plus a direct today's-dollar comparison.
import { useState } from "react";
import { Card, SectionTitle, Delta } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { RangeTabs } from "@/components/RangeTabs";
import { resolveRange, inRange, type RangeKey } from "@/lib/date-range";
import { twrForRange, actualTWRSeries } from "@/lib/benchmark-calc";
import type { BenchmarkFile } from "@/lib/types";

const PRE_OTU_COLOR = "#60a5fa";
const SPY_COLOR = "#a3a3a3";
const ACTUAL_COLOR = "#34d399";

function pctReturn(points: { value: number }[]): number {
  if (points.length === 0) return 0;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  return first ? (last - first) / first : 0;
}

export function BenchmarkView({ benchmark }: { benchmark: BenchmarkFile }) {
  const { meta, frozen, spy, actualToday, actualDailyReturns } = benchmark;
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");

  if (frozen.length === 0 || spy.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        No benchmark data yet — this fills in once the backend has backfilled price history from{" "}
        {meta.cutoffDate || "the cutoff date"} forward.
      </Card>
    );
  }

  const range = resolveRange(rangeKey, Date.now());
  const frozenInRange = frozen.filter((p) => inRange(p.label, range));
  const spyInRange = spy.filter((p) => inRange(p.label, range));
  // Chart-only series: a cumulative-return trajectory (see
  // actualTWRSeries's own doc comment), not actual[]'s raw dollar values
  // -- BenchmarkChart computes its own "% since first point" for both the
  // plotted line's shape and its end-of-line badge, and feeding it raw
  // dollars (still containing the $6,000/$33,000 deposits below) made the
  // chart visually show a misleading spike and a naive % that contradicted
  // the corrected "Actual (time-weighted)" legend text right below it.
  const actualChartSeries = actualTWRSeries(actualDailyReturns, range);

  const preOtuToday = frozen[frozen.length - 1].value;
  const preOtuReturn = pctReturn(frozenInRange);
  const spyReturn = pctReturn(spyInRange);
  // The one line that needs real time-weighting, not a raw start/end
  // comparison: Actual's own dollar values still include any deposit or
  // withdrawal made since the cutoff (see meta.note), so a naive pctReturn
  // here would misread new capital moving in/out as a trading gain/loss.
  // twrForRange geometrically links the already flow-adjusted daily
  // returns instead — see lib/benchmark.ts and the Go side's
  // benchmark.DailyExternalFlow for how a real deposit/withdrawal is told
  // apart from Schwab's own internal cash-sweep noise.
  const actualTWR = twrForRange(actualDailyReturns, range);
  const flowsInRange = actualDailyReturns.filter((r) => r.externalFlow !== 0 && inRange(r.date, range));
  const gapVsPreOtu = actualToday - preOtuToday;
  const gapVsPreOtuPct = preOtuToday > 0 ? gapVsPreOtu / preOtuToday : 0;

  const holdingCount = Object.keys(meta.frozenHoldings).length;

  return (
    <div>
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        If you'd frozen every account exactly as it stood on <span className="font-medium text-text">{meta.cutoffDate}</span> —{" "}
        {holdingCount} holdings + cash, no more trades, no options, ever — here's what that basket (Pre-OTU) would be
        worth today, tracked against the S&amp;P 500 and your real, actively-traded account.
      </p>

      <Card className="mt-3 px-4 py-4">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Since {meta.cutoffDate}</span>
        </div>
        <RangeTabs value={rangeKey} onChange={setRangeKey} />
        <div className="mt-2">
          <BenchmarkChart
            series={[
              { label: "Pre-OTU", points: frozenInRange, color: PRE_OTU_COLOR },
              { label: "S&P 500", points: spyInRange, color: SPY_COLOR },
              { label: "Actual", points: actualChartSeries, color: ACTUAL_COLOR },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRE_OTU_COLOR }} />
            Pre-OTU{" "}
            <Delta
              value={frozenInRange.length ? preOtuToday - frozenInRange[0].value : 0}
              pct={preOtuReturn}
            />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SPY_COLOR }} />
            S&amp;P 500 <span className={`tabular font-medium ${spyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {spyReturn >= 0 ? "+" : "−"}
              {Math.abs(spyReturn * 100).toFixed(1)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACTUAL_COLOR }} />
            Actual (time-weighted){" "}
            <span className={`tabular font-medium ${actualTWR >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {actualTWR >= 0 ? "+" : "−"}
              {Math.abs(actualTWR * 100).toFixed(1)}%
            </span>
          </span>
        </div>
        {flowsInRange.length > 0 && (
          <div className="mt-3 border-t border-border pt-2 text-[10px] text-muted">
            <div className="mb-1 uppercase tracking-wide">Deposits/withdrawals excluded from the time-weighted return</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {flowsInRange.map((f) => (
                <span key={f.date} className="tabular">
                  {f.date}: {f.externalFlow > 0 ? "+" : "−"}
                  <Amt>{fmtMoney(Math.abs(f.externalFlow))}</Amt>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <SectionTitle>Pre-OTU vs. actual, today</SectionTitle>
      <Card className="grid grid-cols-2 divide-x divide-border">
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted">Pre-OTU</div>
          <div className="tabular mt-1 text-lg font-bold">
            <Amt>{fmtMoney(preOtuToday)}</Amt>
          </div>
          <div className="mt-0.5 text-[10px] text-muted">untouched since {meta.cutoffDate}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted">Your actual portfolio</div>
          <div className="tabular mt-1 text-lg font-bold">
            <Amt>{fmtMoney(actualToday)}</Amt>
          </div>
          <div className="mt-0.5 text-[10px]">
            <Delta value={gapVsPreOtu} pct={gapVsPreOtuPct} />
            <span className="ml-1 text-muted">vs. Pre-OTU</span>
          </div>
        </div>
      </Card>
      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted">{meta.note}</p>
    </div>
  );
}
