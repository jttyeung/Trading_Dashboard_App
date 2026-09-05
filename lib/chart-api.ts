// Client-side call into OptionsEvaluator's small localhost-only chart API
// (internal/chartapi) -- mirrors lib/paperbot-api.ts's exact fetch/error
// shape and same-machine-only caveat: only reachable when the dashboard
// runs on the SAME machine as the OptionsEvaluator daemon.
const CHART_API_BASE = "http://localhost:8092"; // matches CHART_API_PORT's own default in config/.env.example

export interface BollingerPoint {
  upper: number;
  mid: number;
  lower: number;
}

export interface ChartData {
  symbol: string;
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
  sma200: (number | null)[];
  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
}

export async function fetchChart(symbol: string): Promise<ChartData> {
  const res = await fetch(`${CHART_API_BASE}/chart?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    throw new Error(`chart API failed for ${symbol}: ${res.status}`);
  }
  return res.json();
}
