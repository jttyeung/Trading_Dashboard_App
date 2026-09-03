"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import type { BotTrade, BotGrade, MyGradeSummary } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/calc";
import { decideTrade, setPersonallySelected, type BotStatus } from "@/lib/paperbot-api";
import { Stat } from "@/components/ui";

type SortKey =
  | "postedAt"
  | "ticker"
  | "strike"
  | "expiration"
  | "dteAtPost"
  | "premium"
  | "premiumTotal"
  | "breakeven"
  | "delta"
  | "ivPercent"
  | "annualizedRorPct"
  | "score"
  | "status"
  | "stockPriceAtPost";

const STATUS_STYLE: Record<string, string> = {
  pending_approval: "bg-warn/10 text-warn ring-warn/30",
  approved: "bg-info/10 text-info ring-info/30",
  rejected: "bg-surface-2 text-muted ring-border",
};
const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};
const OUTCOME_STYLE: Record<string, string> = {
  WIN: "bg-pos/10 text-pos ring-pos/30",
  ASSIGNED: "bg-neg/10 text-neg ring-neg/30",
};
const GRADE_TEXT: Record<BotGrade, { label: string; className: string }> = {
  good_call: { label: "✓ Good call — you approved, it won", className: "text-pos" },
  risk_realized: { label: "You approved; it got assigned", className: "text-warn" },
  missed_win: { label: "✗ Missed win — you rejected, it would have won", className: "text-neg" },
  good_pass: { label: "✓ Good pass — you rejected, it would have been assigned", className: "text-pos" },
};

function sortValue(t: BotTrade, key: SortKey): number | string {
  switch (key) {
    case "postedAt":
      return t.postedAt;
    case "ticker":
      return t.ticker;
    case "strike":
      return t.strike;
    case "expiration":
      return t.expiration;
    case "dteAtPost":
      return t.dteAtPost;
    case "premium":
      return t.premium;
    case "premiumTotal":
      return t.premiumTotal;
    case "breakeven":
      return t.breakeven;
    case "delta":
      return t.delta;
    case "ivPercent":
      return t.ivPercent;
    case "annualizedRorPct":
      return t.annualizedRorPct;
    case "score":
      return t.score;
    case "status":
      return t.status;
    case "stockPriceAtPost":
      return t.stockPriceAtPost;
  }
}

// Column order matches the reference tracker spreadsheet the account
// holder pointed to as a layout bar (see the paperbot package doc
// comment): DTE, Premium, Premium $, Breakeven, Delta, IV %, ARR %,
// Score, then the approve/reject call and Stock @ Post.
const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "postedAt", label: "Date Posted" },
  { key: "ticker", label: "Ticker" },
  { key: "strike", label: "Strike" },
  { key: "expiration", label: "Expiration" },
  { key: "dteAtPost", label: "DTE" },
  { key: "premium", label: "Premium" },
  { key: "premiumTotal", label: "Premium $" },
  { key: "breakeven", label: "Breakeven" },
  { key: "delta", label: "Delta" },
  { key: "ivPercent", label: "IV %" },
  { key: "annualizedRorPct", label: "ARR %" },
  {
    key: "score",
    label: "Score",
    title: "0-100, normalized per strategy from the suggestion engine's composite score — not comparable across different strategies",
  },
  { key: "status", label: "Your call" },
  { key: "stockPriceAtPost", label: "Stock @ Post" },
];

// TOTAL_COLUMNS: the sortable COLUMNS above, plus Current/Outcome/P&L/
// Return %/Stock @ Expiry and the trailing Mine checkbox — kept in sync
// manually since the expanded rationale row's colSpan has to span every
// column.
const TOTAL_COLUMNS = COLUMNS.length + 6;

function ThumbButton({
  active,
  onClick,
  activeClassName,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClassName: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`rounded-full px-1.5 py-0.5 text-xs leading-none transition-colors ${
        active ? activeClassName : "text-muted/60 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// DateGroup buckets trades by the calendar day they were posted (the
// paperbot agent only ever logs picks once a day — see the paperbot
// package's own "once-a-day, top-N" doc comment — so a date group here
// reads as one day's actual cohort of picks, not an arbitrary slice).
interface DateGroup {
  date: string;
  trades: BotTrade[];
}

// collapsedDatesKey/loadCollapsedDates/saveCollapsedDates persist which
// date groups are collapsed per browser — same pattern as AlertsPanel's
// own "read" state — so a page refresh doesn't silently re-expand
// everything you'd already collapsed. Scoped per bot (storageKey) since
// /bot and /bot-20-delta-safe are two independent tables with their own
// dates worth remembering separately.
function collapsedDatesKey(storageKey: string): string {
  return `botCollapsedDates_${storageKey}`;
}

function loadCollapsedDates(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(collapsedDatesKey(storageKey));
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveCollapsedDates(storageKey: string, dates: Set<string>) {
  try {
    localStorage.setItem(collapsedDatesKey(storageKey), JSON.stringify(Array.from(dates)));
  } catch {
    /* ignore */
  }
}

export function BotTable({ trades, myGrade, storageKey }: { trades: BotTrade[]; myGrade: MyGradeSummary; storageKey: string }) {
  const [localTrades, setLocalTrades] = useState(trades);
  useEffect(() => setLocalTrades(trades), [trades]);

  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  useEffect(() => setCollapsedDates(loadCollapsedDates(storageKey)), [storageKey]);
  const [apiError, setApiError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...localTrades];
    list.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
    return list;
  }, [localTrades, sortKey, sortDir]);

  // Groups are always ordered newest-date-first regardless of the current
  // column sort (mirroring the desktop positions table's own "row order
  // within a group follows the sort, group order doesn't" convention) —
  // rows inside each date keep whatever order the active column sort
  // produced.
  const dateGroups = useMemo<DateGroup[]>(() => {
    const map = new Map<string, BotTrade[]>();
    for (const t of sorted) {
      const date = t.postedAt.slice(0, 10);
      const bucket = map.get(date);
      if (bucket) bucket.push(t);
      else map.set(date, [t]);
    }
    return Array.from(map.entries())
      .map(([date, trades]) => ({ date, trades }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sorted]);

  function toggleDate(date: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      saveCollapsedDates(storageKey, next);
      return next;
    });
  }
  function collapseAllDates() {
    const next = new Set(dateGroups.map((g) => g.date));
    setCollapsedDates(next);
    saveCollapsedDates(storageKey, next);
  }
  function expandAllDates() {
    setCollapsedDates(new Set());
    saveCollapsedDates(storageKey, new Set());
  }
  const allDatesCollapsed = dateGroups.length > 0 && dateGroups.every((g) => collapsedDates.has(g.date));

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function toggleRow(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showApiError() {
    setApiError("Couldn't reach the OptionsEvaluator API at localhost:8091 — is the daemon running on this machine?");
    setTimeout(() => setApiError(null), 6000);
  }

  async function handleThumb(t: BotTrade, direction: "up" | "down") {
    const target: BotStatus = direction === "up" ? "approved" : "rejected";
    const next: BotStatus = t.status === target ? "pending_approval" : target; // click an active thumb again to undo
    const prevStatus = t.status;
    setLocalTrades((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await decideTrade(t.id, next);
    } catch {
      setLocalTrades((cur) => cur.map((x) => (x.id === t.id ? { ...x, status: prevStatus } : x)));
      showApiError();
    }
  }

  async function handlePersonalToggle(t: BotTrade) {
    const next = !t.personallySelected;
    setLocalTrades((cur) => cur.map((x) => (x.id === t.id ? { ...x, personallySelected: next } : x)));
    try {
      await setPersonallySelected(t.id, next);
    } catch {
      setLocalTrades((cur) => cur.map((x) => (x.id === t.id ? { ...x, personallySelected: !next } : x)));
      showApiError();
    }
  }

  // "Pending" here means no outcome yet (still awaiting expiration),
  // regardless of approve/reject/pending_approval status — Total =
  // Pending + Wins + Losses always holds, matching the reference
  // tracker spreadsheet's own scorecard the account holder pointed to.
  // needsReview (decision-status based) is a distinct, smaller number
  // shown separately below.
  const totalTrades = localTrades.length;
  const pendingOutcome = localTrades.filter((t) => !t.outcome).length;
  const wins = localTrades.filter((t) => t.outcome === "WIN").length;
  const losses = localTrades.filter((t) => t.outcome === "ASSIGNED").length;
  const winRate = wins + losses > 0 ? wins / (wins + losses) : null;
  const avgAnnualRoR = totalTrades > 0 ? localTrades.reduce((s, t) => s + t.annualizedRorPct, 0) / totalTrades : null;
  const totalPnl = localTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);

  const needsReview = localTrades.filter((t) => t.status === "pending_approval").length;
  const mineCount = localTrades.filter((t) => t.personallySelected).length;

  const decidedGraded = myGrade.goodCalls + myGrade.riskRealized + myGrade.missedWins + myGrade.goodPasses;
  const rightCalls = myGrade.goodCalls + myGrade.goodPasses;
  const accuracy = decidedGraded > 0 ? rightCalls / decidedGraded : null;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-2 gap-2 border-b border-border p-4 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Total Trades" value={totalTrades} />
        <Stat label="Pending" value={pendingOutcome} />
        <Stat label="Wins" value={wins} tone="pos" />
        <Stat label="Losses" value={losses} tone="neg" />
        <Stat label="Win Rate" value={winRate != null ? fmtPct(winRate, 2) : "—"} />
        <Stat label="Avg Annual RoR" value={avgAnnualRoR != null ? fmtPct(avgAnnualRoR / 100, 2) : "—"} />
        <Stat label="Total P&L" value={fmtMoney(totalPnl, { sign: true })} tone={totalPnl >= 0 ? "pos" : "neg"} />
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-2 text-xs text-muted">
        <span>{needsReview} awaiting your review</span>
        <span className="text-info">{mineCount} mine</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface-2/30 px-4 py-2 text-[11px] text-muted">
        <span className="font-semibold text-text">Your grading</span>
        <span className="text-pos">{myGrade.goodCalls} good calls</span>
        <span className="text-warn">{myGrade.riskRealized} risk realized</span>
        <span className="text-neg">{myGrade.missedWins} missed wins</span>
        <span className="text-pos">{myGrade.goodPasses} good passes</span>
        <span>{myGrade.ungraded} ungraded</span>
        {accuracy != null && (
          <span className="font-semibold text-text">
            {fmtPct(accuracy, 0)} of your decided-and-resolved calls matched the outcome
          </span>
        )}
        <span className="ml-auto">👍/👎 = your call · checkbox = trades you actually took</span>
      </div>

      {apiError && (
        <div className="border-b border-border bg-neg/10 px-4 py-2 text-[11px] text-neg">{apiError}</div>
      )}

      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[11px] text-muted">{dateGroups.length} days</span>
        <button
          onClick={allDatesCollapsed ? expandAllDates : collapseAllDates}
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-text"
        >
          {allDatesCollapsed ? "Expand all" : "Collapse all"}
        </button>
      </div>

      <table className="w-full min-w-[1520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            {COLUMNS.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium" title={c.title}>
                <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-text">
                  {c.label}
                  <span className="text-[9px]">{sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
                </button>
              </th>
            ))}
            {/* normal-case: the sortable COLUMNS headers above render mixed-case
                despite the row's own `uppercase` because each label sits inside a
                <button>, and browsers' UA stylesheet gives form controls their own
                `text-transform: none` that wins over the inherited uppercase — these
                plain-text headers have no such override, so it's applied explicitly
                to keep every header's case consistent. */}
            <th className="whitespace-nowrap px-2 py-1.5 font-medium normal-case">Current</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium normal-case">Stock @ Expiry</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium normal-case">Outcome</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium normal-case">P&amp;L</th>
            <th className="whitespace-nowrap px-2 py-1.5 font-medium normal-case">Return %</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-center font-medium normal-case">Mine</th>
          </tr>
        </thead>
        <tbody>
          {dateGroups.map((g) => {
            const dateCollapsed = collapsedDates.has(g.date);
            const dateWins = g.trades.filter((t) => t.outcome === "WIN").length;
            const dateLosses = g.trades.filter((t) => t.outcome === "ASSIGNED").length;
            const datePnl = g.trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
            const hasDatePnl = g.trades.some((t) => t.realizedPnl != null);
            return (
              <Fragment key={g.date}>
                <tr className="border-b border-border bg-surface-2/60">
                  <td colSpan={TOTAL_COLUMNS} className="px-2 py-1.5">
                    <button
                      onClick={() => toggleDate(g.date)}
                      className="flex w-full items-center gap-1.5 text-xs font-semibold text-text"
                    >
                      <span className={`transition-transform ${dateCollapsed ? "-rotate-90" : ""}`}>▾</span>
                      {g.date} <span className="font-normal text-muted">({g.trades.length})</span>
                      {(dateWins > 0 || dateLosses > 0) && (
                        <span className="font-normal text-muted">
                          · <span className="text-pos">{dateWins}W</span> / <span className="text-neg">{dateLosses}L</span>
                        </span>
                      )}
                      {hasDatePnl && (
                        <span className={`ml-auto font-normal ${datePnl >= 0 ? "text-pos" : "text-neg"}`}>
                          {fmtMoney(datePnl, { sign: true })}
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
                {!dateCollapsed &&
                  g.trades.map((t) => (
            <Fragment key={t.id}>
              <tr
                className="cursor-pointer border-b border-border/60 hover:bg-surface-2/40"
                onClick={() => toggleRow(t.id)}
              >
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted">{t.postedAt.slice(0, 10)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-text">{t.ticker}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{fmtMoney(t.strike)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted">{t.expiration}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{t.dteAtPost}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{fmtMoney(t.premium, { cents: true })}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{fmtMoney(t.premiumTotal, { cents: true })}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{fmtMoney(t.breakeven, { cents: true })}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{t.delta.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{t.ivPercent.toFixed(0)}</td>
                <td className="px-2 py-1.5 text-right tabular text-pos">{fmtPct(t.annualizedRorPct / 100, 1)}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{t.score.toFixed(1)}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <ThumbButton
                      active={t.status === "approved"}
                      onClick={() => handleThumb(t, "up")}
                      activeClassName="bg-info/15 text-info"
                      title="Approve (click again to undo)"
                    >
                      👍
                    </ThumbButton>
                    <ThumbButton
                      active={t.status === "rejected"}
                      onClick={() => handleThumb(t, "down")}
                      activeClassName="bg-neg/15 text-neg"
                      title="Reject (click again to undo)"
                    >
                      👎
                    </ThumbButton>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular text-text">{fmtMoney(t.stockPriceAtPost, { cents: true })}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">{t.currentPrice ? fmtMoney(t.currentPrice) : "-"}</td>
                <td className="px-2 py-1.5 text-right tabular text-text">
                  {t.stockPriceAtClose != null ? fmtMoney(t.stockPriceAtClose, { cents: true }) : "-"}
                </td>
                <td className="px-2 py-1.5">
                  {t.outcome ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${OUTCOME_STYLE[t.outcome]}`}>
                      {t.outcome}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">{t.itmOtm ?? "-"}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular">
                  {t.realizedPnl != null ? (
                    <span className={t.realizedPnl >= 0 ? "text-pos" : "text-neg"}>
                      {fmtMoney(t.realizedPnl, { sign: true })}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular">
                  {t.returnPct != null ? (
                    <span className={t.returnPct >= 0 ? "text-pos" : "text-neg"}>{fmtPct(t.returnPct, 1)}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={t.personallySelected}
                    onChange={() => handlePersonalToggle(t)}
                    className="h-4 w-4 cursor-pointer accent-emerald-500"
                    title="I actually took this trade in my real portfolio"
                  />
                </td>
              </tr>
              {expanded.has(t.id) && (
                <tr className="border-b border-border/60 bg-surface-2/30">
                  <td colSpan={TOTAL_COLUMNS} className="px-4 py-3 text-xs text-muted">
                    <div>
                      <span className="font-semibold text-text">
                        #{t.id} {t.contractSymbol}
                      </span>{" "}
                      — {t.rationale}
                    </div>
                    {t.grade && (
                      <div className={`mt-1.5 font-medium ${GRADE_TEXT[t.grade].className}`}>{GRADE_TEXT[t.grade].label}</div>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
