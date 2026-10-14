import fs from "fs";
import path from "path";
import { bridges } from "./bridges";
import { readAuthStatus } from "./bridge-files";

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

// The "app" feed as the pages show it: the scheduler's entry, overridden to
// "login_required" whenever any Schwab bridge reports a dead token (its
// schwab-auth.json says "needs_login" — the same file Settings reads, so the
// badge and the Reconnect button always agree). Schwab refresh tokens die about
// weekly; without this the dashboard just went quiet and looked "a bit stale".
export function appFeed(): FeedStatus {
  const feed: FeedStatus = { ...(getRefreshStatus().app ?? {}) };
  const dead: string[] = [];
  try {
    for (const b of bridges()) {
      if (readAuthStatus(b).authStatus === "needs_login") dead.push(b.label);
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
