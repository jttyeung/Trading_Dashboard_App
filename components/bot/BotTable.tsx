"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import type { BotTrade, BotGrade, MyGradeSummary } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/calc";
import { decideTrade, setPersonallySelected, type BotStatus } from "@/lib/paperbot-api";

type SortKey = "postedAt" | "ticker" | "strike" | "expiration" | "dteAtPost" | "delta" | "ivPercent" | "annualizedRorPct" | "score" | "status";

const STATUS_STYLE: Record<string, string> = {
  pending_approval: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  approved: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  rejected: "bg-surface-2 text-muted ring-border",
};
const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};
const OUTCOME_STYLE: Record<string, string> = {
  WIN: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  ASSIGNED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};
const GRADE_TEXT: Record<BotGrade, { label: string; className: string }> = {
  good_call: { label: "✓ Good call — you approved, it won", className: "text-emerald-400" },
  risk_realized: { label: "You approved; it got assigned", className: "text-amber-400" },
  missed_win: { label: "✗ Missed win — you rejected, it would have won", className: "text-rose-400" },
  good_pass: { label: "✓ Good pass — you rejected, it would have been assigned", className: "text-emerald-400" },
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
  }
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "postedAt", label: "Date Posted" },
  { key: "ticker", label: "Ticker" },
  { key: "strike", label: "Strike" },
  { key: "expiration", label: "Expiration" },
  { key: "dteAtPost", label: "DTE" },
  { key: "delta", label: "Delta" },
  { key: "ivPercent", label: "IV %" },
  { key: "annualizedRorPct", label: "ARR %" },
  { key: "score", label: "Score" },
  { key: "status", label: "Your call" },
];

// TOTAL_COLUMNS: the 10 sortable COLUMNS above, plus Current/Outcome/P&L
// and the trailing Mine checkbox — kept in sync manually since the
// expanded rationale row's colSpan has to span every column.
const TOTAL_COLUMNS = COLUMNS.length + 4;

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

export function BotTable({ trades, myGrade }: { trades: BotTrade[]; myGrade: MyGradeSummary }) {
  const [localTrades, setLocalTrades] = useState(trades);
  useEffect(() => setLocalTrades(trades), [trades]);

  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
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

  const pending = localTrades.filter((t) => t.status === "pending_approval").length;
  const approved = localTrades.filter((t) => t.status === "approved").length;
  const wins = localTrades.filter((t) => t.outcome === "WIN").length;
  const assigned = localTrades.filter((t) => t.outcome === "ASSIGNED").length;
  const totalPnl = localTrades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
  const mineCount = localTrades.filter((t) => t.personallySelected).length;

  const decidedGraded = myGrade.goodCalls + myGrade.riskRealized + myGrade.missedWins + myGrade.goodPasses;
  const rightCalls = myGrade.goodCalls + myGrade.goodPasses;
  const accuracy = decidedGraded > 0 ? rightCalls / decidedGraded : null;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-3 text-xs text-muted">
        <span className="text-sm font-semibold text-text">{localTrades.length} ideas</span>
        <span>{pending} pending</span>
        <span>{approved} approved</span>
        <span className="text-emerald-400">{wins} win</span>
        <span className="text-rose-400">{assigned} assigned</span>
        <span className={totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
          settled P&amp;L {fmtMoney(totalPnl, { sign: true })}
        </span>
        <span className="text-sky-300">{mineCount} mine</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface-2/30 px-4 py-2 text-[11px] text-muted">
        <span className="font-semibold text-text">Your grading</span>
        <span className="text-emerald-400">{myGrade.goodCalls} good calls</span>
        <span className="text-amber-400">{myGrade.riskRealized} risk realized</span>
        <span className="text-rose-400">{myGrade.missedWins} missed wins</span>
        <span className="text-emerald-400">{myGrade.goodPasses} good passes</span>
        <span>{myGrade.ungraded} ungraded</span>
        {accuracy != null && (
          <span className="font-semibold text-text">
            {fmtPct(accuracy, 0)} of your decided-and-resolved calls matched the outcome
          </span>
        )}
        <span className="ml-auto">👍/👎 = your call · checkbox = trades you actually took</span>
      </div>

      {apiError && (
        <div className="border-b border-border bg-rose-500/10 px-4 py-2 text-[11px] text-rose-300">{apiError}</div>
      )}

      <table className="w-full min-w-[1180px] border-collapse text-sm">
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
            <th className="whitespace-nowrap px-3 py-2 font-medium">Current</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Outcome</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">P&amp;L</th>
            <th className="whitespace-nowrap px-3 py-2 text-center font-medium">Mine</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <Fragment key={t.id}>
              <tr
                className="cursor-pointer border-b border-border/60 hover:bg-surface-2/40"
                onClick={() => toggleRow(t.id)}
              >
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{t.postedAt.slice(0, 10)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-text">{t.ticker}</td>
                <td className="px-3 py-2 text-right tabular text-text">{fmtMoney(t.strike)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{t.expiration}</td>
                <td className="px-3 py-2 text-right tabular text-text">{t.dteAtPost}</td>
                <td className="px-3 py-2 text-right tabular text-text">{t.delta.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular text-text">{t.ivPercent.toFixed(0)}</td>
                <td className="px-3 py-2 text-right tabular text-emerald-300">{fmtPct(t.annualizedRorPct / 100, 1)}</td>
                <td className="px-3 py-2 text-right tabular text-text">{t.score.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <ThumbButton
                      active={t.status === "approved"}
                      onClick={() => handleThumb(t, "up")}
                      activeClassName="bg-sky-500/20 text-sky-300"
                      title="Approve (click again to undo)"
                    >
                      👍
                    </ThumbButton>
                    <ThumbButton
                      active={t.status === "rejected"}
                      onClick={() => handleThumb(t, "down")}
                      activeClassName="bg-rose-500/20 text-rose-300"
                      title="Reject (click again to undo)"
                    >
                      👎
                    </ThumbButton>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular text-text">{t.currentPrice ? fmtMoney(t.currentPrice) : "-"}</td>
                <td className="px-3 py-2">
                  {t.outcome ? (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${OUTCOME_STYLE[t.outcome]}`}>
                      {t.outcome}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">{t.itmOtm ?? "-"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular">
                  {t.realizedPnl != null ? (
                    <span className={t.realizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {fmtMoney(t.realizedPnl, { sign: true })}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
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
        </tbody>
      </table>
    </div>
  );
}
