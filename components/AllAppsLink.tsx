"use client";

// Back to the tailnet landing page (deploy/pi-landing in OptionsEvaluator,
// served by tailscale itself on 443). It's a different origin from this app's
// :3001, so the URL is built from the hostname the browser already used — the
// tailnet name never lands in the repo. Renders nothing on loopback (no landing
// page there) and in the public demo build.
import { useSyncExternalStore } from "react";
import { DEMO_MODE } from "@/lib/demo";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

const subscribe = () => () => {};
const landingUrl = () =>
  DEMO_MODE || LOOPBACK.has(window.location.hostname)
    ? null
    : `${window.location.protocol}//${window.location.hostname}/`;

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

/** `pill` sits in a page header beside Settings; `fixed` floats top-left on the wide pages; `rail` is the tablet side-rail row. */
export function AllAppsLink({ variant }: { variant: "pill" | "fixed" | "rail" }) {
  // useSyncExternalStore gives null on the server and during hydration, then the
  // real URL — no setState-in-effect, no hydration mismatch.
  const href = useSyncExternalStore(subscribe, landingUrl, () => null);
  if (!href) return null;

  const cls = {
    pill: "relative flex items-center rounded-full bg-surface-2 p-2 text-muted ring-1 ring-inset ring-border active:bg-surface",
    fixed:
      "fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm hover:bg-surface-2 hover:text-text",
    rail: "flex items-center gap-1.5 rounded-[9px] border border-border px-2 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-text",
  }[variant];

  return (
    <a href={href} aria-label="All apps" title="All apps" className={cls}>
      <GridIcon />
      {variant === "rail" && "All apps"}
    </a>
  );
}
