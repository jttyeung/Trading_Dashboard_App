"use client";

// Phase 1 of the paper-bot feedback-loop plan: real trades (broker-
// confirmed, matched suggestion_history) and paper trades (both bots'
// own resolved simulated outcomes — a much bigger sample, simplified
// P&L) unioned into one comparison, so "does the paper bots' bigger
// sample agree with the smaller real-trade sample" is answerable on one
// screen. Real/Paper summary stats sit side by side always; the Origin
// toggle below controls which set the strategy -> delta-bucket
// drill-down reflects. Aggregation happens entirely client-side, same
// convention as PnlView.tsx's own "By strategy"/"By ticker" breakdowns
// — this view reuses that file's own DivergingBar rather than a second
// copy of it. A mirror for spotting patterns; nothing here feeds back
// into what the app suggests.
import { useMemo, useState } from "react";
import { Card, SectionTitle, Stat } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { DivergingBar } from "@/components/PnlView";
import type { PerformanceRow } from "@/lib/types";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;

type Origin = "all" | "real" | "paper";

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

export function ScorecardView({ rows, totalSuggestions }: { rows: PerformanceRow[]; totalSuggestions: number }) {
  const [origin, setOrigin] = useState<Origin>("all");

  const real = useMemo(() => rows.filter((r) => r.origin === "real"), [rows]);
  const paper = useMemo(() => rows.filter((r) => r.origin === "paper"), [rows]);
  const realSummary = useMemo(() => summarize(real), [real]);
  const paperSummary = useMemo(() => summarize(paper), [paper]);

  const filtered = origin === "all" ? rows : origin === "real" ? real : paper;
  const byStrategy = useMemo(() => aggregate(filtered, (m) => m.strategy, (k) => k), [filtered]);
  const maxAbsStrategy = byStrategy.reduce((m, b) => Math.max(m, Math.abs(b.pnl)), 0);

  if (rows.length === 0) {
    return (
      <Card className="mt-3 px-4 py-6 text-center text-sm text-muted">
        No resolved trades yet — real or paper — {totalSuggestions} suggestion{totalSuggestions === 1 ? "" : "s"} logged
        so far. This fills in as a suggested trade closes (real) or a paper-bot candidate resolves.
      </Card>
    );
  }

  return (
    <div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat
          label="Real trades"
          value={realSummary.count}
          tone={realSummary.count > 0 ? (realSummary.pnl >= 0 ? "pos" : "neg") : "default"}
          sub={realSummary.count > 0 ? `${realSummary.winRate}% win · ${signed(realSummary.pnl)}` : "none yet"}
        />
        <Stat
          label="Paper trades"
          value={paperSummary.count}
          tone={paperSummary.count > 0 ? (paperSummary.pnl >= 0 ? "pos" : "neg") : "default"}
          sub={paperSummary.count > 0 ? `${paperSummary.winRate}% win · ${signed(paperSummary.pnl)}` : "none yet"}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Show
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["all", "real", "paper"] as Origin[]).map((o) => (
            <button
              key={o}
              onClick={() => setOrigin(o)}
              className={`px-2.5 py-1 text-xs font-medium capitalize ${
                origin === o ? "bg-surface-2 text-text" : "bg-transparent text-muted"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <SectionTitle>By strategy{origin !== "all" ? ` (${origin})` : ""}</SectionTitle>
      {byStrategy.length === 0 ? (
        <Card className="px-4 py-6 text-center text-sm text-muted">No {origin} trades yet.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {byStrategy.map((agg) => (
            <StrategyRow key={agg.key} agg={agg} rows={filtered} maxAbsStrategy={maxAbsStrategy} />
          ))}
        </Card>
      )}

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        Real trades are broker-confirmed and actually taken. Paper trades are the wheel bots&apos; own simulated
        outcomes — a much bigger sample, but a simplified P&L (no rolls or partial closes). A mirror for spotting your
        own patterns and checking whether the bigger paper sample agrees with the smaller real one; nothing here
        changes what the app suggests.
      </p>
    </div>
  );
}
