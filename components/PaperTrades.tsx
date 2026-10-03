"use client";

// The Auto Trader paper account's trade log on the Trader page: collapsed to a
// one-line toggle, expanded to the full list (newest first) with the time of
// each trade.
import { useState } from "react";
import { Amt } from "@/components/privacy";
import type { PaperTrade } from "@/lib/trader";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function PaperTrades({ trades }: { trades: PaperTrade[] }) {
  const [open, setOpen] = useState(false);
  if (trades.length === 0) return null;
  const rows = trades.slice().reverse();
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-muted underline">
        {open ? "Hide" : "Show"} {trades.length} trade{trades.length === 1 ? "" : "s"}
        {!open && ` · last ${when(rows[0].at)}`}
      </button>
      {open && (
        <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto text-[11px] text-muted">
          {rows.map((t, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="tabular text-text/80">{when(t.at)}</span> · {t.text}
              </span>
              {t.amount != null && (
                <span className="shrink-0 tabular">
                  <Amt>{signed(t.amount)}</Amt>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
