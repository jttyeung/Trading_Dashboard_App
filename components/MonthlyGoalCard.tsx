"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";

const TARGET_KEY = "monthlyGoalTargetPercent";

// MonthlyGoalCard tracks RULE-010's own 2%/month floor, 3%/month target
// against real Schwab options realized P&L for the current calendar
// month, paced against capitalBase — real capital deployed in options
// strategies (LEAP/hedge value + CSP collateral + spread risk), passed
// in from the SAME optionsCapital the Home page's own Options stat
// already computes from the blended snapshot (Schwab + SnapTrade +
// E*TRADE). NOT the Schwab-only liquidation value this card started
// with: the account holder correctly caught that Fidelity/E*TRADE both
// hold real wheel positions too (CDE/LRCX CSPs, a CRM covered call), so
// excluding them understated the real capital base. realizedThisMonth
// is still Schwab-only, though — internal/pnl's own FIFO reconstruction
// has no SnapTrade/E*TRADE equivalent (those two only reconstruct
// realized STOCK P&L, not options), a real, known gap this card doesn't
// paper over but hasn't closed yet either.
//
// targetPercent is editable here (the pencil icon) and persisted in
// localStorage only — same pattern as margin-mode.tsx's own toggle: a
// personal pacing goal the account holder tunes for themselves, not a
// setting the backend needs to know about. Starts at the backend's own
// RULE-010 default (defaultTargetPercent) until an explicit override is
// saved, exactly mirroring margin-mode.tsx's "start at a safe default,
// then let an effect (never the render body) read the real persisted
// value" structure — reading localStorage directly in a lazy useState
// initializer would be flagged as an impure render-time read the same
// way a live Date.now() call already is elsewhere in this app.
export function MonthlyGoalCard({
  capitalBase,
  realizedThisMonth,
  defaultTargetPercent,
  asOfDate,
  daysInMonth,
}: {
  capitalBase: number;
  realizedThisMonth: number;
  defaultTargetPercent: number;
  asOfDate: string; // YYYY-MM-DD
  daysInMonth: number;
}) {
  const [targetPercent, setTargetPercent] = useState(defaultTargetPercent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(defaultTargetPercent));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TARGET_KEY);
      if (saved != null) {
        const parsed = parseFloat(saved);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setTargetPercent(parsed);
          setDraft(saved);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  function saveTarget() {
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setTargetPercent(parsed);
      try {
        localStorage.setItem(TARGET_KEY, String(parsed));
      } catch {
        /* ignore */
      }
    } else {
      setDraft(String(targetPercent)); // reject a bad edit, revert the input
    }
    setEditing(false);
  }

  const goal = capitalBase * (targetPercent / 100);
  const progressPct = goal > 0 ? (realizedThisMonth / goal) * 100 : 0;
  const dayOfMonth = parseInt(asOfDate.slice(8, 10), 10) || 1;
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
  const dailyAvg = dayOfMonth > 0 ? realizedThisMonth / dayOfMonth : 0;
  const projected = dailyAvg * daysInMonth;
  const remaining = Math.max(0, goal - realizedThisMonth);

  return (
    <Card className="mt-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🎯</span>
          <span className="text-sm font-semibold text-text">Monthly Goal</span>
          <button
            onClick={() => {
              setDraft(String(targetPercent));
              setEditing(true);
            }}
            title="Edit target %"
            className="text-muted/60 hover:text-text"
          >
            ✏️
          </button>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted">Realized</span>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-xs text-muted">
          Target:{" "}
          {editing ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                onBlur={saveTarget}
                autoFocus
                className="w-14 rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-emerald-400 tabular"
              />
              %
            </span>
          ) : (
            <span className="font-semibold text-emerald-400">{targetPercent.toFixed(2)}%</span>
          )}{" "}
          of <Amt>{fmtMoney(capitalBase)}</Amt>
        </div>
        <div className="text-right tabular">
          <span className="text-xl font-bold text-text">
            <Amt>{fmtMoney(realizedThisMonth)}</Amt>
          </span>
          <span className="text-xs text-muted">
            {" "}
            / <Amt>{fmtMoney(goal)}</Amt>
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tabular text-text">{Math.round(progressPct)}%</div>
        <div className="text-[10px] uppercase tracking-wide text-muted">Of monthly goal</div>
      </div>

      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${progressPct >= 100 ? "bg-emerald-400" : "bg-sky-400"}`}
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl border border-border px-3 py-2 text-center">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted">
            Day {dayOfMonth}/{daysInMonth}
          </div>
          <div className="text-xs font-semibold text-text">{daysLeft}d left</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted">Daily avg</div>
          <div className="text-xs font-semibold text-text">
            <Amt>{fmtMoney(dailyAvg)}</Amt>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted">Projected</div>
          <div className={`text-xs font-semibold ${projected >= goal ? "text-emerald-400" : "text-amber-400"}`}>
            <Amt>{fmtMoney(projected)}</Amt>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted">Remaining</div>
          <div className="text-xs font-semibold text-text">
            <Amt>{fmtMoney(remaining)}</Amt>
          </div>
        </div>
      </div>
    </Card>
  );
}
