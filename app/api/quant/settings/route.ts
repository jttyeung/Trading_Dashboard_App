// The Quant scan's variables. GET → current values and the study's defaults.
// POST {params} saves them (and with scan:true asks the bridge to re-scan);
// POST {reset:true} deletes the file so the study's rule is back.
import { demoBlocked } from "@/lib/demo";
import { requestQuantScan } from "@/lib/bridge-files";
import { readQuantSettings, resetQuantSettings, STUDY_DEFAULTS, validateQuantParams, writeQuantSettings, type QuantParams } from "@/lib/quant-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ...readQuantSettings(), defaults: STUDY_DEFAULTS });
}

export async function POST(req: Request) {
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
    if (body.scan) requestQuantScan();
  } catch {
    return Response.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
  return Response.json({ ok: true, ...readQuantSettings(), defaults: STUDY_DEFAULTS });
}
