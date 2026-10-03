// "Run now" for the Trader page. POST drops data/trader-run; the trader service
// picks it up within seconds, runs a full pass (closes, new puts, calls, notes)
// regardless of the clock, pushes anything new and rewrites the suggestions
// file. GET reports whether the marker is still waiting and the last pass time,
// which the button polls. Only answers when the trader is present.
import { demoBlocked } from "@/lib/demo";
import { readSuggestions, requestRun, runPending, traderPresent } from "@/lib/trader";

export const dynamic = "force-dynamic";

function state() {
  const m = readSuggestions()?.meta;
  return { pending: runPending(), asOf: m?.asOf ?? null, lastPass: m?.lastPass ?? null, pushed: m?.pushed ?? 0, active: m?.active ?? 0 };
}

export async function GET() {
  if (!traderPresent()) return Response.json({ ok: false, error: "The trader isn't set up." }, { status: 404 });
  return Response.json({ ok: true, ...state() });
}

export async function POST() {
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!traderPresent()) return Response.json({ ok: false, error: "The trader isn't set up." }, { status: 404 });
  try {
    requestRun();
  } catch {
    return Response.json({ ok: false, error: "Could not write the request." }, { status: 500 });
  }
  return Response.json({ ok: true, ...state() });
}
