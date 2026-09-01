"use client";

import { Fragment, useMemo, useState } from "react";
import type { OptionKind, OptionPosition } from "@/lib/types";
import {
  daysBetween,
  daysToExpiry,
  fmtMoney,
  fmtPct,
  optionBasis,
  optionNetValue,
  optionPnl,
  optionPnlPct,
  positionAnnualizedReturn,
} from "@/lib/calc";
import { positionDailyTheta } from "@/lib/theta";

const STRATEGY_CODE: Record<OptionKind, string> = {
  csp: "CSP",
  "covered-call": "CC",
  "leap-call": "LC",
  "leap-put-hedge": "HDG",
  "put-spread": "PS",
  "call-spread": "CS",
  other: "OTH",
};

// A position tagged with which real account it came from — computed by the
// server page (app/desktop/page.tsx) since neither Schwab's own combined
// export nor the SnapTrade fold-in carry per-account attribution on an
// individual OptionPosition; the page builds this by iterating every real
// account itself rather than reading the pre-merged "combined" bucket.
export type SourcedOption = OptionPosition & { sourceLabel: string };

type GroupBy = "none" | "strategy" | "dte" | "ticker" | "account";
type SortKey = "ticker" | "strategy" | "qty" | "dit" | "dte" | "strike" | "spot" | "theta" | "unrealized" | "todayPl" | "marketValue" | "source";

interface Row {
  o: SourcedOption;
  strategyCode: string;
  dit: number | null;
  dte: number;
  spot: number | null;
  theta: number;
  unrealized: number;
  unrealizedPct: number;
  todayPl: number | null;
  todayPlPct: number | null;
  marketValue: number;
  apy: number | null;
}

// OptionPosition.qty is a plain magnitude (side carries the sign) — signed
// here to match how a short position's size/value is conventionally shown
// (e.g. "-1" contract, a negative Market Value representing the liability
// to buy it back), not because the underlying field is itself signed.
function signedQty(o: OptionPosition): number {
  return o.side === "short" ? -o.qty : o.qty;
}

function buildRow(o: SourcedOption): Row {
  const marketValue = optionNetValue(o); // long +, short − (the buy-back liability)
  const todayPl = o.dayValueChange ?? null;
  // Back out yesterday's value (today's value minus today's change) to get a
  // %; no separate "yesterday" field exists on OptionPosition. Not populated
  // by this app's own export today (Schwab's own "day change" isn't wired up
  // for options yet) — todayPl reads null/"-" for every real position until
  // that's built, rather than a fabricated number.
  const yesterdayValue = todayPl != null ? marketValue - todayPl : null;
  const todayPlPct = todayPl != null && yesterdayValue ? todayPl / Math.abs(yesterdayValue) : null;
  return {
    o,
    strategyCode: STRATEGY_CODE[o.kind] ?? "OTH",
    dit: o.openedAt ? daysBetween(o.openedAt) : null,
    dte: daysToExpiry(o.expiration),
    spot: o.underlyingPrice ?? o.underlyingLive ?? o.underlyingClose ?? null,
    theta: positionDailyTheta(o),
    unrealized: optionPnl(o),
    unrealizedPct: optionPnlPct(o),
    todayPl,
    todayPlPct,
    marketValue,
    apy: positionAnnualizedReturn(o),
  };
}

// 0-7 / 8-21 mirror this app's own DTE-management framing (the 21-DTE
// early-management window most rules already key off); 22-30/30-45/45+
// split out what used to be one wide "22-45" bucket for more granularity
// further from expiration, where less urgency means bigger natural bands.
function dteBucket(dte: number): { key: string; label: string; order: number } {
  if (dte <= 7) return { key: "0-7", label: "0-7 DTE", order: 0 };
  if (dte <= 21) return { key: "8-21", label: "8-21 DTE", order: 1 };
  if (dte <= 30) return { key: "22-30", label: "22-30 DTE", order: 2 };
  if (dte <= 45) return { key: "30-45", label: "30-45 DTE", order: 3 };
  return { key: "45+", label: "45+ DTE", order: 4 };
}

function dteColor(dte: number): string {
  if (dte <= 7) return "bg-rose-500/20 text-rose-300";
  if (dte <= 21) return "bg-amber-500/20 text-amber-300";
  return "bg-emerald-500/20 text-emerald-300";
}

function pnlColor(n: number | null): string {
  if (n == null) return "text-muted";
  return n >= 0 ? "text-emerald-400" : "text-rose-400";
}

function sortValue(r: Row, key: SortKey): number | string {
  switch (key) {
    case "ticker":
      return r.o.symbol;
    case "strategy":
      return r.strategyCode;
    case "qty":
      return signedQty(r.o);
    case "dit":
      return r.dit ?? -Infinity;
    case "dte":
      return r.dte;
    case "strike":
      return r.o.strike;
    case "spot":
      return r.spot ?? -Infinity;
    case "theta":
      return r.theta;
    case "unrealized":
      return r.unrealized;
    case "todayPl":
      return r.todayPl ?? -Infinity;
    case "marketValue":
      return r.marketValue;
    case "source":
      return r.o.sourceLabel;
  }
}

function sumRows(rows: Row[]) {
  const unrealized = rows.reduce((s, r) => s + r.unrealized, 0);
  const todayPl = rows.reduce((s, r) => s + (r.todayPl ?? 0), 0);
  const marketValue = rows.reduce((s, r) => s + r.marketValue, 0);
  const theta = rows.reduce((s, r) => s + r.theta, 0);
  // % versions: weighted by each row's own basis magnitude so a subtotal's %
  // means "blended return on the capital in this group," not a naive average
  // of already-normalized per-row percentages.
  const unrealizedBasis = rows.reduce((s, r) => s + Math.abs(optionBasis(r.o)), 0);
  const unrealizedPct = unrealizedBasis !== 0 ? unrealized / unrealizedBasis : 0;
  const todayBasis = rows.reduce((s, r) => s + Math.abs(r.marketValue - (r.todayPl ?? 0)), 0);
  const todayPlPct = todayBasis !== 0 ? todayPl / todayBasis : 0;
  // Distinct from "$0 today" — no row in this group has real day-change data
  // (see buildRow's own note on why todayPl is null for every real position
  // right now), so the subtotal should read as unavailable, not flat.
  const hasTodayPl = rows.some((r) => r.todayPl != null);
  return { unrealized, unrealizedPct, todayPl, todayPlPct, marketValue, theta, hasTodayPl };
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "strategy", label: "Strategy" },
  { key: "qty", label: "Qty" },
  { key: "dit", label: "DIT" },
  { key: "dte", label: "DTE" },
  { key: "strike", label: "Strike" },
  { key: "spot", label: "Mark" },
  { key: "theta", label: "Theta $" },
  { key: "unrealized", label: "Unrealized" },
  { key: "todayPl", label: "Today P/L" },
  { key: "marketValue", label: "Market Value" },
  { key: "source", label: "Source" },
];

export function PositionsTable({ options, marketOpen }: { options: SourcedOption[]; marketOpen: boolean }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("dte");
  const [sortKey, setSortKey] = useState<SortKey>("dte");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => options.map(buildRow), [options]);

  const groups = useMemo(() => {
    type Group = { key: string; label: string; order: number; rows: Row[] };
    const map = new Map<string, Group>();
    for (const r of rows) {
      let key: string, label: string, order: number;
      if (groupBy === "none") {
        key = "all";
        label = "";
        order = 0;
      } else if (groupBy === "strategy") {
        key = r.strategyCode;
        label = r.strategyCode;
        order = key.charCodeAt(0);
      } else if (groupBy === "dte") {
        const b = dteBucket(r.dte);
        key = b.key;
        label = b.label;
        order = b.order;
      } else if (groupBy === "account") {
        key = r.o.sourceLabel;
        label = r.o.sourceLabel;
        order = 0;
      } else {
        key = r.o.symbol;
        label = r.o.symbol;
        order = 0;
      }
      const g = map.get(key) ?? { key, label, order, rows: [] };
      g.rows.push(r);
      map.set(key, g);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.label.localeCompare(b.label)));
    for (const g of list) {
      g.rows.sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
        return cmp * sortDir;
      });
    }
    return list;
  }, [rows, groupBy, sortKey, sortDir]);

  const total = useMemo(() => sumRows(rows), [rows]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function collapseAll() {
    setCollapsed(new Set(groups.map((g) => g.key)));
  }
  function expandAll() {
    setCollapsed(new Set());
  }
  const allCollapsed = groupBy !== "none" && groups.length > 0 && groups.every((g) => collapsed.has(g.key));

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Open Positions</h2>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">{rows.length}</span>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
            marketOpen ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-surface-2 text-muted ring-border"
          }`}
        >
          {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
        </span>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Group
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["none", "strategy", "dte", "ticker", "account"] as GroupBy[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`px-2.5 py-1 text-xs font-medium capitalize ${
                    groupBy === g ? "bg-sky-500/20 text-sky-300" : "bg-transparent text-muted hover:text-text"
                  }`}
                >
                  {g === "none" ? "None" : g === "dte" ? "DTE" : g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {groupBy !== "none" && (
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            {COLUMNS.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-text">
                  {c.label}
                  <span className="text-[9px]">{sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const isCollapsed = groupBy !== "none" && collapsed.has(g.key);
            const gSum = groupBy !== "none" ? sumRows(g.rows) : null;
            return (
              <Fragment key={g.key}>
                {groupBy !== "none" && (
                  <tr key={`${g.key}-header`} className="border-b border-border bg-surface-2/60">
                    <td colSpan={2} className="px-3 py-2">
                      <button onClick={() => toggleGroup(g.key)} className="flex items-center gap-1.5 text-xs font-semibold text-text">
                        <span className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>▾</span>
                        {g.label} <span className="font-normal text-muted">({g.rows.length})</span>
                      </button>
                    </td>
                    <td colSpan={5} />
                    <td className="px-3 py-2 text-right tabular text-xs font-semibold text-muted">{fmtMoney(gSum!.theta)}</td>
                    <td className="px-3 py-2 text-right tabular text-xs">
                      <span className={`font-semibold ${pnlColor(gSum!.unrealized)}`}>{fmtMoney(gSum!.unrealized, { sign: true })}</span>{" "}
                      <span className={pnlColor(gSum!.unrealized)}>({fmtPct(gSum!.unrealizedPct)})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular text-xs">
                      {gSum!.hasTodayPl ? (
                        <>
                          <span className={`font-semibold ${pnlColor(gSum!.todayPl)}`}>{fmtMoney(gSum!.todayPl, { sign: true })}</span>{" "}
                          <span className={pnlColor(gSum!.todayPl)}>({fmtPct(gSum!.todayPlPct)})</span>
                        </>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular text-xs font-semibold text-text">{fmtMoney(gSum!.marketValue, { sign: true })}</td>
                    <td />
                  </tr>
                )}
                {!isCollapsed &&
                  g.rows.map((r) => (
                    <tr key={r.o.id} className="border-b border-border/60 hover:bg-surface-2/40">
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-text">
                        {r.o.symbol}
                        {r.apy != null && r.apy >= 0.35 && (
                          <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            {fmtPct(r.apy, 1)} APY
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                          {r.strategyCode}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right tabular ${r.o.side === "short" ? "text-rose-300" : "text-text"}`}>{signedQty(r.o)}</td>
                      <td className="px-3 py-2 text-right tabular text-emerald-300">{r.dit ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular ${dteColor(r.dte)}`}>{r.dte}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular text-text">{fmtMoney(r.o.strike)}</td>
                      <td className="px-3 py-2 text-right tabular text-text">{r.spot != null ? fmtMoney(r.spot) : "-"}</td>
                      <td className={`px-3 py-2 text-right tabular ${pnlColor(r.theta)}`}>{fmtMoney(r.theta, { sign: true })}</td>
                      <td className="px-3 py-2 text-right tabular">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.unrealized >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {fmtMoney(r.unrealized, { sign: true })} ({fmtPct(r.unrealizedPct)})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular">
                        {r.todayPl != null ? (
                          <span className={pnlColor(r.todayPl)}>
                            {fmtMoney(r.todayPl, { sign: true })} {r.todayPlPct != null && `(${fmtPct(r.todayPlPct)})`}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular text-text">{fmtMoney(r.marketValue, { sign: true })}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{r.o.sourceLabel}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-2/60 font-semibold">
            <td colSpan={7} className="px-3 py-2.5 text-xs uppercase tracking-wide text-muted">
              Total
            </td>
            <td className="px-3 py-2.5 text-right tabular text-xs text-text">{fmtMoney(total.theta, { sign: true })}</td>
            <td className="px-3 py-2.5 text-right tabular text-xs">
              <span className={pnlColor(total.unrealized)}>
                {fmtMoney(total.unrealized, { sign: true })} ({fmtPct(total.unrealizedPct)})
              </span>
            </td>
            <td className="px-3 py-2.5 text-right tabular text-xs">
              {total.hasTodayPl ? (
                <span className={pnlColor(total.todayPl)}>
                  {fmtMoney(total.todayPl, { sign: true })} ({fmtPct(total.todayPlPct)})
                </span>
              ) : (
                <span className="text-muted">-</span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right tabular text-xs text-text">{fmtMoney(total.marketValue, { sign: true })}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
