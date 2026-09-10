"use client";

import { useEffect, useState } from "react";
import { DEMO_MODE } from "@/lib/demo";
import { fetchAuthStatus } from "@/lib/auth-api";
import { fetchETradeAuthStatus } from "@/lib/etrade-auth-api";

// useAnyConnectionDown reports whether ANY brokerage connection this app
// manages (Schwab, E*TRADE) is currently down and actionable -- the nav
// rail's red dot lights for this, not for each connection separately, so
// a glance at either nav tells the account holder "something here needs
// you" regardless of which one it is.
//
// True only for a connection that's genuinely disconnected -- never for
// one that's simply not configured (E*TRADE is optional; see
// ETradeAuthStatus.configured) or unreachable (the daemon itself isn't
// running, or a demo build with nothing behind it): "unknown" isn't the
// same as "down," so an unreachable check just leaves the dot off rather
// than lighting a false alarm. Returns a plain boolean (not
// boolean | null): for a dot indicator, "unknown" and "not down" render
// identically anyway (no dot), so there's no third state worth exposing
// to callers here.
const CONNECTIONS_CHANGED_EVENT = "optionseval:connections-changed";

// notifyConnectionsChanged tells every mounted useAnyConnectionDown to
// re-check immediately. Called by the reconnect flows the moment one
// succeeds: the poll interval alone would leave the nav's red dot lit
// for up to pollMs after the account holder has already fixed the very
// thing it's complaining about. A window event rather than a callback
// prop because the reconnect components render in two different places
// (the desktop shell's Connections tab and the standalone /reconnect
// page) and neither one owns the nav that draws the dot.
export function notifyConnectionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONNECTIONS_CHANGED_EVENT));
}

export function useAnyConnectionDown(pollMs = 5 * 60 * 1000): boolean {
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    function check() {
      Promise.allSettled([fetchAuthStatus(), fetchETradeAuthStatus()]).then(([schwab, etrade]) => {
        if (cancelled) return;
        const schwabDown = schwab.status === "fulfilled" && !schwab.value.connected;
        const etradeDown = etrade.status === "fulfilled" && etrade.value.configured && !etrade.value.connected;
        setDown(schwabDown || etradeDown);
      });
    }
    check();
    const id = setInterval(check, pollMs);
    window.addEventListener(CONNECTIONS_CHANGED_EVENT, check);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener(CONNECTIONS_CHANGED_EVENT, check);
    };
  }, [pollMs]);

  return down;
}
