import fs from "fs";
import path from "path";
import { bridges } from "./bridges";
import { readAuthStatus } from "./bridge-files";
import type { BridgeInfo } from "./bridges";
import { getSnapshot } from "./snapshot";
import { COMBINED_ID, getCombineIds, getSelectedAccountId } from "./account";

// Per-feed last/next refresh times, written by auto_push (the scheduler) to
// data/refresh-status.json. Keys: "app" (snapshot + vix), "research", "am_report",
// "am_ladder", "history", "quant", "manual". The app reads it to count down to the
// next refresh, and to show when the last attempt actually failed rather than just
// going quiet.
export interface FeedStatus {
  lastAt?: string; // last time this feed's data actually changed (only moves on success)
  lastAttemptAt?: string; // last time a run was attempted at all, success or not
  nextAt?: string;
  intervalSec?: number;
  status?: "ok" | "error" | "login_required";
  error?: string; // present when status is "error" or "login_required"
}
export type RefreshStatus = Record<string, FeedStatus>;

export const REFRESH_STATUS_PATH = path.join(process.cwd(), "data", "refresh-status.json");

export function getRefreshStatus(): RefreshStatus {
  try {
    const raw = fs.readFileSync(REFRESH_STATUS_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as RefreshStatus) : {};
  } catch {
    return {};
  }
}

// Which accounts a bridge serves: the snapshot it writes into its own data dir.
function accountsOf(b: BridgeInfo): string[] {
  try {
    const snap = JSON.parse(fs.readFileSync(path.join(path.dirname(b.statusPath), "snapshot.json"), "utf8"));
    return Array.isArray(snap?.accounts) ? snap.accounts.map((a: { id: unknown }) => String(a.id)) : [];
  } catch {
    return [];
  }
}

// The "app" feed as the pages show it: the scheduler's entry, overridden to
// "login_required" when the Schwab bridge serving the account on screen reports
// a dead token (its schwab-auth.json says "needs_login" — the same file Settings
// reads, so the badge and the Reconnect button always agree). Scoped to what is
// shown: a second login that has lapsed does not flag a page showing the first
// account, but it does flag a Combined View that includes one of its accounts.
// Schwab refresh tokens die about weekly; without this the dashboard just went
// quiet and looked "a bit stale".
export async function appFeed(): Promise<FeedStatus> {
  const feed: FeedStatus = { ...(getRefreshStatus().app ?? {}) };
  let ids: string[] = [];
  try {
    const snap = await getSnapshot();
    const id = await getSelectedAccountId(snap);
    ids = id === COMBINED_ID ? await getCombineIds(snap) : [id];
  } catch {
    ids = [];
  }
  const dead: string[] = [];
  try {
    for (const b of bridges()) {
      if (readAuthStatus(b).authStatus !== "needs_login") continue;
      if (accountsOf(b).some((a) => ids.includes(a))) dead.push(b.label);
    }
  } catch {
    // a bad bridge registry never breaks a page
  }
  if (dead.length) {
    feed.status = "login_required";
    feed.error = `${dead.join(", ")}: Schwab token expired — reconnect from Settings.`;
  }
  return feed;
}
