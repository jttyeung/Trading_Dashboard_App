"use client";

import { useEffect, useState } from "react";
import { DEMO_MODE } from "@/lib/demo";
import { fetchAuthStatus } from "@/lib/auth-api";

// useSchwabConnected reports whether the daemon currently holds a usable
// Schwab session: true/false once known, null while unknown (still
// checking, or no daemon reachable from this device).
//
// Demo behaviour is deliberate. A public demo build has no daemon behind
// it at all, so the fetch would resolve to the VIEWER's own machine on
// port 8094 and fail — harmless, but it would surface a broken-looking
// "can't reach the daemon" state and put a live auth endpoint in front of
// a stranger. In DEMO_MODE this reports a healthy connection without ever
// making the request, matching how every other screen serves synthetic
// data rather than an empty/error state (see lib/demo.ts).
//
// null (not false) is the "don't know" answer on purpose: callers use it
// to stay quiet rather than showing a scary disconnected badge on a
// dashboard that simply has no daemon behind it.
export function useSchwabConnected(pollMs = 5 * 60 * 1000): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(DEMO_MODE ? true : null);

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    function check() {
      fetchAuthStatus()
        .then((status) => {
          if (!cancelled) setConnected(status.connected);
        })
        .catch(() => {
          if (!cancelled) setConnected(null); // unreachable — unknown, not disconnected
        });
    }
    check();
    const id = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return connected;
}
