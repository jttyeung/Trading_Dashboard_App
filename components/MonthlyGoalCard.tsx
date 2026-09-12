"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { isExampleClient } from "@/lib/demo";
import { fetchMonthlyGoalTarget, setMonthlyGoalTarget } from "@/lib/monthly-goal-api";

// MonthlyGoalCard tracks RULE-010's own 2%/month floor, 3%/month target
// against real Schwab options realized P&L for the current calendar
// month, paced against portfolioValue — the account holder's explicit
// call (over an earlier version paced against just optionsCapital,
// capital actually deployed in options strategies): the target is
// deliberately the WHOLE portfolio (stocks + cash + options), not just
// the options slice. This is knowingly a much harder bar to clear while
// a large chunk of the account sits in plain stock positions — that gap
// is the point, not a bug: it's the real wheel-strategy-as-share-of-
// portfolio target to grow into over time, not a number tuned to
// already read as achievable today.
//
// portfolioValue itself comes from OptionsEvaluator's own
// monthly-goal.json (portfolioValueBaseline) — a value FROZEN once at
// the start of the calendar month, not live — per a later, separate ask
// from the account holder: the dollar target shouldn't silently drift
// throughout the month just because the live portfolio value moved.
// Callers must pass that baseline field, not a live total like
// summary.totalValue, or this card's whole "static for the month"
// framing breaks.
//
// realizedThisMonth is still Schwab-only, though — internal/pnl's own
// FIFO reconstruction has no SnapTrade/E*TRADE equivalent (those two
// only reconstruct realized STOCK P&L, not options), a real, known gap
// this card doesn't paper over but hasn't closed yet either.
//
// Update — target %/capital base are now backend-persisted, not
// localStorage: a localStorage-only override turned out not to actually
// "stick" (the account holder found an edit reverted on a later
// session/reload — a different browser origin, cleared site data, or
// just a different device all silently reset it). Moved to real
// persistence via internal/rollapi's /monthly-goal-target, the same fix
// this app already applied to the roll-up target for the identical
// class of problem. On mount, GET whatever's saved server-side; falls
// back to the RULE-010 default / the live portfolioValue prop until an
// explicit override has ever been saved. Also collapsed from two
// separate pencil icons (one per field) into one, opening a single
// inline form that edits both % and $ together and saves them as one
// call — the account holder's own ask, since editing one without the
// other never made sense as a separate action anyway.
export function MonthlyGoalCard({
  portfolioValue,
  realizedThisMonth,
  defaultTargetPercent,
  asOfDate,
  daysInMonth,
}: {
  portfolioValue: number;
  realizedThisMonth: number;
  defaultTargetPercent: number;
  asOfDate: string; // YYYY-MM-DD
  daysInMonth: number;
}) {
  const [targetPercent, setTargetPercent] = useState(defaultTargetPercent);
  const [capitalBase, setCapitalBase] = useState(portfolioValue);
  const [editing, setEditing] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(defaultTargetPercent));
  const [capitalDraft, setCapitalDraft] = useState(String(portfolioValue));
  const [saveError, setSaveError] = useState<string | null>(null);
  // hasOverride tracks whether a real saved override exists server-side —
  // while it's still null (the GET hasn't resolved yet) or false (checked,
  // nothing saved), this card keeps tracking the live defaultTargetPercent/
  // portfolioValue props as they arrive, same as before this moved off
  // localStorage; once true, an override is authoritative and prop changes
  // (a fresh calendar-month baseline) no longer overwrite it.
  const [hasOverride, setHasOverride] = useState<boolean | null>(null);

  useEffect(() => {
    // Demo builds serve the bundled fixture and make no live call; the
    // props already carry the example target and capital base.
    if (isExampleClient()) {
      setHasOverride(false);
      return;
    }
    let cancelled = false;
    fetchMonthlyGoalTarget()
      .then((t) => {
        if (cancelled) return;
        setHasOverride(t.hasOverride);
        if (t.hasOverride) {
          setTargetPercent(t.targetPercent);
          setCapitalBase(t.capitalBase);
        }
      })
      .catch(() => {
        // Daemon unreachable (or not configured here) — quietly keep the
        // RULE-010 default / live portfolioValue prop, same degrade-
        // gracefully convention every other on-demand API in this app uses.
        setHasOverride(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasOverride) return;
    setCapitalBase(portfolioValue);
  }, [portfolioValue, hasOverride]);
  useEffect(() => {
    if (hasOverride) return;
    setTargetPercent(defaultTargetPercent);
  }, [defaultTargetPercent, hasOverride]);

  function startEditing() {
    setTargetDraft(String(targetPercent));
    setCapitalDraft(String(capitalBase));
    setEditing(true);
  }

  // commit saves and closes the editor, with no Save/Cancel buttons:
  // tapping away from the inputs is the save gesture (see the container's
  // own onBlur for how "away" is detected). A bad value just reverts to
  // what was already stored rather than trapping the account holder in an
  // open form they now have no button to escape.
  async function commit() {
    if (!editing) return; // a stray blur after we've already closed
    if (isExampleClient()) {
      // Read-only demo: keep the edit visible but never attempt a write.
      setEditing(false);
      setSaveError("This is a read-only demo — changes aren't saved.");
      return;
    }
    const parsedTarget = parseFloat(targetDraft);
    const parsedCapital = parseFloat(capitalDraft);
    setEditing(false);
    if (Number.isNaN(parsedTarget) || parsedTarget <= 0 || Number.isNaN(parsedCapital) || parsedCapital <= 0) {
      setTargetDraft(String(targetPercent));
      setCapitalDraft(String(capitalBase));
      return;
    }
    if (parsedTarget === targetPercent && parsedCapital === capitalBase) {
      return; // nothing actually changed — don't spend a write on it
    }

    // Show the new numbers immediately, then reconcile: an auto-save has
    // no button to report progress on, so the alternative is a UI that
    // sits on stale values until the round-trip lands.
    const previous = { target: targetPercent, capital: capitalBase };
    setTargetPercent(parsedTarget);
    setCapitalBase(parsedCapital);
    setSaveError(null);
    try {
      await setMonthlyGoalTarget(parsedTarget, parsedCapital);
      setHasOverride(true);
    } catch {
      // Never leave the card showing a number that isn't actually stored.
      setTargetPercent(previous.target);
      setCapitalBase(previous.capital);
      setSaveError("Couldn't save — daemon unreachable.");
    }
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
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted">Realized</span>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-xs text-muted">
          {editing ? (
            // React's onBlur bubbles (it's focusout), so this one handler
            // covers both inputs: tabbing from the % field to the $ field
            // keeps focus INSIDE this span and must not save mid-edit, so
            // only a blur whose next-focused element is outside commits.
            // relatedTarget is null when focus leaves for nothing at all —
            // exactly the "tap somewhere else on the page" gesture this is
            // built around — which correctly falls through to commit().
            <span
              className="inline-flex flex-wrap items-center gap-1"
              onBlur={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                commit();
              }}
            >
              Target:{" "}
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                autoFocus
                className="w-14 rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-emerald-400 tabular"
              />
              % of $
              <input
                type="number"
                step="100"
                min="1"
                value={capitalDraft}
                onChange={(e) => setCapitalDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="w-24 rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-text tabular"
              />
            </span>
          ) : (
            <>
              Target: <span className="font-semibold text-emerald-400">{targetPercent.toFixed(2)}%</span> of{" "}
              <Amt>{fmtMoney(capitalBase)}</Amt>{" "}
              <button
                onClick={startEditing}
                title="Edit target % or capital base"
                className="text-muted/60 hover:text-text"
              >
                ✏️
              </button>
            </>
          )}
          {saveError && <div className="mt-0.5 text-[11px] text-rose-400">{saveError}</div>}
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
