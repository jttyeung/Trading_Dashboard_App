// The Quant scan's variables. GET → current values and the study's defaults.
// POST {params} saves them (and with scan:true asks the bridge, or on
// OptionsEvaluator the daemon, to re-scan);
// POST {reset:true} deletes the file so the study's rule is back.
import { demoBlocked } from "@/lib/demo";
import { requestQuantScan } from "@/lib/bridge-files";
import { readQuantSettings, resetQuantSettings, STUDY_DEFAULTS, validateQuantParams, writeQuantSettings, type QuantParams } from "@/lib/quant-settings";
import { BRIDGE, QUANT } from "@/lib/features";
import { startQuantScan } from "@/lib/quant-scan-api";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!QUANT) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  return Response.json({ ok: true, ...readQuantSettings(), defaults: STUDY_DEFAULTS });
}

export async function POST(req: Request) {
  if (!QUANT) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  const blocked = demoBlocked();
  if (blocked) return blocked;
  let body: { params?: Partial<Record<keyof QuantParams, unknown>>; reset?: boolean; scan?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  try {
    if (body.reset) {
      resetQuantSettings();
    } else {
      const { params, error } = validateQuantParams(body.params ?? {});
      if (!params) return Response.json({ ok: false, error }, { status: 400 });
      writeQuantSettings(params);
    }
    if (body.scan && BRIDGE) requestQuantScan();
  } catch {
    return Response.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
  // On OptionsEvaluator the daemon rescans (and reads the saved settings) itself.
  if (body.scan && !BRIDGE) await startQuantScan();
  return Response.json({ ok: true, ...readQuantSettings(), defaults: STUDY_DEFAULTS });
}
