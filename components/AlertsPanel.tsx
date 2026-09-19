"use client";

import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import type { Alert } from "@/lib/types";
import { fmtWeekdayShort, isStaleTradingDate } from "@/lib/dates";
import { fetchAlertReads, setAlertRead } from "@/lib/alert-reads-api";
import { isExampleClient } from "@/lib/demo";

const ACTION_STYLE: Record<Alert["action"], { label: string; chip: string }> = {
  close: { label: "Close", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  roll: { label: "Roll", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  watch: { label: "Watch", chip: "bg-violet-500/15 text-violet-300 ring-violet-500/30" },
  // Emerald, not one of the risk colors above — this is a positive signal
  // ("you hit your target"), not an assignment/expiration risk warning.
  profit_target: { label: "Profit target", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  // A LEAP's own approaching-expiration heads-up, its own ⚠️ ticker icon
  // (see PositionsTable.tsx).
  leap_expiring: { label: "Expiring", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  // A short CSP that's run well clear of its strike with a genuinely
  // better higher-strike roll available nearby in time — opportunistic
  // ("chase more credit"), not a risk warning, so it gets its own green
  // treatment distinct from ActionRoll's amber "at risk" framing.
  roll_up: { label: "Roll up", chip: "bg-green-500/15 text-green-300 ring-green-500/30" },
  // An ITM short option with no roll inside the debit cap
  // — assignment (or a manual close) is the realistic outcome.
  // Rose like Close (it IS an assignment-risk signal) but a heads-up,
  // not an action: there's deliberately no "roll to" line under it.
  assignment_likely: { label: "Assignment likely", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  // A held LEAP that's grown past the allocation caps — usually
  // from appreciation after a compliant entry, not a mistake.
  leaps_over_allocated: { label: "Over-allocated", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
};

// UNKNOWN_STYLE is what an action this build doesn't recognize yet gets
// — the backend adds actions on its own cadence, and a missing map entry
// used to throw on `style.chip` and take the whole panel down (a real
// gap: leaps_over_allocated shipped server-side before it was added
// here). Shown plainly with the raw action name so it's still legible.
const UNKNOWN_STYLE = { label: "", chip: "bg-surface-2 text-muted ring-border" };

// Position alerts (close/roll/watch/profit_target/leap_expiring/
// roll_up) — the tracker's current full set, not history
// (position_alerts is wiped and rewritten each cycle the tracker runs —
// core-cycle only, gated to real market hours on a real trading day, so
// over a weekend/holiday this is frozen at the last session's own real
// output rather than an empty or newly-recomputed set; see the asOf
// label below). Sorted with close
// first, then roll (already ITM), then watch (still OTM but delta rising
// — a proactive early warning, not yet urgent), then leap_expiring (a
// LEAP-specific "heads up" heading toward its own expiration), then
// profit_target (a "nice problem to have," not a risk), then roll_up
// last — purely opportunistic (chase more credit on an already-winning
// position), the least urgent of all — since that's roughly urgency
// order; ties broken by DTE (soonest first). The old generic "inside
// 21 DTE" monitor alert was dropped entirely (not a useful signal), so
// there's no rank entry for it any more.
const ACTION_RANK: Record<Alert["action"], number> = {
  close: 0,
  roll: 1,
  // Already ITM like roll, so it sorts right behind it — ahead of the
  // still-OTM watch — even though there's nothing to do but wait.
  assignment_likely: 2,
  watch: 3,
  leap_expiring: 4,
  leaps_over_allocated: 5,
  profit_target: 6,
  roll_up: 7,
};

function rankOf(a: Alert): number {
  return ACTION_RANK[a.action] ?? 99;
}

// Read state ("which alerts has the account holder already reviewed")
// lives on the backend (position_alert_reads via the :8095 settings API,
// see lib/alert-reads-api.ts) so a checkmark set on the desktop is the
// same checkmark on the phone. It used to be localStorage-only here,
// which didn't sync across devices -- the third per-viewer preference to
// hit that wall, after the roll target and the monthly goal. Keyed by
// contractSymbol: if the SAME contract's alert later changes (e.g.
// escalates from Watch to Roll), it stays collapsed rather than
// re-surfacing -- a known, accepted simplification carried over as-is.
//
// READ_KEY is now only the offline fallback: the demo build / example
// mode has no daemon to talk to, and so does a viewer whose daemon is
// momentarily unreachable. In both cases the checkmarks still work,
// just per-browser, exactly as before.
const READ_KEY = "alertsRead";

function loadLocalRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveLocalRead(read: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(read)));
  } catch {
    /* ignore */
  }
}

// ConvictionDots renders the account holder's own "green dots" score for
// a roll_up alert (profit captured, delta, target-strike support level,
// IV rank — see internal/agents/tracker/roll_up.go's rollUpConviction)
// as 4 filled/hollow circles rather than a bare number, since the whole
// point was a glanceable visual, not another figure to read.
function ConvictionDots({ conviction }: { conviction: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" title={`${conviction}/4 conviction`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < conviction ? "bg-green-400" : "bg-surface-2 ring-1 ring-inset ring-border"}`}
        />
      ))}
    </span>
  );
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  // Whether the backend answered: while false, toggles write to
  // localStorage only (demo build, or daemon unreachable). Flips to true
  // on the first successful GET and stays there -- a later transient
  // POST failure keeps the optimistic local state rather than silently
  // demoting the whole panel back to per-browser mode.
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (isExampleClient()) {
      setRead(loadLocalRead());
      return;
    }
    let cancelled = false;
    fetchAlertReads()
      .then((r) => {
        if (cancelled) return;
        setRead(new Set(r.contractSymbols));
        setSynced(true);
      })
      .catch(() => {
        // Daemon unreachable (or not configured here) -- degrade to the
        // per-browser checkmarks, same convention every other on-demand
        // API in this app uses.
        if (!cancelled) setRead(loadLocalRead());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => rankOf(a) - rankOf(b) || a.dte - b.dte);
  const unreadCount = sorted.filter((a) => !read.has(a.contractSymbol)).length;

  // The tracker only re-evaluates during real market hours (see
  // internal/marketclock's holiday-aware gate), so over a weekend or
  // holiday this whole set is exactly what the last real session
  // computed, frozen -- not a new alert, just what it looked like at
  // last open. Read off the OLDEST alert (not the newest): once even one
  // position has refreshed today, the newly-computed set as a whole is
  // current, and a still-open position that simply didn't trigger a new
  // alert isn't "stale," it's healthy.
  const asOf = sorted.length > 0 && sorted.every((a) => isStaleTradingDate(a.evaluatedAt))
    ? sorted[0].evaluatedAt.slice(0, 10)
    : null;

  function toggleRead(symbol: string) {
    const nowRead = !read.has(symbol);
    // Optimistic flip so the tap feels instant on a phone; the server's
    // echoed-back list then replaces it wholesale (never diffed), so if
    // another device toggled something in between, this one catches up.
    setRead((prev) => {
      const next = new Set(prev);
      if (nowRead) next.add(symbol);
      else next.delete(symbol);
      if (!synced) saveLocalRead(next);
      return next;
    });
    if (!synced) return;
    setAlertRead(symbol, nowRead)
      .then((r) => setRead(new Set(r.contractSymbols)))
      .catch(() => {
        /* keep the optimistic state; the next page load re-syncs */
      });
  }

  return (
    <>
      <SectionTitle
        action={unreadCount < sorted.length ? <span className="text-[11px] text-muted">{unreadCount} unread</span> : undefined}
      >
        Needs attention
        {asOf && (
          <span
            className="ml-2 text-[11px] font-normal text-muted"
            title="Markets have been closed since this was computed -- it'll refresh once trading resumes"
          >
            (as of {fmtWeekdayShort(asOf)})
          </span>
        )}
      </SectionTitle>
      <Card className="divide-y divide-border p-0">
        {sorted.map((a) => {
          const style = ACTION_STYLE[a.action] ?? { ...UNKNOWN_STYLE, label: a.action };
          const isRead = read.has(a.contractSymbol);
          return (
            <div key={a.contractSymbol} className={`px-4 py-3 ${isRead ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleRead(a.contractSymbol)}
                  title={isRead ? "Mark unread" : "Mark read"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors ${
                    isRead ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" : "text-muted/60 ring-border hover:text-text"
                  }`}
                >
                  ✓
                </button>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-semibold">{a.ticker}</span>
                  <span className="text-[11px] text-muted">
                    ${a.strike} {a.putCall} · {a.dte}d
                  </span>
                </div>
                {a.action === "roll_up" && <ConvictionDots conviction={a.rollUpConviction} />}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.chip}`}>
                  {style.label}
                </span>
              </div>
              {!isRead && (
                <>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{a.rationale}</p>
                  {a.rollToSymbol && (
                    <div
                      className={`mt-1.5 rounded-lg px-2 py-1.5 text-[11px] ring-1 ring-inset ${
                        a.action === "roll_up"
                          ? "bg-green-500/10 text-green-200 ring-green-500/20"
                          : "bg-amber-500/10 text-amber-200 ring-amber-500/20"
                      }`}
                    >
                      Roll to <span className="font-medium">${a.rollToStrike}</span> exp {a.rollToExpirationDate} (
                      {a.rollToDte} DTE, Δ{a.rollToDelta?.toFixed(2)}
                      {a.rollToNetCredit != null && (
                        <>
                          , net {a.rollToNetCredit >= 0 ? "credit" : "debit"} ${Math.abs(a.rollToNetCredit).toFixed(2)}/sh
                        </>
                      )}
                      )
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
