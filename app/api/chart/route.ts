// On-demand daily chart for one ticker, served from this app's own origin so
// the browser never has to reach the data bridge's port itself (see
// lib/chart-api.ts for the phone-over-Tailscale bug that motivated this).
//
// Two sources, tried in order:
//
// 1. OptionsEvaluator's chartapi (CHART_API_URL, default localhost:8092):
//    Schwab bars — the same series the daemon's own indicators and screener
//    read, so the chart agrees with the picks — plus call/put walls and the
//    gamma flip computed live from the option chain for ANY ticker, not just
//    held ones. Preferred whenever the daemon is up.
// 2. Yahoo Finance's public chart endpoint, with every indicator computed
//    here (lib/chart-indicators.ts) and walls only for held names from the
//    snapshot. Upstream Trading_Dashboard_App's original path — kept as the
//    fallback so the page still works with the daemon down, on the Pi, or on
//    a deployment that has no daemon at all.
//
// Example mode returns the synthetic fixture so a public demo never reaches
// out to either.
//
// GET /api/chart?symbol=GLW → ChartData (lib/chart-indicators.ts) or { error }.
import { isExampleMode } from "@/lib/example-mode";
import { exampleChartData } from "@/lib/example";
import { getSnapshot } from "@/lib/snapshot";
import { buildChartData, type ChartData } from "@/lib/chart-indicators";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const CACHE_TTL_MS = 10 * 60 * 1000; // Yahoo rate-limits; a chart doesn't change inside ten minutes
const cache = new Map<string, { at: number; data: ChartData }>();

// Server-side only — never NEXT_PUBLIC_, the browser must not learn or need
// the daemon's address. Docker: the daemon is a sibling container/host, so
// this is what to override there.
const CHART_API_URL = (process.env.CHART_API_URL ?? "http://localhost:8092").replace(/\/+$/, "");
const DAEMON_TIMEOUT_MS = 20_000; // a cold chart needs a Schwab history call plus a chain pull for walls

// The daemon's chart is authoritative when it answers: same bars the screener
// uses, live walls for any ticker. Returns null on any failure so the caller
// falls through to Yahoo rather than surfacing "daemon down" as the error.
async function fetchDaemonChart(symbol: string): Promise<ChartData | null> {
  try {
    const res = await fetch(`${CHART_API_URL}/chart?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ChartData;
    if (!Array.isArray(data.dates) || data.dates.length === 0) return null;
    return { ...data, asOf: data.asOf ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

// Yahoo's chart JSON, only the parts read here.
interface YahooChart {
  chart?: {
    result?: {
      meta?: { longName?: string; shortName?: string; regularMarketPrice?: number; exchangeTimezoneName?: string };
      timestamp?: number[];
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] };
    }[];
    error?: { code?: string; description?: string } | null;
  };
}

function toDateInZone(tsSec: number, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD; the exchange zone keeps a bar on its own trading day.
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(tsSec * 1000));
  } catch {
    return new Date(tsSec * 1000).toISOString().slice(0, 10);
  }
}

async function fetchYahooBars(symbol: string) {
  const yf = symbol.replace(".", "-"); // Schwab's BRK.B is Yahoo's BRK-B
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yf)}?range=2y&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (portfolio-dashboard chart)", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 404) return { error: `No price history for ${symbol}.` } as const;
  if (!res.ok) return { error: `Yahoo Finance answered ${res.status} for ${symbol}.` } as const;
  const json = (await res.json()) as YahooChart;
  const r = json.chart?.result?.[0];
  if (!r || json.chart?.error) return { error: json.chart?.error?.description ?? `No price history for ${symbol}.` } as const;
  const q = r.indicators?.quote?.[0];
  const ts = r.timestamp ?? [];
  if (!q || ts.length === 0) return { error: `No price history for ${symbol}.` } as const;

  const tz = r.meta?.exchangeTimezoneName || "America/New_York";
  const dates: string[] = [];
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue; // a holiday/partial bar
    dates.push(toDateInZone(ts[i], tz));
    open.push(o);
    high.push(h);
    low.push(l);
    close.push(c);
  }
  if (close.length < 30) return { error: `Not enough history to chart ${symbol}.` } as const;
  return {
    bars: { dates, open, high, low, close },
    companyName: r.meta?.longName || r.meta?.shortName || undefined,
    spotPrice: r.meta?.regularMarketPrice ?? null,
  } as const;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("symbol") ?? "";
  const symbol = raw.trim().toUpperCase();
  if (!TICKER_RE.test(symbol)) {
    return Response.json({ error: "Enter a ticker like GLW or BRK.B." }, { status: 400 });
  }

  if (await isExampleMode()) return Response.json(exampleChartData(symbol));

  // Not cached: the daemon computes on demand and the whole point of asking
  // it is a fresh chain read for the walls. Only the Yahoo fallback below is
  // cached, for its rate limit.
  const fromDaemon = await fetchDaemonChart(symbol);
  if (fromDaemon) return Response.json(fromDaemon);

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Response.json(hit.data);

  let fetched: Awaited<ReturnType<typeof fetchYahooBars>>;
  try {
    fetched = await fetchYahooBars(symbol);
  } catch (e) {
    const msg = e instanceof Error && e.name === "TimeoutError" ? "Yahoo Finance timed out." : "Couldn't reach Yahoo Finance.";
    return Response.json({ error: msg }, { status: 502 });
  }
  if ("error" in fetched) return Response.json({ error: fetched.error }, { status: 404 });

  // Gamma walls: the bridge writes them onto held equities (≥100 shares) in the
  // snapshot, so a held name gets its walls for free; anything else has none.
  let walls: { callWall: number | null; putWall: number | null; gammaFlip: number | null } = { callWall: null, putWall: null, gammaFlip: null };
  try {
    const snap = await getSnapshot();
    for (const acct of Object.values(snap.data)) {
      const eq = acct.equities.find((e) => e.symbol.toUpperCase() === symbol && e.gamma);
      if (eq?.gamma) {
        walls = { callWall: eq.gamma.callWall, putWall: eq.gamma.putWall, gammaFlip: eq.gamma.flip };
        break;
      }
    }
  } catch {
    // no snapshot — chart without walls
  }

  const data = buildChartData(symbol, fetched.bars, {
    companyName: fetched.companyName,
    spotPrice: fetched.spotPrice,
    ...walls,
    asOf: new Date().toISOString(),
  });
  cache.set(symbol, { at: Date.now(), data });
  return Response.json(data);
}
