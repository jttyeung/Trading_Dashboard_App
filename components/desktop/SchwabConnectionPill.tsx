"use client";

// A compact "Schwab disconnected" pill for the desktop toolbar, linking
// straight to /reconnect. Renders NOTHING while the connection is
// healthy (the common case) or while the daemon is unreachable — a
// dashboard opened with no daemon behind it (a demo deployment) would
// otherwise permanently show a scary red banner it can't do anything
// about.
//
// This exists because the failure it reports is otherwise silent: a dead
// Schwab session makes every agent log-and-skip, and the exporter fills
// in zeros rather than failing, so Today P/L, marks and Greeks quietly
// read blank with nothing on screen saying why.
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchAuthStatus } from "@/lib/auth-api";

export function SchwabConnectionPill({ pollMs = 5 * 60 * 1000 }: { pollMs?: number }) {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function check() {
      fetchAuthStatus()
        .then((status) => {
          if (!cancelled) setDisconnected(!status.connected);
        })
        .catch(() => {
          if (!cancelled) setDisconnected(false); // daemon unreachable — stay quiet
        });
    }
    check();
    const id = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pollMs]);

  if (!disconnected) return null;

  return (
    <Link
      href="/reconnect"
      className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
    >
      ⚠️ SCHWAB DISCONNECTED · reconnect
    </Link>
  );
}
