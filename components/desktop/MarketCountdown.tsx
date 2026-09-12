"use client";

import { useEffect, useState } from "react";
import { etDateString, etOpenAt, nextMarketTransition } from "@/lib/market-hours";
import { fetchMarketStatus } from "@/lib/chart-api";
import { isExampleClient } from "@/lib/demo";
import { useMarketStatus } from "@/lib/use-market-status";

// formatCountdown renders "hours down to seconds" literally — H:MM:SS,
// no leading zero on the hour (a countdown reading "0:04:12" near close
// is clearer than "00:04:12").
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// findNextRealOpen walks forward day by day from `now`, asking
// OptionsEvaluator's own real exchange-calendar check (GET /market-status
// ?date=...) about each candidate date, until it finds one that's an
// actual trading day -- Schwab's endpoint reports a weekend closed the
// same way it reports a holiday closed, so no separate weekday filter is
// needed client-side. Returns that date's 9:30 ET open as a real Date, by
// asking nextMarketTransition to resolve a "day at 9:30" moment once we
// know which calendar day is the right one (reusing its own ET-correct
// time construction rather than duplicating it here).
//
// Bounded to 10 days -- there is no real NYSE closure anywhere close to
// that long, so hitting the bound only ever means the daemon is
// unreachable; the caller falls back to the pure (holiday-unaware) guess
// in that case rather than leaving the countdown stuck.
async function findNextRealOpen(now: Date): Promise<Date | null> {
  for (let i = 1; i <= 10; i++) {
    const candidate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const date = etDateString(candidate);
    try {
      const status = await fetchMarketStatus(date);
      if (status.isTradingDay) {
        return etOpenAt(candidate);
      }
    } catch {
      return null; // daemon unreachable -- let the caller fall back
    }
  }
  return null;
}

// MarketCountdown ticks its own clock client-side (a live HH:MM:SS
// countdown can't be server-rendered once and left static). Starts at
// null rather than reading the wall clock during render — Date.now()/
// nextMarketTransition() are impure and React's own rules disallow
// calling them in the render body, even via a useState lazy initializer
// — so the very first paint shows nothing until the effect below runs
// (essentially immediate after mount) and populates real state, then
// re-ticks every second after, self-correcting exactly at the moment
// the market actually opens or closes.
export function MarketCountdown() {
  const [state, setState] = useState<{ open: boolean; remainingMs: number } | null>(null);
  const { isTradingDay } = useMarketStatus();
  // Only populated when isTradingDay === false -- the real "next open"
  // found by walking forward past the holiday (see findNextRealOpen).
  // null while that lookup is in flight or unavailable, in which case
  // the pure (holiday-unaware) guess is used instead rather than
  // leaving the countdown stuck on nothing.
  const [nextRealOpen, setNextRealOpen] = useState<Date | null>(null);

  useEffect(() => {
    if (isTradingDay !== false) {
      setNextRealOpen(null);
      return;
    }
    // Explicit demo guard, not just the transitive one. Today this branch is
    // unreachable in a demo (useMarketStatus skips its poll there, so
    // isTradingDay never becomes false), but that's a property of another
    // hook -- a future change to it must not be what decides whether a
    // public build starts probing a daemon it can't reach.
    if (isExampleClient()) return;
    let cancelled = false;
    findNextRealOpen(new Date()).then((at) => {
      if (!cancelled) setNextRealOpen(at);
    });
    return () => {
      cancelled = true;
    };
  }, [isTradingDay]);

  useEffect(() => {
    function tick() {
      const t = nextMarketTransition();
      // isTradingDay === false means today is a real, Schwab-confirmed
      // market holiday -- override the pure weekday+time math, which has
      // no holiday awareness by design (see lib/market-hours.ts). Real
      // bug this fixes: a holiday Monday like Labor Day read as "MARKET
      // OPEN" under the pure check alone. The countdown TARGET is also
      // overridden once findNextRealOpen resolves the real next trading
      // day (a holiday can push it a day or more past the pure guess);
      // until then, the pure guess is shown rather than nothing.
      const open = isTradingDay === false ? false : t.open;
      const at = isTradingDay === false && nextRealOpen ? nextRealOpen : t.at;
      setState({ open, remainingMs: at.getTime() - Date.now() });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTradingDay, nextRealOpen]);

  if (!state) return null;

  const style = state.open
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style}`}>
      {state.open ? "☀️ MARKET OPEN" : "🌙 MARKET CLOSED"} · {state.open ? "closes in" : "opens in"}{" "}
      {formatCountdown(state.remainingMs)}
    </span>
  );
}
