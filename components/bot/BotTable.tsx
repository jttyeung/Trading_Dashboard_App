"use client";

import { Fragment, useMemo, useState } from "react";
import type { BotTrade } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/calc";

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
  { key: "status", label: "Status" },
];

export function BotTable({ trades }: { trades: BotTrade[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const sorted = useMemo(() => {
    const list = [...trades];
    list.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
    return list;
  }, [trades, sortKey, sortDir]);

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

  const pending = trades.filter((t) => t.status === "pending_approval").length;
  const approved = trades.filter((t) => t.status === "approved").length;
  const wins = trades.filter((t) => t.outcome === "WIN").length;
  const assigned = trades.filter((t) => t.outcome === "ASSIGNED").length;
  const totalPnl = trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-3 text-xs text-muted">
        <span className="text-sm font-semibold text-text">{trades.length} ideas</span>
        <span>{pending} pending</span>
        <span>{approved} approved</span>
        <span className="text-emerald-400">{wins} win</span>
        <span className="text-rose-400">{assigned} assigned</span>
        <span className={totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
          settled P&amp;L {fmtMoney(totalPnl, { sign: true })}
        </span>
        <span className="ml-auto text-[11px]">Approve/reject via CLI for now — see docs/SETUP.md</span>
      </div>

      <table className="w-full min-w-[1080px] border-collapse text-sm">
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
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
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
              </tr>
              {expanded.has(t.id) && (
                <tr className="border-b border-border/60 bg-surface-2/30">
                  <td colSpan={13} className="px-4 py-3 text-xs text-muted">
                    <span className="font-semibold text-text">#{t.id} {t.contractSymbol}</span> — {t.rationale}
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
