// Insider activity and 5%+ holders for the chart page, proxied from
// OptionsEvaluator's chart API (CHART_API_URL) like /api/financials, so the
// browser never reaches the daemon's port itself. Example mode returns a
// synthetic fixture.
//
// GET /api/ownership?symbol=GLW → Ownership (lib/ownership.ts) or { error }.
import { isExampleMode } from "@/lib/example-mode";
import { exampleOwnership } from "@/lib/example-ownership";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const CHART_API_URL = (process.env.CHART_API_URL ?? "http://localhost:8092").replace(/\/+$/, "");
// A cold ticker reads the SEC filing index plus up to ~15 small 13G documents.
const DAEMON_TIMEOUT_MS = 25_000;

export async function GET(req: Request) {
  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!TICKER_RE.test(symbol)) {
    return Response.json({ error: "Enter a ticker like GLW or BRK.B." }, { status: 400 });
  }
  if (await isExampleMode()) return Response.json(exampleOwnership(symbol));

  try {
    const res = await fetch(`${CHART_API_URL}/ownership?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 404) {
      // The route isn't registered: the daemon is missing SEC_USER_AGENT or a Finnhub key.
      return Response.json({ error: "Insider data is off: the daemon needs SEC_USER_AGENT and FINNHUB_API_KEY." }, { status: 404 });
    }
    if (!res.ok || !body) {
      return Response.json({ error: body?.error ?? `Insider data unavailable (${res.status}).` }, { status: 502 });
    }
    return Response.json(body);
  } catch {
    return Response.json({ error: "Insider data needs the OptionsEvaluator daemon, which isn't answering." }, { status: 502 });
  }
}
