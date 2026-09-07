// Client-side call into OptionsEvaluator's small chart API
// (internal/chartapi) -- mirrors lib/paperbot-api.ts's exact fetch/error
// shape and same-caveat: only reachable when the OptionsEvaluator daemon
// is running on whatever host actually serves this dashboard, on
// CHART_API_PORT (8092 by default).
//
// A real bug this fixes, not a stylistic choice: this used to be
// hardcoded to "http://localhost:8092", which only ever worked when the
// dashboard was viewed on the SAME machine as the daemon. The account
// holder views this on their phone over Tailscale -- "localhost" in a
// fetch made by the PHONE's own browser means the phone itself, which
// has nothing listening on 8092, so the request could never succeed no
// matter how the daemon's own CORS/bind settings were configured.
// window.location.hostname is whatever host the page was ACTUALLY loaded
// from (a Tailscale IP/hostname, a LAN IP, or localhost), so the chart
// API request always targets the same real machine the dashboard itself
// came from.
function chartAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8092";
  return `http://${window.location.hostname}:8092`;
}

export interface BollingerPoint {
  upper: number;
  mid: number;
  lower: number;
}

export interface Cross {
  date: string;
  type: "golden" | "death";
}

export interface ChartData {
  symbol: string;
  companyName?: string;
  spotPrice: number;
  dates: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  bollinger: (BollingerPoint | null)[];
  macd: {
    line: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
  };
  rsi14: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  // Every 50/200-day SMA golden/death cross across the chart's history.
  crosses: Cross[];
  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
}

export async function fetchChart(symbol: string): Promise<ChartData> {
  const res = await fetch(`${chartAPIBase()}/chart?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    throw new Error(`chart API failed for ${symbol}: ${res.status}`);
  }
  return res.json();
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

export async function fetchMarketStatus(): Promise<MarketStatus> {
  const res = await fetch(`${chartAPIBase()}/market-status`);
  if (!res.ok) {
    throw new Error(`market-status API failed: ${res.status}`);
  }
  return res.json();
}
