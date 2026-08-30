"use client";

// Interactive spread/PMCC screener — same interaction pattern as
// CspScreener/SingleLegScreener (sort, filter, grouped by ticker →
// sub-grouped by expiration, tap-to-expand), adapted for multi-leg
// economics: two strikes per row (four for iron condor), max
// profit/loss/breakeven instead of collateral/yield, and PMCC's own
// second expiration for its LEAPS leg.
import { useMemo } from "react";
import { usePersistentState } from "@/lib/view-state";
import type { SpreadCandidate, SpreadStrategy } from "@/lib/types";
import { scoreBand, scoreCandidate } from "@/lib/spread-model";
import { fmtMoney } from "@/lib/calc";
import { MiniBar } from "@/components/charts";

type SortKey = "score" | "dte" | "ror" | "risk";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "dte", label: "DTE" },
  { key: "ror", label: "ROR %" },
  { key: "risk", label: "Max loss ↑" },
];

const STRATEGIES: { key: SpreadStrategy | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "BULL_PUT", label: "Bull Put" },
  { key: "BEAR_CALL", label: "Bear Call" },
  { key: "IRON_CONDOR", label: "Iron Condor" },
  { key: "BULL_CALL", label: "Bull Call" },
  { key: "BEAR_PUT", label: "Bear Put" },
  { key: "PMCC", label: "PMCC" },
];

function metric(c: SpreadCandidate, key: SortKey): number {
  if (key === "dte") return c.dte;
  if (key === "ror") return c.rorPercent ?? 0;
  if (key === "risk") return c.maxLoss ?? Infinity;
  return scoreCandidate(c).total;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtExp(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function strikesLabel(c: SpreadCandidate): string {
  const hasPut = c.putShortStrike !== null || c.putLongStrike !== null;
  const hasCall = c.callShortStrike !== null || c.callLongStrike !== null;
  if (hasPut && hasCall) {
    // iron condor
    return `${c.putLongStrike}/${c.putShortStrike}P · ${c.callShortStrike}/${c.callLongStrike}C`;
  }
  if (hasPut) return `${c.putShortStrike}/${c.putLongStrike}P`;
  return `${c.callShortStrike}/${c.callLongStrike}C`;
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

export function SpreadScreener({ candidates }: { candidates: SpreadCandidate[] }) {
  const [sortKey, setSortKey] = usePersistentState<SortKey>("spread-sortkey", "score");
  const [strategyKey, setStrategyKey] = usePersistentState<SpreadStrategy | "all">("spread-stratkey", "all");
  const [openId, setOpenId] = usePersistentState<string | null>("spread-openid", null);

  const groups = useMemo(() => {
    const rows = candidates.filter((c) => strategyKey === "all" || c.strategy === strategyKey);
    const bySym = new Map<string, SpreadCandidate[]>();
    for (const c of rows) {
      if (!bySym.has(c.symbol)) bySym.set(c.symbol, []);
      bySym.get(c.symbol)!.push(c);
    }
    const asc = sortKey === "risk";
    const out = [...bySym.entries()].map(([symbol, lines]) => {
      const vals = lines.map((c) => metric(c, sortKey)).filter((v) => isFinite(v));
      const best = vals.length ? (asc ? Math.min(...vals) : Math.max(...vals)) : asc ? Infinity : -Infinity;
      const byExp = new Map<string, SpreadCandidate[]>();
      for (const l of lines) {
        if (!byExp.has(l.expiration)) byExp.set(l.expiration, []);
        byExp.get(l.expiration)!.push(l);
      }
      const exps = [...byExp.entries()]
        .map(([expiration, ls]) => ({ expiration, dte: ls[0].dte, lines: ls }))
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
                      {c0.underlyingPrice > 0 ? `$${c0.underlyingPrice.toFixed(2)}` : ""} {c0.sector}
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
                    </div>
                    <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_1.2fr] gap-1 border-b border-border px-4 pb-1 text-[10px] uppercase tracking-wide text-muted">
                      <span>Strikes</span>
                      <span className="text-right">Net</span>
                      <span className="text-right">DTE</span>
                      <span className="text-right">ROR%</span>
                      <span className="text-right">Score</span>
                    </div>
                    {eg.lines.map((c) => {
                      const open = openId === c.id;
                      const s = scoreCandidate(c);
                      return (
                        <div key={c.id} className="border-b border-border last:border-0">
                          <button
                            onClick={() => setOpenId(open ? null : c.id)}
                            className="grid w-full grid-cols-[1.4fr_1fr_0.8fr_1fr_1.2fr] items-center gap-1 px-4 py-2.5 text-left active:bg-surface-2"
                          >
                            <span className="tabular text-xs font-medium">
                              {strikesLabel(c)}
                              {c.strategy === "PMCC" && c.longExpiration && (
                                <span className="ml-1 text-[10px] text-muted">→ {fmtExp(c.longExpiration)}</span>
                              )}
                              {c.washSaleWarning && (
                                <span className="ml-1 text-amber-400" title="Possible wash sale — see details">⚠️</span>
                              )}
                            </span>
                            <span className="tabular text-right text-xs">
                              {c.isCredit ? "+" : "−"}
                              {fmtMoney(c.netPremium * 100, { cents: true })}
                            </span>
                            <span className="tabular text-right text-xs text-muted">{c.dte}d</span>
                            <span className="tabular text-right text-sm font-semibold text-emerald-400">
                              {c.rorPercent !== null ? `${c.rorPercent.toFixed(0)}%` : "—"}
                            </span>
                            <span className="tabular text-right text-xs font-medium">{s.total}</span>
                          </button>

                          {open && (
                            <div className="bg-surface-2/40 px-4 pb-3 pt-2">
                              <dl className="space-y-1.5 text-[11px]">
                                <Row k="Net" v={`${c.isCredit ? "Credit" : "Debit"} $${(c.netPremium * 100).toFixed(0)}`} />
                                <Row k="Max profit / Max loss" v={`${c.maxProfit !== null ? fmtMoney(c.maxProfit, { cents: true }) : "—"} / ${c.maxLoss !== null ? fmtMoney(c.maxLoss, { cents: true }) : "—"}`} />
                                {c.breakeven !== null && <Row k="Breakeven" v={`$${c.breakeven.toFixed(2)}${c.strategy === "IRON_CONDOR" ? " (lower side only)" : ""}`} />}
                                {c.width !== null && <Row k="Width" v={`$${c.width}`} />}
                                <Row k="Expiry" v={`${c.expiration} · ${c.dte} DTE`} />
                                {c.strategy === "PMCC" && c.longExpiration && (
                                  <Row k="LEAPS leg expiry" v={`${c.longExpiration} · ${c.longDte} DTE`} />
                                )}
                              </dl>

                              <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">Score breakdown</div>
                              <div className="space-y-1">
                                {s.components.map((comp) => (
                                  <div key={comp.key} className="flex items-center gap-2">
                                    <span className="w-24 shrink-0 text-[10px] text-muted">{comp.label}</span>
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
                                  {c.isCredit ? "Sell-to-open" : "Buy-to-open"} yourself; verify no earnings/ex-div before {c.expiration}.
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
