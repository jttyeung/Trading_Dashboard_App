import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { OptionsTypeView } from "@/components/OptionsTypeView";
import { TickerBar } from "@/components/TickerBar";
import { getRefreshStatus } from "@/lib/refresh-status";
import { DataRefresh } from "@/components/DataRefresh";
import { getSnapshot } from "@/lib/snapshot";
import { getSelectedAccount } from "@/lib/account";
import { getClosedCsps } from "@/lib/csp-closed";
import { getClosedLeaps } from "@/lib/leaps-closed";
import { getSingleLegCandidates } from "@/lib/single-leg-candidates";
import { parseClosedWindow } from "@/lib/date-range";
import type { OptionPosition } from "@/lib/types";

export const dynamic = "force-dynamic";

const isLeap = (o: OptionPosition) => o.kind === "leap-call" || o.kind === "leap-put-hedge";

function toStatus(v: string | undefined): "open" | "closed" | "candidates" {
  return v === "closed" || v === "candidates" ? v : "open";
}

export default async function OptionsLeapPage({ searchParams }: { searchParams: Promise<{ view?: string; range?: string; months?: string; symbol?: string }> }) {
  const { view, range, months, symbol } = await searchParams;
  const { mode: closedMode, months: closedMonths } = parseClosedWindow(range, months);
  const snap = await getSnapshot();
  const { id, data } = await getSelectedAccount(snap);
  const sym = symbol?.toUpperCase();
  const allLeaps = data.options.filter(isLeap);
  const tickers = [...new Set(allLeaps.map((o) => o.symbol.toUpperCase()))].sort();
  const open = allLeaps.filter((o) => !sym || o.symbol.toUpperCase() === sym);
  const closedCsps = (await getClosedCsps()).closed.filter((c) => !sym || c.symbol.toUpperCase() === sym);
  const closedLeaps = (await getClosedLeaps()).closed.filter((c) => !sym || c.symbol.toUpperCase() === sym);
  // CC candidates live on the Covered Calls page instead — this page mirrors
  // the leap-call/leap-put-hedge open-position kinds it already shows.
  const singleLegCandidates = getSingleLegCandidates().candidates.filter(
    (c) => c.strategy !== "CC" && (!sym || c.symbol.toUpperCase() === sym),
  );

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="LEAPs"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <AccountSwitcher accounts={snap.accounts} selectedId={id} />
              <span>· {open.length} open</span>
              <DataRefresh nextAt={getRefreshStatus().app?.nextAt} />
            </span>
          }
          right={<BackLink />}
        />
        <TickerBar tickers={tickers} active={sym} base="/options/leap" />
        <OptionsTypeView
          type="leap"
          open={open}
          closedCsps={closedCsps}
          closedLeaps={closedLeaps}
          singleLegCandidates={singleLegCandidates}
          initialStatus={toStatus(view)}
          statusFromUrl={view === "open" || view === "closed" || view === "candidates"}
          closedMode={closedMode}
          closedMonths={closedMonths}
        />
      </ShowAmounts>
    </main>
  );
}
