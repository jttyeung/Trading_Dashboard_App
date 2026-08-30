"use client";

// Pre-OTU-vs-S&P-500-vs-actual screen: one chart with all three series over
// the same cutoff-to-today window (Pre-OTU and S&P 500 are exactly
// reconstructable; Actual is a close approximation of the account's real
// activity — see lib/types.ts's BenchmarkFile doc comment for what it can
// and can't capture), plus a direct today's-dollar comparison.
import { Card, SectionTitle, Delta } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { BenchmarkChart } from "@/components/BenchmarkChart";
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
  const { meta, frozen, spy, actual, actualToday } = benchmark;

  if (frozen.length === 0 || spy.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        No benchmark data yet — this fills in once the backend has backfilled price history from{" "}
        {meta.cutoffDate || "the cutoff date"} forward.
      </Card>
    );
  }

  const preOtuToday = frozen[frozen.length - 1].value;
  const preOtuReturn = pctReturn(frozen);
  const spyReturn = pctReturn(spy);
  const actualReturn = pctReturn(actual);
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
        <div className="mt-2">
          <BenchmarkChart
            series={[
              { label: "Pre-OTU", points: frozen, color: PRE_OTU_COLOR },
              { label: "S&P 500", points: spy, color: SPY_COLOR },
              { label: "Actual", points: actual, color: ACTUAL_COLOR },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRE_OTU_COLOR }} />
            Pre-OTU <Delta value={preOtuToday - frozen[0].value} pct={preOtuReturn} />
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
            Actual <Delta value={actualToday - (actual[0]?.value ?? actualToday)} pct={actualReturn} />
          </span>
        </div>
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
