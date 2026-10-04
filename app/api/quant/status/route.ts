import { readQuantStatus } from "@/lib/bridge-files";
import { BRIDGE, QUANT } from "@/lib/features";
import { readQuantScanStatus } from "@/lib/quant-scan-api";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!QUANT) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  return Response.json(BRIDGE ? readQuantStatus() : await readQuantScanStatus());
}
