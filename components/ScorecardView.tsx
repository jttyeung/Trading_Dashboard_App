"use client";

// Suggestion-vs-actual-performance scorecard: grouped by strategy first
// (win rate, count, P&L), then a tap-to-drill-into delta-bucket breakdown
// per strategy — e.g. "0.25-delta CSPs closed at 82% win rate, 0.30-delta
// at 65%". A mirror for spotting your own patterns, same spirit as a
// trade-journal spreadsheet; nothing here feeds back into what the app
// suggests. Aggregation happens entirely client-side, same convention as
// PnlView.tsx's own "By strategy"/"By ticker" breakdowns — this view
// reuses that file's own DivergingBar rather than a second copy of it.
import { useMemo, useState } from "react";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { DivergingBar } from "@/components/PnlView";
import type { MatchedSuggestion } from "@/lib/types";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;

interface Agg {
  key: string;
  label: string;
  count: number;
  wins: number;
  pnl: number;
}

function aggregate(items: MatchedSuggestion[], keyOf: (m: MatchedSuggestion) => string | null, labelOf: (key: string) => string): Agg[] {
  const groups = new Map<string, MatchedSuggestion[]>();
  for (const m of items) {
    const key = keyOf(m);
    if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  return [...groups.entries()]
    .map(([key, ms]) => ({
      key,
      label: labelOf(key),
      count: ms.length,
      wins: ms.filter((m) => m.realizedPnl > 0).length,
      pnl: ms.reduce((s, m) => s + m.realizedPnl, 0),
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

// Dynamic 0.05-wide delta-magnitude bucket rather than a curated list of
// bands, so it naturally only shows buckets a strategy's real trades
// actually touch instead of a fixed set that might not fit every strategy.
function deltaBucketKey(delta: number | null): string | null {
  if (delta === null) return null;
  const lo = Math.floor(Math.abs(delta) / 0.05) * 0.05;
  return lo.toFixed(2);
}
function deltaBucketLabel(key: string): string {
  const lo = parseFloat(key);
  return `${lo.toFixed(2)}–${(lo + 0.05).toFixed(2)}`;
}

function StrategyRow({ agg, matched, maxAbsStrategy }: { agg: Agg; matched: MatchedSuggestion[]; maxAbsStrategy: number }) {
  const [open, setOpen] = useState(false);
  const strategyItems = matched.filter((m) => m.strategy === agg.key);
  const byDelta = useMemo(() => aggregate(strategyItems, (m) => deltaBucketKey(m.delta), deltaBucketLabel), [strategyItems]);
  const maxAbsDelta = byDelta.reduce((m, x) => Math.max(m, Math.abs(x.pnl)), 0);
  const winPct = agg.count > 0 ? Math.round((agg.wins / agg.count) * 100) : 0;

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="block w-full px-4 py-3 text-left active:bg-surface-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{agg.label}</span>
            <span className="tabular rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{agg.count}</span>
          </div>
          <span className={`tabular text-sm font-semibold ${agg.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            <Amt>{signed(agg.pnl)}</Amt>
          </span>
        </div>
        <div className="mt-2">
          <DivergingBar pnl={agg.pnl} maxAbs={maxAbsStrategy} />
        </div>
        <div className="mt-1.5 text-[10px] text-muted">
          {agg.wins}/{agg.count} profitable · {winPct}%
        </div>
      </button>
      {open && (
        <div className="border-t border-border bg-surface-2/30 px-4 py-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">By delta (magnitude)</div>
          {byDelta.length === 0 ? (
            <p className="text-[11px] text-muted">No delta recorded for these suggestions.</p>
          ) : (
            <div className="space-y-2">
              {byDelta.map((d) => {
                const dWinPct = d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0;
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>
                        Δ {d.label} <span className="text-muted">· {d.count}</span>
                      </span>
                      <span className={d.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {dWinPct}% win · <Amt>{signed(d.pnl)}</Amt>
                      </span>
                    </div>
                    <div className="mt-1">
                      <DivergingBar pnl={d.pnl} maxAbs={maxAbsDelta} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScorecardView({ matched, totalSuggestions }: { matched: MatchedSuggestion[]; totalSuggestions: number }) {
  const byStrategy = useMemo(() => aggregate(matched, (m) => m.strategy, (k) => k), [matched]);
  const maxAbsStrategy = byStrategy.reduce((m, b) => Math.max(m, Math.abs(b.pnl)), 0);

  const totalPnl = matched.reduce((s, m) => s + m.realizedPnl, 0);
  const totalWins = matched.filter((m) => m.realizedPnl > 0).length;
  const winRate = matched.length > 0 ? Math.round((totalWins / matched.length) * 100) : 0;

  if (matched.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        No suggested trades matched to a closed position yet — {totalSuggestions} suggestion
        {totalSuggestions === 1 ? "" : "s"} logged so far. This fills in as you take a suggested trade and it closes.
      </Card>
    );
  }

  return (
    <div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Matched suggestions" value={matched.length} sub={`of ${totalSuggestions} ever suggested`} />
        <Stat label="Win rate" value={`${winRate}%`} tone={winRate >= 50 ? "pos" : "neg"} sub={`${totalWins}/${matched.length}`} />
      </div>
      <div className="mt-2">
        <Stat label="Total realized P&L (matched)" value={<Amt>{signed(totalPnl)}</Amt>} tone={totalPnl >= 0 ? "pos" : "neg"} />
      </div>

      <SectionTitle>By strategy</SectionTitle>
      <Card className="divide-y divide-border">
        {byStrategy.map((agg) => (
          <StrategyRow key={agg.key} agg={agg} matched={matched} maxAbsStrategy={maxAbsStrategy} />
        ))}
      </Card>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        Only suggestions you actually traded (matched to a closed position) show up here — tap a strategy for its
        delta breakdown. A mirror for spotting your own patterns; nothing here changes what the app suggests.
      </p>
    </div>
  );
}
