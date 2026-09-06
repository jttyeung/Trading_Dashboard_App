// Client-side calls into OptionsEvaluator's small paper-bot API
// (internal/agents/paperbot/api.go) — the ONE place this whole dashboard
// writes anything back, everywhere else it only reads exported JSON
// files. Only reachable when the OptionsEvaluator daemon is running on
// whatever host actually serves this dashboard (a Vercel-deployed
// instance can't reach anyone's daemon at all) — callers should catch
// failures and show that plainly rather than pretend the click silently
// worked.
//
// A real bug this fixes, not a stylistic choice: this used to be
// hardcoded to "http://localhost:8091" — see lib/chart-api.ts's own doc
// comment for why that only ever worked when the dashboard was viewed on
// the SAME machine as the daemon, and fails outright for the account
// holder's own real usage (their phone, over Tailscale). Same
// window.location.hostname fix as that file.
function paperbotAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8091";
  return `http://${window.location.hostname}:8091`;
}

export type BotStatus = "pending_approval" | "approved" | "rejected";

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${paperbotAPIBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`paperbot API ${path} failed: ${res.status}`);
  }
}

export function decideTrade(id: number, status: BotStatus): Promise<void> {
  return post("/paperbot/decide", { id, status });
}

export function setPersonallySelected(id: number, selected: boolean): Promise<void> {
  return post("/paperbot/personal", { id, selected });
}

export function annotateTrade(id: number, tags: string, note: string): Promise<void> {
  return post("/paperbot/annotate", { id, tags, note });
}
