// Client-safe account helpers (no server-only imports like next/headers), so
// both the client AccountSwitcher and the server account resolver can use them.
import type { Account } from "./types";

export const ACCOUNT_COOKIE = "account";

/** Real-money accounts, each once: every account but a source's blended "all"
 *  entry (it repeats the others' positions) and OptionsEvaluator's Auto Trader
 *  "paper" accounts (simulated; they have their own tab and page). */
export function realAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type !== "all" && a.type !== "paper");
}

/** OptionsEvaluator's Auto Trader paper accounts (data/autotrader/). */
export function paperAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type === "paper");
}

// Combined view: Settings → Combine views picks which accounts to merge, stored
// as a comma-separated id list in this cookie. Selecting COMBINED_ID in the
// account switcher (or from Settings) then renders every account-scoped page
// on the merged data. Both cookies are plain (not httpOnly) so the switcher can
// read them client-side without a round trip.
export const COMBINE_COOKIE = "combineAccounts";
// Not "combined" as upstream has it: OptionsEvaluator's daemon already exports
// its All Accounts bucket under that id, so the two collided and Home selected
// an empty Combined View (no value history) instead of All Accounts.
export const COMBINED_ID = "combined-view";
export const COMBINED_LABEL = "Combined View";

/** Display label for an account, e.g. "Agentic" or "Individual". */
export function accountLabel(a: Account): string {
  if (a.nickname) return a.nickname;
  return a.brokerageType.charAt(0).toUpperCase() + a.brokerageType.slice(1);
}

/** Parse the combine cookie's value into account ids (unknown ids dropped by the caller). */
export function parseCombineIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  return [...new Set(decoded.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** The synthetic Account the combined view presents itself as. */
export function combinedAccount(members: Account[]): Account {
  return {
    id: COMBINED_ID,
    mask: `${members.length} account${members.length === 1 ? "" : "s"}`,
    type: "all",
    brokerageType: "combined",
    nickname: COMBINED_LABEL,
    isDefault: false,
  };
}

/** Read a cookie by name in the browser. Null on the server or when absent. */
export function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

export function writeClientCookie(name: string, value: string | null): void {
  if (typeof document === "undefined") return;
  if (value == null || value === "") {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  } else {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  }
}
