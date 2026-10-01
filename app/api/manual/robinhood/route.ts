// Import the holdings of a Robinhood dashboard running beside this one into a
// manual account named "Robinhood" (see lib/robinhood-link.ts for discovery).
//   GET  → { available } — Settings shows the button only when this is true
//   POST → re-imports: the "Robinhood" manual account's rows are replaced by
//          what Robinhood holds now, and its cash set to Robinhood's free cash.
// Each press is a snapshot; nothing syncs in between.
import { demoBlocked } from "@/lib/demo";
import { addPositions, ensureAccount, validatePosition, type ManualAccount, type NewManualPosition } from "@/lib/manual-positions";
import { fetchRobinhood, findRobinhood } from "@/lib/robinhood-link";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ available: (await findRobinhood()) !== null });
}

export async function POST() {
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const rh = await fetchRobinhood(true);
  if (!rh) return Response.json({ ok: false, error: "The Robinhood dashboard isn't answering on this machine." }, { status: 404 });
  if (!rh.ok || !rh.accounts?.length) return Response.json({ ok: false, error: rh.error ?? "Robinhood has no holdings to import yet." }, { status: 409 });
  try {
    const single = rh.accounts.length === 1;
    const imported: ManualAccount[] = [];
    const skipped: string[] = [];
    for (const a of rh.accounts) {
      const last4 = (a.mask ?? a.id).replace(/\D/g, "").slice(-4);
      const id = single ? "manual-robinhood" : `manual-robinhood-${last4 || a.id.slice(-4)}`;
      const label = single ? "Robinhood" : `Robinhood ••${last4}`;
      const rows: NewManualPosition[] = [];
      for (const p of a.positions) {
        const v = validatePosition(p as Record<string, unknown>);
        if (v.row) rows.push(v.row);
        else if (v.error) skipped.push(v.error);
      }
      ensureAccount(id, label, Number.isFinite(a.cash) && a.cash >= 0 ? a.cash : 0);
      imported.push(addPositions(id, rows, true));
    }
    return Response.json({ ok: true, accounts: imported, generatedAt: rh.generatedAt ?? null, skipped });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Could not save." }, { status: 500 });
  }
}
