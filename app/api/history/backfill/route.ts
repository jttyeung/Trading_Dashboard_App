// Ask the bridge to rebuild the full trade history from Schwab. Write-only: this
// just drops a marker into the bridge's task_inbox/. The bridge (auto_push loop)
// runs `sync_trade_history --full` and reports progress back through the app's
// own data/ folder (read via /api/history/status).
import { demoBlocked } from "@/lib/demo";
import { requestHistoryBackfill } from "@/lib/bridge-files";
import { BRIDGE } from "@/lib/features";
import { startHistorySync } from "@/lib/history-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const blocked = demoBlocked();
  if (blocked) return blocked;
  // On OptionsEvaluator the daemon runs the sync itself (lib/history-sync.ts).
  if (!BRIDGE) {
    const r = await startHistorySync();
    return Response.json(r, { status: r.ok ? 200 : 502 });
  }
  try {
    requestHistoryBackfill();
  } catch {
    return Response.json({ ok: false, error: "Could not start the history rebuild." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
