"use client";

// Legacy privacy/masking shims. The old hide/mask behavior and its Example-mode
// toggle button were removed from the UI (kept getting stuck behind its exit PIN
// on mobile); the underlying example-dataset fallback in lib/example-mode.ts and
// lib/snapshot.ts is untouched, so a missing data/ dir still degrades gracefully.
import type { ReactNode } from "react";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function ShowAmounts({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export const usePrivacy = () => ({ hidden: false, toggle: () => {} });

/** Passthrough now that values are swapped at the data layer in example mode. */
export function Amt({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}
