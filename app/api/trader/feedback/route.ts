// Mark a trade suggestion good / bad / done / skip (or clear it back to new).
// Only answers when the trader service is present; a plain install has no such
// file and gets a 404, the same as the page.
import { demoBlocked } from "@/lib/demo";
import { saveFeedback, traderPresent, type SuggestionStatus } from "@/lib/trader";
import { TRADER } from "@/lib/features";

export const dynamic = "force-dynamic";

const STATUSES = new Set<SuggestionStatus>(["new", "good", "bad", "done", "skip"]);

export async function POST(req: Request) {
  if (!TRADER) return new Response(null, { status: 404 }); // parked; see lib/features.ts
  const blocked = demoBlocked();
  if (blocked) return blocked;
  if (!traderPresent()) return Response.json({ ok: false, error: "The trader isn't set up." }, { status: 404 });
  let body: { key?: string; status?: string };
  try {
    body = (await req.json()) as { key?: string; status?: string };
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  const key = (body.key || "").trim();
  const status = body.status as SuggestionStatus;
  if (!key || !STATUSES.has(status)) return Response.json({ ok: false, error: "Missing key or status." }, { status: 400 });
  try {
    saveFeedback(key, status);
  } catch {
    return Response.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
