// Desktop shell for a genuinely different surface: a wide, sortable/groupable
// positions table, not the mobile phone-frame app. app/layout.tsx already
// skips the phone-frame chrome for any /desktop path (see proxy.ts) — this
// page just needs to render its own content, full width.
import { getSnapshot } from "@/lib/snapshot";
import { accountLabel } from "@/lib/account-shared";
import { isRegularSession } from "@/lib/market-hours";
import { PositionsTable } from "@/components/desktop/PositionsTable";

export const dynamic = "force-dynamic";

export default async function DesktopPage() {
  const snap = await getSnapshot();
  // Built from every REAL account (never the "combined" bucket) and tagged
  // with its own source label — neither Schwab's own combinedEquities/
  // Options nor the SnapTrade fold-in carry per-account attribution, so
  // there's no way to recover "which account is this from" once a position
  // is already inside "combined." Summing the real accounts ourselves here
  // gives the same overall picture plus a real Source column, no backend change.
  const realAccounts = snap.accounts.filter((a) => a.type !== "all");
  const options = realAccounts.flatMap((a) =>
    snap.data[a.id].options.map((o) => ({ ...o, sourceLabel: accountLabel(a) })),
  );

  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <PositionsTable options={options} marketOpen={isRegularSession()} />
    </main>
  );
}
