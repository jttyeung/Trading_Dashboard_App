"use client";

// Frozen-portfolio-vs-S&P-500 screen: a static Frozen-vs-SPY chart (both
// fully reconstructable historical series, normalized to "% since cutoff"),
// a direct today's-dollar-value comparison (frozen basket vs. your real
// account), and a short forward-only "actual" tail that fills in over time.
// Actual isn't overlaid on the normalized chart — its own first data point
// is from whenever this feature started collecting, not from cutoffDate, so
// plotting it on the same 0%-at-cutoff axis as Frozen/SPY would misleadingly
// show it starting flat. See lib/types.ts's BenchmarkFile doc comment.
import { Card, SectionTitle, Delta } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { BenchmarkChart } from "@/components/BenchmarkChart";
import { InteractiveSparkline } from "@/components/InteractiveSparkline";
import type { BenchmarkFile } from "@/lib/types";

const ACTUAL_GROWING_MIN_POINTS = 5;

export function BenchmarkView({ benchmark }: { benchmark: BenchmarkFile }) {
  const { meta, frozen, spy, actualToday, actualGrowing } = benchmark;

  if (frozen.length === 0 || spy.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        No benchmark data yet — this fills in once the backend has backfilled price history from{" "}
        {meta.cutoffDate || "the cutoff date"} forward.
      </Card>
    );
  }

  const frozenToday = frozen[frozen.length - 1].value;
  const frozenReturn = (frozenToday - frozen[0].value) / frozen[0].value;
  const spyReturn = (spy[spy.length - 1].value - spy[0].value) / spy[0].value;
  const gapVsFrozen = actualToday - frozenToday;
  const gapVsFrozenPct = frozenToday > 0 ? gapVsFrozen / frozenToday : 0;

  const holdingCount = Object.keys(meta.frozenHoldings).length;

  return (
    <div>
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        If you'd frozen every account exactly as it stood on <span className="font-medium text-text">{meta.cutoffDate}</span> —{" "}
        {holdingCount} holdings + cash, no more trades, no options, ever — here's what that basket would be worth
        today, tracked against the S&amp;P 500 and your real, actively-traded account.
      </p>

      <Card className="mt-3 px-4 py-4">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Since {meta.cutoffDate}</span>
        </div>
        <div className="mt-2">
          <BenchmarkChart
            series={[
              { label: "Frozen basket", points: frozen, color: "#60a5fa" },
              { label: "S&P 500", points: spy, color: "#a3a3a3" },
            ]}
          />
        </div>
        <div className="mt-3 flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#60a5fa" }} />
            Frozen basket <Delta value={frozenToday - frozen[0].value} pct={frozenReturn} />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#a3a3a3" }} />
            S&amp;P 500 <span className={`tabular font-medium ${spyReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {spyReturn >= 0 ? "+" : "−"}
              {Math.abs(spyReturn * 100).toFixed(1)}%
            </span>
          </span>
        </div>
      </Card>

      <SectionTitle>Frozen vs. actual, today</SectionTitle>
      <Card className="grid grid-cols-2 divide-x divide-border">
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted">Frozen basket</div>
          <div className="tabular mt-1 text-lg font-bold">
            <Amt>{fmtMoney(frozenToday)}</Amt>
          </div>
          <div className="mt-0.5 text-[10px] text-muted">untouched since {meta.cutoffDate}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted">Your actual portfolio</div>
          <div className="tabular mt-1 text-lg font-bold">
            <Amt>{fmtMoney(actualToday)}</Amt>
          </div>
          <div className="mt-0.5 text-[10px]">
            <Delta value={gapVsFrozen} pct={gapVsFrozenPct} />
            <span className="ml-1 text-muted">vs. frozen</span>
          </div>
        </div>
      </Card>
      <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted">{meta.note}</p>

      <SectionTitle>Actual portfolio, tracked forward</SectionTitle>
      <Card className="px-4 py-3">
        {actualGrowing.length >= ACTUAL_GROWING_MIN_POINTS ? (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span>Since {actualGrowing[0].label}</span>
              <span>{actualGrowing.length} days recorded</span>
            </div>
            <div className="mt-2">
              <InteractiveSparkline data={actualGrowing} positive={actualGrowing[actualGrowing.length - 1].value >= actualGrowing[0].value} />
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted">
            Building — {actualGrowing.length} of {ACTUAL_GROWING_MIN_POINTS} days recorded so far. Real options
            positions can't be reconstructed historically, so this line only starts from when this feature began
            tracking, not from {meta.cutoffDate}.
          </p>
        )}
      </Card>
    </div>
  );
}
