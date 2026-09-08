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
import { useSchwabConnected } from "@/lib/use-schwab-connected";

export function SchwabConnectionPill() {
  const connected = useSchwabConnected();
  // Only ever shown for a definite false. null means unknown (no daemon
  // reachable, or a demo build) -- a dashboard with nothing behind it
  // shouldn't display an alarming banner it can't act on.
  const disconnected = connected === false;

  // null stays invisible (unknown/demo), but a healthy session now shows a
  // quiet link rather than nothing: the account holder couldn't find the
  // reconnect page when it only appeared after the session had already
  // died, which is the worst moment to go looking for it.
  if (connected === null) return null;

  return (
    <Link
      href="/reconnect"
      title="Schwab connection"
      className={
        disconnected
          ? "rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
          : "rounded-full px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-inset ring-border hover:text-text"
      }
    >
      {disconnected ? "⚠️ SCHWAB DISCONNECTED · reconnect" : "🔌 Schwab"}
    </Link>
  );
}
