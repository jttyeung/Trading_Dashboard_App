// Client-side calls into OptionsEvaluator's small chart API
// (internal/chartapi) -- mirrors lib/paperbot-api.ts's exact fetch/error
// shape. Two different paths on purpose:
//
// - fetchChart goes through this app's OWN route handler
//   (app/api/chart/route.ts), same origin as the page. The route proxies
//   to the daemon server-side (CHART_API_URL), so the browser never has to
//   reach port 8092 itself. This is upstream Trading_Dashboard_App's shape,
//   adopted because it retires an entire class of bugs this file used to
//   carry: "localhost" in a fetch made by the PHONE's browser means the
//   phone; a Tailscale hostname needs its own CORS allowlist entry; a
//   mixed-content block when the page is https. Server-side, none apply.
//
// - fetchMarketStatus still calls the daemon directly from the browser
//   via chartAPIBase() (window.location.hostname:8092). Still a candidate
//   to move behind a route the same way; left as-is in this pass.
export type { BollingerPoint, ChartData, Cross } from "./chart-indicators";
import type { ChartData } from "./chart-indicators";

function chartAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8092";
  return `${window.location.protocol}//${window.location.hostname}:8092`;
}

export async function fetchChart(symbol: string): Promise<ChartData> {
  const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  let body: (ChartData & { error?: string }) | { error?: string } | null = null;
  try {
    body = (await res.json()) as ChartData & { error?: string };
  } catch {
    body = null;
  }
  if (!res.ok || !body || ("error" in body && body.error)) {
    throw new Error(body && "error" in body && body.error ? body.error : `chart failed for ${symbol} (${res.status})`);
  }
  return body as ChartData;
}

// MarketStatus mirrors internal/chartapi's MarketStatusResponse -- the
// same real, Schwab-confirmed exchange-calendar check
// (marketclock.IsTradingDay) the daemon's own scheduler uses to skip a
// holiday like Labor Day, exposed read-only here so the dashboard's own
// "MARKET OPEN"/"MARKET CLOSED" indicator can agree with it instead of
// relying solely on lib/market-hours.ts's pure weekday+time math (which
// has no holiday awareness by design, and is what showed "open" on a
// real Labor Day).
export interface MarketStatus {
  date: string;
  isTradingDay: boolean;
  isOpen: boolean;
}

// date (YYYY-MM-DD, America/New_York) optionally asks about a day other
// than today -- used to walk forward past a holiday to find the next
// real trading day (see MarketCountdown.tsx's findNextRealOpen).
export async function fetchMarketStatus(date?: string): Promise<MarketStatus> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await fetch(`${chartAPIBase()}/market-status${qs}`);
  if (!res.ok) {
    throw new Error(`market-status API failed: ${res.status}`);
  }
  return res.json();
}
