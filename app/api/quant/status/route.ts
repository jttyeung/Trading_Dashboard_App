import { readQuantStatus } from "@/lib/bridge-files";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(readQuantStatus());
}
