// "Rebuild" for the Trader page, for the phase where the trader is a private
// repo copied onto the host. POST drops data/trader-rebuild; the updater
// container (release compose) builds ./trader and restarts that one service,
// reporting into data/trader-rebuild-status.json, which GET returns and the
// button polls. Only answers when the trader is present.
import { demoBlocked } from "@/lib/demo";
import { readRebuildStatus, requestRebuild, traderPresent } from "@/lib/trader";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!traderPresent()) return Response.json({ ok: false, error: "The trader isn't set up." }, { status: 404 });
  return Response.json({ ok: true, ...readRebuildStatus() });
}

export async function POST() {
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!traderPresent()) return Response.json({ ok: false, error: "The trader isn't set up." }, { status: 404 });
  try {
    requestRebuild();
  } catch {
    return Response.json({ ok: false, error: "Could not write the request." }, { status: 500 });
  }
  return Response.json({ ok: true, ...readRebuildStatus() });
}
