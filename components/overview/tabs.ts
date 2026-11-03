// Tab ids and the saved-tab key for the /desktop landing page. A plain module
// (not "use client") so the server page can validate a ?tab= or cookie value
// without importing a client component.
export type Tab = "desktop" | "trades" | "bot-safe" | "bot" | "bot-aggressive" | "scorecard" | "autotrader" | "calculator" | "chart" | "watchlist" | "spx" | "connections";

// "desktop" (Open Positions) is reached from the rail's Home icon, not a tab
// button, but it is still a tab that gets saved, so it must be restorable.
export const ALL_TABS: Tab[] = ["desktop", "trades", "bot", "bot-safe", "bot-aggressive", "scorecard", "autotrader", "calculator", "chart", "watchlist", "spx", "connections"];

// Cookie and localStorage both use this key. The cookie is what lets the
// server render the saved tab on the first paint instead of the default.
export const TAB_KEY = "overviewActiveTab";

export function parseTab(raw: string | null | undefined): Tab | null {
  return raw && (ALL_TABS as string[]).includes(raw) ? (raw as Tab) : null;
}
