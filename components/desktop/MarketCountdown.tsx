"use client";

import { useEffect, useState } from "react";
import { nextMarketTransition } from "@/lib/market-hours";
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

  useEffect(() => {
    function tick() {
      const t = nextMarketTransition();
      // isTradingDay === false means today is a real, Schwab-confirmed
      // market holiday -- override the pure weekday+time math, which has
      // no holiday awareness by design (see lib/market-hours.ts). Real
      // bug this fixes: a holiday Monday like Labor Day read as "MARKET
      // OPEN" under the pure check alone.
      const open = isTradingDay === false ? false : t.open;
      setState({ open, remainingMs: t.at.getTime() - Date.now() });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isTradingDay]);

  if (!state) return null;

  // A holiday's own "next open" isn't computed precisely here (the pure
  // math below has no holiday calendar to walk forward against) -- rather
  // than show a countdown that's confidently wrong, just say "holiday"
  // once we know today isn't a real trading day at all.
  const holiday = isTradingDay === false;

  const style = state.open
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style}`}>
      {state.open ? "MARKET OPEN" : "MARKET CLOSED"} ·{" "}
      {holiday ? "holiday" : `${state.open ? "closes in" : "opens in"} ${formatCountdown(state.remainingMs)}`}
    </span>
  );
}
