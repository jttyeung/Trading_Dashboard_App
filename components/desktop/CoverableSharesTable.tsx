"use client";

import { Fragment, useMemo, useState } from "react";
import type { CoveredCallQuote, Equity } from "@/lib/types";
import { daysToExpiry, fmtMoney, fmtPct } from "@/lib/calc";
import { KEEP_BATCH_FRACTION, SHELTERED, clearsCost, spansEarnings } from "@/lib/theta-goal";
import type { SourcedOption } from "@/components/desktop/PositionsTable";

// A holding tagged with its real account, built the same way the page builds
// SourcedOption (per real account, never the "combined" bucket).
export type SourcedEquity = Equity & { sourceLabel: string };

interface Row {
  key: string;
  e: SourcedEquity;
  lots: number;
  covered: number; // contracts already written against these shares, this account
  open: number;
  // "keep": a taxable holding with a gain — the ~10Δ far rungs, a third of the
  // open lots at a time (the same rule as the Brief's theta-goal plan, which this
  // reuses rather than re-deriving). "near": everything else, the ~30Δ ladder.
  mode: "keep" | "near";
  suggestN: number;
  near: CoveredCallQuote[];
  far: CoveredCallQuote[];
  best: CoveredCallQuote | null;
  belowCost: boolean; // every quoted rung is struck under the shares' cost
  report: string | undefined; // next earnings date, if known
}

// The ladder's dte was counted when the snapshot was written; recount from the
// expiration so a weekend-old ladder doesn't read a day or two long, and drop a
// rung that has expired since.
function liveRungs(rungs: CoveredCallQuote[] | undefined): CoveredCallQuote[] {
  return (rungs ?? [])
    .map((c) => (c.expiration ? { ...c, dte: daysToExpiry(c.expiration) } : c))
    .filter((c) => c.dte > 0 && c.mark > 0);
}

function buildRows(equities: SourcedEquity[], options: SourcedOption[], earnings: Record<string, string>): Row[] {
  const covered = new Map<string, number>();
  for (const o of options) {
    if (o.optionType !== "call" || o.side !== "short") continue;
    if (daysToExpiry(o.expiration) < 0) continue; // a weekend snapshot still lists Friday's
    const k = `${o.sourceLabel}|${o.symbol.toUpperCase()}`;
    covered.set(k, (covered.get(k) ?? 0) + o.qty);
  }
  const rows: Row[] = [];
  for (const e of equities) {
    const lots = Math.floor(e.qty / 100);
    if (lots < 1) continue;
    const sym = e.symbol.toUpperCase();
    const c = Math.min(lots, covered.get(`${e.sourceLabel}|${sym}`) ?? 0);
    const open = lots - c;
    const keep = !SHELTERED.test(e.sourceLabel) && e.avgCost > 0 && e.price > e.avgCost;
    const near = liveRungs(e.coveredCalls);
    const far = liveRungs(e.farCalls);
    const report = earnings[sym];
    // Best theta per day among rungs at or above cost that don't span earnings —
    // same pick as uncoveredLots in lib/theta-goal.ts, so the Brief and this table agree.
    const rungs = keep ? far : near;
    const aboveCost = rungs.filter((q) => clearsCost(q, e.avgCost));
    const clear = aboveCost.filter((q) => !spansEarnings(q, report));
    const best = clear.length ? clear.reduce((b, q) => (q.mark / q.dte > b.mark / b.dte ? q : b)) : null;
    rows.push({
      key: `${e.sourceLabel}|${sym}`,
      e,
      lots,
      covered: c,
      open,
      mode: keep ? "keep" : "near",
      suggestN: keep ? Math.ceil(open * KEEP_BATCH_FRACTION) : open,
      near,
      far,
      best,
      belowCost: rungs.length > 0 && aboveCost.length === 0,
      report,
    });
  }
  // Shares with lots still open first (that's the actionable part), then by symbol.
  return rows.sort((a, b) => Number(b.open > 0) - Number(a.open > 0) || a.e.symbol.localeCompare(b.e.symbol));
}

function fmtExp(iso: string | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Holdings of 100+ shares, one row per account, with how many lots already
// carry a short call and an expandable covered-call ladder for each. Suggest
// only — nothing here places an order.
export function CoverableSharesTable({
  equities,
  options,
  earnings,
}: {
  equities: SourcedEquity[];
  options: SourcedOption[];
  earnings: Record<string, string>;
}) {
  const rows = useMemo(() => buildRows(equities, options, earnings), [equities, options, earnings]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.key));
  const openLots = rows.reduce((s, r) => s + r.open, 0);

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Shares to Cover</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">{rows.length}</span>
        </div>
        <span className="text-xs text-muted">
          {openLots} {openLots === 1 ? "lot" : "lots"} with no call written · ideas only, nothing is placed
        </span>
        <button
          onClick={() => setOpen(allOpen ? new Set() : new Set(rows.map((r) => r.key)))}
          className="ml-auto rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Ticker</th>
            <th className="px-3 py-2 text-right font-medium">Shares</th>
            <th className="px-3 py-2 text-right font-medium">Lots</th>
            <th className="px-3 py-2 text-right font-medium">Covered</th>
            <th className="px-3 py-2 text-right font-medium">Open</th>
            <th className="px-3 py-2 text-right font-medium">Avg cost</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">Gain</th>
            <th className="px-3 py-2 font-medium">Suggested call</th>
            <th className="px-3 py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = open.has(r.key);
            const gain = r.e.avgCost > 0 ? (r.e.price - r.e.avgCost) / r.e.avgCost : null;
            return (
              <Fragment key={r.key}>
                <tr
                  onClick={() => toggle(r.key)}
                  className={`cursor-pointer border-b border-border/60 hover:bg-surface-2/40 ${r.open === 0 ? "opacity-60" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-text">
                    <span className={`mr-1.5 inline-block text-[10px] text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`}>▾</span>
                    {r.e.symbol}
                  </td>
                  <td className="px-3 py-2 text-right tabular text-text">{r.e.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right tabular text-text">{r.lots}</td>
                  <td className="px-3 py-2 text-right tabular text-text">{r.covered}</td>
                  <td className={`px-3 py-2 text-right tabular font-semibold ${r.open > 0 ? "text-pos" : "text-muted"}`}>{r.open}</td>
                  <td className="px-3 py-2 text-right tabular text-text">{fmtMoney(r.e.avgCost, { cents: true })}</td>
                  <td className="px-3 py-2 text-right tabular text-text">{fmtMoney(r.e.price, { cents: true })}</td>
                  <td className={`px-3 py-2 text-right tabular ${gain == null ? "text-muted" : gain >= 0 ? "text-pos" : "text-neg"}`}>
                    {gain == null ? "-" : fmtPct(gain, 1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    <SuggestedCell r={r} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.e.sourceLabel}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border/60 bg-surface-2/30">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="grid gap-4 lg:grid-cols-2">
                        {/* The ladder the rule picks for this holding goes first. */}
                        {r.mode === "keep" ? (
                          <>
                            <Ladder title={FAR_TITLE} rungs={r.far} primary r={r} />
                            <Ladder title={NEAR_TITLE} rungs={r.near} primary={false} r={r} />
                          </>
                        ) : (
                          <>
                            <Ladder title={NEAR_TITLE} rungs={r.near} primary r={r} />
                            <Ladder title={FAR_TITLE} rungs={r.far} primary={false} r={r} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const NEAR_TITLE = "Near · ~30Δ, 1–4 weeks";
const FAR_TITLE = "Keep the shares · ~10Δ, 4–6 weeks";

function SuggestedCell({ r }: { r: Row }) {
  if (r.open === 0) return <span className="text-muted">Fully covered</span>;
  if (!r.best) {
    if (r.belowCost) return <span className="text-muted">No call at or above your {fmtMoney(r.e.avgCost, { cents: true })} cost</span>;
    if (r.report) return <span className="text-warn">Wait for earnings {fmtExp(r.report)}</span>;
    return <span className="text-muted">No quote yet</span>;
  }
  const b = r.best;
  return (
    <span className="text-text">
      Sell {r.suggestN} × <span className={b.strike < r.e.avgCost ? "text-warn" : "font-semibold text-pos"}>${b.strike}c</span>{" "}
      {fmtExp(b.expiration)} · ${b.mark.toFixed(2)}
      {b.annPct != null && <span className="text-muted"> · {Math.round(b.annPct)}% ann</span>}
      {r.mode === "keep" && <span className="text-muted"> · ⅓ of open lots</span>}
    </span>
  );
}

function Ladder({ title, rungs, primary, r }: { title: string; rungs: CoveredCallQuote[]; primary: boolean; r: Row }) {
  return (
    <div className={primary ? "" : "opacity-70"}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title}
        {primary && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">suggested</span>}
      </div>
      {rungs.length === 0 ? (
        <div className="text-xs text-muted">No quotes yet (refreshes during market hours).</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted/80">
              <th className="py-1 text-left font-medium">Exp</th>
              <th className="py-1 text-right font-medium">DTE</th>
              <th className="py-1 text-right font-medium">Strike</th>
              <th className="py-1 text-right font-medium">Δ</th>
              <th className="py-1 text-right font-medium">BBσ</th>
              <th className="py-1 text-right font-medium">Prem</th>
              <th className="py-1 text-right font-medium">Prem%</th>
              <th className="py-1 text-right font-medium">Ann%</th>
              <th className="py-1 text-right font-medium">OI</th>
              <th className="py-1 pl-3 text-left font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rungs.map((c) => {
              const isBest = primary && r.best === c;
              const belowCost = r.e.avgCost > 0 && c.strike < r.e.avgCost;
              const earn = spansEarnings(c, r.report);
              return (
                <tr key={`${c.targetDte}-${c.strike}`} className={isBest ? "bg-accent/10" : ""}>
                  <td className="py-1 text-text">{fmtExp(c.expiration)}</td>
                  <td className="py-1 text-right tabular text-text">{c.dte}</td>
                  <td className={`py-1 text-right tabular ${belowCost ? "text-warn" : "font-semibold text-pos"}`}>${c.strike}</td>
                  <td className="py-1 text-right tabular text-text">{c.delta.toFixed(2)}</td>
                  <td className="py-1 text-right tabular text-text">
                    {c.bbSigma != null ? `${c.bbSigma > 0 ? "+" : ""}${c.bbSigma.toFixed(1)}` : "-"}
                  </td>
                  <td className="py-1 text-right tabular text-text">${c.mark.toFixed(2)}</td>
                  <td className="py-1 text-right tabular text-text">{c.premPct.toFixed(1)}%</td>
                  <td className="py-1 text-right tabular text-pos">{c.annPct != null ? `${Math.round(c.annPct)}%` : "-"}</td>
                  <td className="py-1 text-right tabular text-muted">{c.oi.toLocaleString("en-US")}</td>
                  <td className="py-1 pl-3 text-muted">
                    {[isBest && "best θ/day", belowCost && "below your cost", earn && `spans earnings ${fmtExp(r.report)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
