// Client-side calls into OptionsEvaluator's small localhost-only paper-bot
// API (internal/agents/paperbot/api.go) — the ONE place this whole
// dashboard writes anything back, everywhere else it only reads exported
// JSON files. Only reachable when the dashboard is running on the SAME
// machine as the OptionsEvaluator daemon (a Vercel-deployed instance can't
// reach a developer's own localhost) — callers should catch failures and
// show that plainly rather than pretend the click silently worked.
const PAPERBOT_API_BASE = "http://localhost:8091"; // matches PAPERBOT_API_PORT's own default in config/.env.example

export type BotStatus = "pending_approval" | "approved" | "rejected";

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${PAPERBOT_API_BASE}${path}`, {
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
