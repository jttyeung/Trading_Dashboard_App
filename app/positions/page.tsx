import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { DataRefresh } from "@/components/DataRefresh";
import { PositionsTable, type SourcedEquity, type SourcedOption } from "@/components/PositionsTable";
import { getSnapshot } from "@/lib/snapshot";
import { accountLabel, realAccounts } from "@/lib/account-shared";
import { isCashEquivalent } from "@/lib/calc";
import { getRefreshStatus } from "@/lib/refresh-status";

export const dynamic = "force-dynamic";

// Open Positions: every open option and stock position across every account
// in one wide table. Built for the tablet layout (it is the rail's third
// entry); on a phone it still works, scrolling sideways inside its card.
export default async function PositionsPage() {
  const snap = await getSnapshot();
  const options: SourcedOption[] = [];
  const equities: SourcedEquity[] = [];
  // Skip the type "all" bucket (the daemon's All Accounts, with SnapTrade and
  // E*TRADE folded in by lib/snapshot.ts): it repeats every real account's
  // positions, so including it listed each one twice. And the Auto Trader
  // paper accounts: simulated, with their own page (/autotrader).
  const accounts = realAccounts(snap.accounts);
  for (const a of accounts) {
    const d = snap.data[a.id];
    if (!d) continue;
    const account = accountLabel(a);
    for (const o of d.options) options.push({ ...o, account });
    // Money-market / sweep funds report as equities but are cash; leave them out.
    for (const e of d.equities) if (!isCashEquivalent(e.symbol)) equities.push({ ...e, account });
  }
  const n = options.length + equities.length;

  return (
    <main className="px-4 tablet:px-6" data-wide="1">
      <ShowAmounts>
        <PageHeader
          title="Open Positions"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>
                {n} {n === 1 ? "position" : "positions"} · {options.length} options · {equities.length} stocks
                {accounts.length > 1 ? ` · ${accounts.length} accounts` : ""}
              </span>
              <DataRefresh nextAt={getRefreshStatus().app?.nextAt} />
            </span>
          }
          right={<BackLink />}
        />
        <PositionsTable options={options} equities={equities} multiAccount={accounts.length > 1} />
      </ShowAmounts>
    </main>
  );
}
