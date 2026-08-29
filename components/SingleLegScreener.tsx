"use client";

// Interactive LEAPS/CC/LONG_PUT/BEAR_MKT_PUT screener — same interaction
// pattern as CspScreener (sort, filter, grouped by ticker → sub-grouped by
// expiration, tap-to-expand with a score breakdown), adapted for these
// strategies' own economics (cost to open a long position rather than
// collateral/yield on a sold one). See lib/single-leg-model.ts for why the
// score itself is leaner than CSP's.
import { useMemo } from "react";
import { usePersistentState } from "@/lib/view-state";
import type { SingleLegCandidate } from "@/lib/types";
import { cost, premium, scoreBand, scoreCandidate } from "@/lib/single-leg-model";
import { fmtMoney } from "@/lib/calc";
import { MiniBar } from "@/components/charts";

type SortKey = "score" | "dte" | "cost" | "delta";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "dte", label: "DTE" },
  { key: "cost", label: "Cost ↑" },
  { key: "delta", label: "Delta" },
];

const STRATEGIES: { key: SingleLegCandidate["strategy"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "LEAPS", label: "LEAPS" },
  { key: "CC", label: "Covered Calls" },
  { key: "LONG_PUT", label: "Long Puts" },
  { key: "BEAR_MKT_PUT", label: "Bear Mkt Puts" },
];

function metric(c: SingleLegCandidate, key: SortKey): number {
  if (key === "dte") return c.dte;
  if (key === "cost") return cost(c);
  if (key === "delta") return Math.abs(c.delta);
  return scoreCandidate(c).total;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtExp(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="tabular text-right">{v}</dd>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
        active ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" : "bg-surface-2 text-muted ring-border active:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function entryNote(c: SingleLegCandidate): string {
  if (c.strategy === "LEAPS" || c.strategy === "LONG_PUT") {
    return `Deep-ITM ${c.putCall === "CALL" ? "call" : "put"} — ${(Math.abs(c.delta) * 100).toFixed(0)}Δ means the position moves close to 1:1 with the stock. Buy-to-open yourself; roll before ~12 months to expiry to stay ahead of theta acceleration.`;
  }
  if (c.strategy === "CC") {
    return "Sell-to-open against shares you already hold (this screen only shows strikes where you own ≥100 shares).";
  }
  return "A bearish hedge — sell-to-open yourself, sized as a small portfolio hedge, not a directional bet.";
}

export function SingleLegScreener({ candidates }: { candidates: SingleLegCandidate[] }) {
  const [sortKey, setSortKey] = usePersistentState<SortKey>("singleleg-sortkey", "score");
  const [strategyKey, setStrategyKey] = usePersistentState<SingleLegCandidate["strategy"] | "all">("singleleg-stratkey", "all");
  const [openId, setOpenId] = usePersistentState<string | null>("singleleg-openid", null);

  const groups = useMemo(() => {
    const rows = candidates.filter((c) => strategyKey === "all" || c.strategy === strategyKey);
    const bySym = new Map<string, SingleLegCandidate[]>();
    for (const c of rows) {
      if (!bySym.has(c.symbol)) bySym.set(c.symbol, []);
      bySym.get(c.symbol)!.push(c);
    }
    const asc = sortKey === "cost";
    const out = [...bySym.entries()].map(([symbol, lines]) => {
      const vals = lines.map((c) => metric(c, sortKey));
      const best = asc ? Math.min(...vals) : Math.max(...vals);
      const byExp = new Map<string, SingleLegCandidate[]>();
      for (const l of lines) {
        if (!byExp.has(l.expiration)) byExp.set(l.expiration, []);
        byExp.get(l.expiration)!.push(l);
      }
      const exps = [...byExp.entries()]
        .map(([expiration, ls]) => ({ expiration, dte: ls[0].dte, lines: ls.sort((a, b) => a.strike - b.strike) }))
        .sort((a, b) => a.dte - b.dte);
      return { symbol, lines, exps, best };
    });
    out.sort((a, b) => (asc ? a.best - b.best : b.best - a.best));
    return out;
  }, [candidates, sortKey, strategyKey]);

  return (
    <div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted">Sort</span>
          {SORTS.map((s) => (
            <Chip key={s.key} active={sortKey === s.key} onClick={() => setSortKey(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted">Strategy</span>
          {STRATEGIES.map((s) => (
            <Chip key={s.key} active={strategyKey === s.key} onClick={() => setStrategyKey(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface px-4 py-5 text-center text-sm text-muted">
          No candidates for this filter right now.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map(({ symbol, lines, exps }) => {
            const top = lines.reduce((a, b) => (scoreCandidate(b).total > scoreCandidate(a).total ? b : a));
            const band = scoreBand(scoreCandidate(top).total);
            const c0 = lines[0];
            return (
              <div key={symbol} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="flex items-center justify-between gap-2 px-4 pt-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{symbol}</span>
                      <span className="truncate text-[11px] text-muted">{c0.name}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      ${c0.underlyingPrice.toFixed(2)} · {c0.sector}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${band.chip}`}>
                    {scoreCandidate(top).total}
                  </span>
                </div>

                {exps.map((eg) => (
                  <div key={eg.expiration} className="border-t border-border">
                    <div className="flex items-center gap-2 px-4 pb-1 pt-2">
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
                        {eg.dte}d
                      </span>
                      <span className="text-[11px] text-muted">{fmtExp(eg.expiration)} expiry</span>
                      <span className="text-[10px] text-muted">· {eg.lines[0].strategy}</span>
                    </div>
                    <div className="grid grid-cols-[1.2fr_0.6fr_1fr_1fr_1.2fr] gap-1 border-b border-border px-4 pb-1 text-[10px] uppercase tracking-wide text-muted">
                      <span>Strike</span>
                      <span className="text-right">Δ</span>
                      <span className="text-right">Cost</span>
                      <span className="text-right">DTE</span>
                      <span className="text-right">Score</span>
                    </div>
                    {eg.lines.map((c) => {
                      const open = openId === c.id;
                      const s = scoreCandidate(c);
                      return (
                        <div key={c.id} className="border-b border-border last:border-0">
                          <button
                            onClick={() => setOpenId(open ? null : c.id)}
                            className="grid w-full grid-cols-[1.2fr_0.6fr_1fr_1fr_1.2fr] items-center gap-1 px-4 py-2.5 text-left active:bg-surface-2"
                          >
                            <span className="tabular text-sm font-medium">${c.strike}</span>
                            <span className="tabular text-right text-xs text-muted">{c.delta.toFixed(2)}</span>
                            <span className="tabular text-right text-xs">{fmtMoney(cost(c), { cents: true })}</span>
                            <span className="tabular text-right text-xs text-muted">{c.dte}d</span>
                            <span className="tabular text-right text-sm font-semibold text-emerald-400">{s.total}</span>
                          </button>

                          {open && (
                            <div className="bg-surface-2/40 px-4 pb-3 pt-2">
                              <dl className="space-y-1.5 text-[11px]">
                                <Row k="Premium" v={`${fmtMoney(premium(c), { cents: true })} (${c.mark.toFixed(2)}/sh × 100)`} />
                                <Row k="Expiry" v={`${c.expiration} · ${c.dte} DTE`} />
                                <Row k="Δ / IV" v={`${c.delta.toFixed(2)} · ${(c.iv * 100).toFixed(0)}%`} />
                                <Row k="Liquidity" v={`OI ${c.openInterest.toLocaleString()} · spread $${(c.ask - c.bid).toFixed(2)}`} />
                                {c.rorPercent !== null && (
                                  <Row k="Cost % of stock" v={`${c.rorPercent.toFixed(1)}%${c.annualizedRorPercent !== null ? ` (${c.annualizedRorPercent.toFixed(1)}% ann.)` : ""}`} />
                                )}
                              </dl>

                              <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Score breakdown</div>
                              <div className="space-y-1">
                                {s.components.map((comp) => (
                                  <div key={comp.key} className="flex items-center gap-2">
                                    <span className="w-20 shrink-0 text-[10px] text-muted">{comp.label}</span>
                                    <div className="flex-1">
                                      <MiniBar
                                        pct={(comp.score ?? 0) / 100}
                                        color={comp.score === null ? "#3a4358" : comp.score >= 70 ? "#34d399" : comp.score >= 45 ? "#60a5fa" : "#fb7185"}
                                      />
                                    </div>
                                    <span className="tabular w-7 shrink-0 text-right text-[10px] text-muted">
                                      {comp.score === null ? "n/a" : Math.round(comp.score)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {c.washSaleWarning && (
                                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-500/20">
                                  <span>⚠️ {c.washSaleWarning}</span>
                                </div>
                              )}

                              <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-500/10 p-2 text-[11px] text-sky-200 ring-1 ring-inset ring-sky-500/20">
                                <span>
                                  <span className="font-semibold">Entry: </span>
                                  {entryNote(c)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
