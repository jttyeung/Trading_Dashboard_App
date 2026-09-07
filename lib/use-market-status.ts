"use client";

import { useEffect, useState } from "react";
import { fetchMarketStatus } from "@/lib/chart-api";
import { isRegularSession } from "@/lib/market-hours";

// useMarketStatus polls OptionsEvaluator's own real, holiday-aware
// market-status check (internal/chartapi's /market-status, backed by
// marketclock.IsTradingDay against Schwab's own exchange calendar) so
// the dashboard's market-open state agrees with what the daemon itself
// actually did that day. Fixes a real bug: the previous pure
// isRegularSession() check (weekday + time-of-day only, no holiday
// awareness by design) showed "MARKET OPEN" on a real Labor Day.
//
// isTradingDay is null until the first live check resolves, or if the
// daemon isn't reachable from this browser at all (a demo deployment
// with no live daemon, or a genuine network hiccup) -- in either case
// `open` falls back to the pure isRegularSession() check, the same
// still-mostly-correct behavior this hook replaces, rather than the UI
// getting stuck or showing nothing.
export function useMarketStatus(pollMs = 5 * 60 * 1000): { open: boolean; isTradingDay: boolean | null } {
  const [state, setState] = useState<{ open: boolean; isTradingDay: boolean | null }>(() => ({
    open: isRegularSession(),
    isTradingDay: null,
  }));

  useEffect(() => {
    let cancelled = false;
    function check() {
      fetchMarketStatus()
        .then((status) => {
          if (cancelled) return;
          setState({ open: status.isOpen, isTradingDay: status.isTradingDay });
        })
        .catch(() => {
          if (cancelled) return;
          setState((prev) => ({ open: isRegularSession(), isTradingDay: prev.isTradingDay }));
        });
    }
    check();
    const id = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return state;
}
