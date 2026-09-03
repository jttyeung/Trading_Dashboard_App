"use client";

import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import type { Alert } from "@/lib/types";

const ACTION_STYLE: Record<Alert["action"], { label: string; chip: string }> = {
  close: { label: "Close", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  roll: { label: "Roll", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  watch: { label: "Watch", chip: "bg-violet-500/15 text-violet-300 ring-violet-500/30" },
  monitor: { label: "Monitor", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  // Emerald, not one of the risk colors above — this is a positive signal
  // ("you hit your target"), not an assignment/expiration risk warning.
  profit_target: { label: "Profit target", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  // A LEAP's own approaching-expiration heads-up — distinct from the
  // generic short-position monitor so the desktop table can give it its
  // own ⚠️ ticker icon (see PositionsTable.tsx) without also lighting up
  // on every CSP/CC nearing its own 21-DTE window.
  leap_expiring: { label: "Expiring", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  // A short CSP that's run well clear of its strike with a genuinely
  // better higher-strike roll available nearby in time — opportunistic
  // ("chase more credit"), not a risk warning, so it gets its own green
  // treatment distinct from ActionRoll's amber "at risk" framing.
  roll_up: { label: "Roll up", chip: "bg-green-500/15 text-green-300 ring-green-500/30" },
};

// Position alerts (close/roll/watch/monitor/profit_target/leap_expiring/
// roll_up) — always the tracker's current full set, not history
// (position_alerts is wiped and rewritten each cycle). Sorted with close
// first, then roll (already ITM), then watch (still OTM but delta rising
// — a proactive early warning, not yet urgent), then monitor, then
// leap_expiring (a LEAP-specific variant of the same "heads up" urgency
// as monitor), then profit_target (a "nice problem to have," not a
// risk), then roll_up last — purely opportunistic (chase more credit on
// an already-winning position), the least urgent of all — since that's
// roughly urgency order; ties broken by DTE (soonest first).
const ACTION_RANK: Record<Alert["action"], number> = {
  close: 0,
  roll: 1,
  watch: 2,
  monitor: 3,
  leap_expiring: 4,
  profit_target: 5,
  roll_up: 6,
};

// READ_KEY: which alerts the viewer has already reviewed, persisted per
// browser (localStorage, same pattern as margin-mode.tsx's own toggle) —
// this is a per-viewer convenience, not something the backend needs to
// know about, and every 15-min cycle re-derives the same full alert set
// regardless (see this file's own doc comment above), so there's no
// server-side "read" concept to sync against. Keyed by contractSymbol:
// if the SAME contract's alert later changes (e.g. escalates from Watch
// to Roll), it stays collapsed here rather than re-surfacing — a known,
// accepted simplification rather than diffing each alert's own content.
const READ_KEY = "alertsRead";

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveRead(read: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(read)));
  } catch {
    /* ignore */
  }
}

// ConvictionDots renders the account holder's own "green dots" score for
// a roll_up alert (profit captured, delta, target-strike support level —
// see internal/agents/tracker/roll_up.go's rollUpConviction) as 3 filled/
// hollow circles rather than a bare number, since the whole point was a
// glanceable visual, not another figure to read.
function ConvictionDots({ conviction }: { conviction: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" title={`${conviction}/3 conviction`}>
      {[0, 1, 2].map((i) => (
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
  useEffect(() => setRead(loadRead()), []);

  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => ACTION_RANK[a.action] - ACTION_RANK[b.action] || a.dte - b.dte);
  const unreadCount = sorted.filter((a) => !read.has(a.contractSymbol)).length;

  function toggleRead(symbol: string) {
    setRead((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      saveRead(next);
      return next;
    });
  }

  return (
    <>
      <SectionTitle
        action={unreadCount < sorted.length ? <span className="text-[11px] text-muted">{unreadCount} unread</span> : undefined}
      >
        Needs attention
      </SectionTitle>
      <Card className="divide-y divide-border p-0">
        {sorted.map((a) => {
          const style = ACTION_STYLE[a.action];
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
