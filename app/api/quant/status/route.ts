import { readQuantStatus } from "@/lib/bridge-files";
import { QUANT } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!QUANT) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  return Response.json(readQuantStatus());
}
