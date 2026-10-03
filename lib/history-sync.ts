// "Build history" on OptionsEvaluator: the daemon's /history-sync on its roll
// API (internal/rollapi/history_sync.go), called from this app's own server so
// the browser never needs the daemon's address. The bridge's equivalent is the
// task_inbox marker in lib/bridge-files.ts; app/api/history/* picks between
// them on lib/features.ts BRIDGE. Server-only.
import type { HistoryStatus } from "@/lib/bridge-files";

// Server-side only, like CHART_API_URL: never NEXT_PUBLIC_.
const ROLL_API_URL = (process.env.ROLL_API_URL ?? "http://localhost:8095").replace(/\/+$/, "");

const UNREACHABLE = "Can't reach the OptionsEvaluator daemon.";

export async function startHistorySync(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${ROLL_API_URL}/history-sync`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return r.ok && d.ok !== false ? { ok: true } : { ok: false, error: d.error || `Daemon answered ${r.status}.` };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

export async function readHistorySync(): Promise<HistoryStatus> {
  try {
    const r = await fetch(`${ROLL_API_URL}/history-sync`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (r.ok) return (await r.json()) as HistoryStatus;
  } catch {
    /* fall through */
  }
  return { status: "idle", counts: null, error: null, updatedAt: null };
}
