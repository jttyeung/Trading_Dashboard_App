"use client";

// Outcomes by strategy, with a delta-bucket drill-down, for ONE origin
// at a time: the account holder's real trades (broker-confirmed, matched
// from suggestion_history) on the desktop "My Trades" tab, or the paper
// bots' own resolved picks on the "Bot Scorecard" tab. These used to
// share one view with an All/Real/Paper toggle (Phase 1 of the paper-bot
// feedback-loop plan, "does the bigger paper sample agree with the real
// one"); split per the account holder's own call — "I want my trade
// scorecard to be separate from the bots" — since they answer different
// questions and the union kept reading as one track record.
// Aggregation happens entirely client-side, same convention as
// PnlView.tsx's own "By strategy"/"By ticker" breakdowns — this view
// reuses that file's own DivergingBar rather than a second copy of it. A
// mirror for spotting patterns; nothing here feeds back into what the
// app suggests.
import { useMemo, useState } from "react";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { DivergingBar } from "@/components/PnlView";
import type { PerformanceRow } from "@/lib/types";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;

interface Agg {
  key: string;
  label: string;
  count: number;
  wins: number;
  pnl: number;
}

function aggregate(items: PerformanceRow[], keyOf: (m: PerformanceRow) => string | null, labelOf: (key: string) => string): Agg[] {
  const groups = new Map<string, PerformanceRow[]>();
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
      wins: ms.filter((m) => m.win).length,
      pnl: ms.reduce((s, m) => s + m.realizedPnl, 0),
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

function summarize(rows: PerformanceRow[]) {
  const count = rows.length;
  const wins = rows.filter((r) => r.win).length;
  const pnl = rows.reduce((s, r) => s + r.realizedPnl, 0);
  const winRate = count > 0 ? Math.round((wins / count) * 100) : 0;
  return { count, wins, pnl, winRate };
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

function StrategyRow({ agg, rows, maxAbsStrategy }: { agg: Agg; rows: PerformanceRow[]; maxAbsStrategy: number }) {
  const [open, setOpen] = useState(false);
  const strategyItems = rows.filter((m) => m.strategy === agg.key);
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
            <p className="text-[11px] text-muted">No delta recorded for these trades.</p>
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

export function ScorecardView({
  rows,
  origin,
  totalSuggestions,
}: {
  rows: PerformanceRow[];
  origin: "real" | "paper";
  // totalSuggestions is context for the real view only ("how small a
  // slice of everything ever suggested this is").
  totalSuggestions?: number;
}) {
  const mine = useMemo(() => rows.filter((r) => r.origin === origin), [rows, origin]);
  const summary = useMemo(() => summarize(mine), [mine]);
  const byStrategy = useMemo(() => aggregate(mine, (m) => m.strategy, (k) => k), [mine]);
  const maxAbsStrategy = byStrategy.reduce((m, b) => Math.max(m, Math.abs(b.pnl)), 0);

  if (mine.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        {origin === "real" ? (
          <>
            No suggested trade has closed yet
            {totalSuggestions != null ? ` — ${totalSuggestions} suggestion${totalSuggestions === 1 ? "" : "s"} logged so far` : ""}.
            This fills in when a contract the app suggested shows up in your realized trades.
          </>
        ) : (
          <>No paper-bot pick has resolved yet. This fills in as picks reach expiration.</>
        )}
      </Card>
    );
  }

  return (
    <div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label={origin === "real" ? "Closed trades" : "Resolved picks"}
          value={summary.count}
          tone={summary.pnl >= 0 ? "pos" : "neg"}
          sub={`${summary.winRate}% win · ${signed(summary.pnl)}`}
        />
        {origin === "real" && totalSuggestions != null ? (
          <Stat label="Suggestions logged" value={totalSuggestions} sub="ever, taken or not" />
        ) : (
          <Stat label="Profitable" value={summary.wins} sub={`of ${summary.count}`} tone={summary.wins === summary.count ? "pos" : "default"} />
        )}
      </div>

      <SectionTitle>By strategy</SectionTitle>
      <Card className="divide-y divide-border">
        {byStrategy.map((agg) => (
          <StrategyRow key={agg.key} agg={agg} rows={mine} maxAbsStrategy={maxAbsStrategy} />
        ))}
      </Card>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        {origin === "real"
          ? "Broker-confirmed trades that matched a contract the app suggested — one row per traded contract, under the single-leg strategy that suggested it most. A mirror for spotting your own patterns; nothing here changes what the app suggests."
          : "The paper bots' own simulated outcomes — a much bigger sample than your real trades, but a simplified P&L (no rolls or partial closes). Win means the pick expired worthless or closed profitable."}
      </p>
    </div>
  );
}
