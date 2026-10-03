// Company financials for the chart page, proxied from OptionsEvaluator's chart
// API (CHART_API_URL, same daemon /api/chart prefers) so the browser never
// reaches the daemon's port itself. Unlike the chart there's no Yahoo-style
// fallback: with the daemon down the panel just says so.
//
// Example mode returns a synthetic fixture so a public demo never reaches out.
//
// GET /api/financials?symbol=IREN → Financials (lib/financials.ts), or
// { error } with 404 when the ticker has no SEC filings.
import { isExampleMode } from "@/lib/example-mode";
import { BRIDGE } from "@/lib/features";
import { exampleFinancials } from "@/lib/example-financials";

export const dynamic = "force-dynamic";

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const CHART_API_URL = (process.env.CHART_API_URL ?? "http://localhost:8092").replace(/\/+$/, "");
// A cold ticker is one ~1MB EDGAR download plus a Finnhub call, run in parallel.
const DAEMON_TIMEOUT_MS = 20_000;

export async function GET(req: Request) {
  if (BRIDGE) return new Response(null, { status: 404 }); // OptionsEvaluator-only; see lib/features.ts
  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!TICKER_RE.test(symbol)) {
    return Response.json({ error: "Enter a ticker like GLW or BRK.B." }, { status: 400 });
  }
  if (await isExampleMode()) return Response.json(exampleFinancials(symbol));

  try {
    const res = await fetch(`${CHART_API_URL}/financials?symbol=${encodeURIComponent(symbol)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    if (res.status === 404) {
      // The daemon's own "no filings" answer carries an error message; a bare
      // 404 means it's running without SEC_USER_AGENT (route not registered).
      const msg = body?.error ?? "Financials are off: set SEC_USER_AGENT in the daemon's config/.env.";
      return Response.json({ error: msg }, { status: 404 });
    }
    if (!res.ok || !body) {
      return Response.json({ error: body?.error ?? `Financials unavailable (${res.status}).` }, { status: 502 });
    }
    return Response.json(body);
  } catch {
    return Response.json({ error: "Financials need the OptionsEvaluator daemon, which isn't answering." }, { status: 502 });
  }
}
