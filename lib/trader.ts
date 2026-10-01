// Trader page data. The trader service (a separate, optional container) writes
// data/trade-suggestions.json; the app reads it and writes its verdicts to
// data/trade-feedback.json, which the trader reads back on its next pass. The
// page exists only when the suggestions file does, so installs without the
// trader never see it. No orders are placed from here.
import fs from "node:fs";
import path from "node:path";

export const SUGGESTIONS_PATH = path.join(process.cwd(), "data", "trade-suggestions.json");
export const FEEDBACK_PATH = path.join(process.cwd(), "data", "trade-feedback.json");

export type SuggestionStatus = "new" | "good" | "bad" | "done" | "skip" | "expired";

export interface Suggestion {
  key: string;
  kind: "csp" | "close" | "cc" | "note";
  symbol: string;
  title: string;
  detail: string;
  rule: string;
  amount?: number;
  qty?: number;
  price?: number;
  strike?: number;
  expiration?: string;
  yield30?: number;
  delta?: number;
  status: SuggestionStatus;
  firstSeen: string;
  lastSeen: string;
  pushedAt?: string;
  expiredAt?: string;
  accountId?: string;
}

export interface SuggestionsFile {
  meta: { asOf: string; interval: number; paused: boolean; ntfy: boolean; active: number; pushed: number };
  suggestions: Suggestion[];
}

export function traderPresent(): boolean {
  return fs.existsSync(SUGGESTIONS_PATH);
}

export function readSuggestions(): SuggestionsFile | null {
  try {
    const doc = JSON.parse(fs.readFileSync(SUGGESTIONS_PATH, "utf8")) as SuggestionsFile;
    return Array.isArray(doc?.suggestions) ? doc : null;
  } catch {
    return null;
  }
}

/** Record a verdict on one suggestion. Read-merge is fine: this is the user's own
 *  input in the app's own data folder, not anything the trader keeps private. */
export function saveFeedback(key: string, status: SuggestionStatus): void {
  let cur: Record<string, { status: string; at: string }> = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(FEEDBACK_PATH, "utf8"));
    if (parsed && typeof parsed === "object") cur = parsed;
  } catch {
    cur = {};
  }
  if (status === "new") delete cur[key];
  else cur[key] = { status, at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FEEDBACK_PATH), { recursive: true });
  fs.writeFileSync(FEEDBACK_PATH, JSON.stringify(cur, null, 2));
}
