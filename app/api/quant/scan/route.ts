// Ask the bridge to run the quant CSP scan right now. Write-only: drops a marker
// into the bridge's task_inbox/; the bridge scans the approved list and reports
// back through the app's own data/ folder (read via /api/quant/status).
import { demoBlocked } from "@/lib/demo";
import { requestQuantScan } from "@/lib/bridge-files";
import { BRIDGE, QUANT } from "@/lib/features";
import { startQuantScan } from "@/lib/quant-scan-api";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!QUANT) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  const blocked = demoBlocked();
  if (blocked) return blocked;
  // On OptionsEvaluator the daemon runs the scan itself (lib/quant-scan-api.ts).
  if (!BRIDGE) {
    const r = await startQuantScan();
    return Response.json(r, { status: r.ok ? 200 : 502 });
  }
  try {
    requestQuantScan();
  } catch {
    return Response.json({ ok: false, error: "Could not start the scan." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
