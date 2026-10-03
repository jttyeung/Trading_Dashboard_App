// Options volume leaders for the chart page, proxied from OptionsEvaluator's
// chart API (CHART_API_URL). Database-only on the daemon side, so cheap to
// call. Example mode returns a synthetic fixture.
//
// GET /api/options-volume → OptionsVolume (lib/options-volume.ts) or { error }.
import { isExampleMode } from "@/lib/example-mode";
import { BRIDGE } from "@/lib/features";
import { exampleOptionsVolume } from "@/lib/example-options-volume";

export const dynamic = "force-dynamic";

const CHART_API_URL = (process.env.CHART_API_URL ?? "http://localhost:8092").replace(/\/+$/, "");

export async function GET() {
  if (BRIDGE) return new Response(null, { status: 404 }); // OptionsEvaluator-only; see lib/features.ts
  if (await isExampleMode()) return Response.json(exampleOptionsVolume());
  try {
    // 50, not 20: the page re-ranks by contracts as well as premium, and the
    // top 20 by one isn't the top 20 by the other.
    const res = await fetch(`${CHART_API_URL}/options-volume?limit=50`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      return Response.json({ error: body?.error ?? `Options volume unavailable (${res.status}).` }, { status: 502 });
    }
    return Response.json(body);
  } catch {
    return Response.json({ error: "Options volume needs the OptionsEvaluator daemon, which isn't answering." }, { status: 502 });
  }
}
