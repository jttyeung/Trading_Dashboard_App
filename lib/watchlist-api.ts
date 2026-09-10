// Client-side call into OptionsEvaluator's small watchlist API
// (internal/watchlistapi) -- mirrors lib/chart-api.ts's/lib/paperbot-api.ts's
// exact fetch/error shape and same-caveat: only reachable when the
// OptionsEvaluator daemon is running on whatever host actually serves this
// dashboard, on WATCHLIST_API_PORT (8093 by default). window.location.hostname
// (not a hardcoded "localhost") is load-bearing here for the same reason
// documented in lib/chart-api.ts -- a phone reaching this over Tailscale needs
// the request to target the SAME host the page itself was loaded from.
function watchlistAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8093";
  return `${window.location.protocol}//${window.location.hostname}:8093`;
}

export interface WatchlistRow {
  ticker: string;
  company: string;
  sector: string;
  category: string;
  source: "sheet" | "manual";
  currentPrice: number | null;
  bollingerUpper: number | null;
  bollingerMid: number | null;
  bollingerLower: number | null;
  rsi14: number | null;
  ivRank: number | null;
  ivRankSamples: number;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  callWall: number | null;
  putWall: number | null;
}

export async function fetchWatchlist(): Promise<WatchlistRow[]> {
  const res = await fetch(`${watchlistAPIBase()}/watchlist`);
  if (!res.ok) {
    throw new Error(`watchlist API failed: ${res.status}`);
  }
  return res.json();
}

async function postTicker(path: string, ticker: string): Promise<WatchlistRow[]> {
  const res = await fetch(`${watchlistAPIBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `watchlist API failed: ${res.status}`);
  }
  return res.json();
}

export function addWatchlistTicker(ticker: string): Promise<WatchlistRow[]> {
  return postTicker("/watchlist/add", ticker);
}

export function removeWatchlistTicker(ticker: string): Promise<WatchlistRow[]> {
  return postTicker("/watchlist/remove", ticker);
}
