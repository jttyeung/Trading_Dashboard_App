// Resolves which account the user is viewing. Selection is stored in an
// "account" cookie (set by the client AccountSwitcher) so it persists across
// tabs and reloads. Falls back to the default account.
//
// A selection of COMBINED_ID renders the Combined View: the accounts picked in
// Settings → Combine views (the "combineAccounts" cookie), merged by
// lib/combine.ts into one AccountData. Every account-scoped page goes through
// getSelectedAccount, so none of them need to know about it.
import { cookies } from "next/headers";
import type { Account, AccountData, Snapshot } from "./types";
import { ACCOUNT_COOKIE, COMBINE_COOKIE, COMBINED_ID, accountLabel, combinedAccount, parseCombineIds } from "./account-shared";
import { combineAccountData } from "./combine";

export { ACCOUNT_COOKIE, COMBINE_COOKIE, COMBINED_ID, accountLabel } from "./account-shared";

/** Accounts the Combined View may merge. Excludes a type "all" bucket (the
 *  daemon's All Accounts, which lib/snapshot.ts also folds SnapTrade/E*TRADE
 *  into): it already contains every real account, so ticking it alongside them
 *  counted each position twice. */
export function combinableAccounts(snap: Snapshot): Account[] {
  return snap.accounts.filter((a) => a.type !== "all");
}

/** Account ids picked for the Combined View, limited to combinable accounts this
 *  snapshot has, so a cookie saved before the "all" bucket was excluded drops it. */
export async function getCombineIds(snap: Snapshot): Promise<string[]> {
  const store = await cookies();
  const allowed = new Set(combinableAccounts(snap).map((a) => a.id));
  return parseCombineIds(store.get(COMBINE_COOKIE)?.value).filter((id) => allowed.has(id) && Boolean(snap.data[id]));
}

export async function getSelectedAccountId(snap: Snapshot): Promise<string> {
  const store = await cookies();
  const id = store.get(ACCOUNT_COOKIE)?.value;
  if (id === COMBINED_ID && (await getCombineIds(snap)).length > 0) return COMBINED_ID;
  if (id && snap.data[id]) return id;
  return (snap.accounts.find((a) => a.isDefault) ?? snap.accounts[0]).id;
}

export async function getSelectedAccount(
  snap: Snapshot,
): Promise<{ id: string; account: Account; data: AccountData }> {
  const id = await getSelectedAccountId(snap);
  if (id === COMBINED_ID) {
    const ids = await getCombineIds(snap);
    const members = snap.accounts.filter((a) => ids.includes(a.id));
    return {
      id: COMBINED_ID,
      account: combinedAccount(members),
      data: combineAccountData(
        members.map((a) => snap.data[a.id]),
        members.map((a) => accountLabel(a)),
      ),
    };
  }
  const account = snap.accounts.find((a) => a.id === id) ?? snap.accounts[0];
  return { id, account, data: snap.data[id] };
}
