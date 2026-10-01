import Link from "next/link";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import type { DonutSlice } from "@/components/charts";
import { RefreshButton } from "@/components/RefreshButton";
import { ShowAmounts } from "@/components/privacy";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { getSnapshot } from "@/lib/snapshot";
import { getSelectedAccount } from "@/lib/account";
import { cspCollateral, optionMarketValue } from "@/lib/calc";
import { OptionsSummarySim } from "@/components/OptionsSummarySim";
import { CampaignRow } from "@/components/WheelCampaigns";
import { getCampaigns } from "@/lib/campaigns-load";
import type { OptionPosition } from "@/lib/types";

const CSP_COLOR = "#38bdf8"; // sky — matches the CSP side accent
const LEAP_COLOR = "#a78bfa"; // violet — matches the LEAP side accent

export const dynamic = "force-dynamic";

const isCsp = (o: OptionPosition) => o.kind === "csp";
const isLeap = (o: OptionPosition) => o.kind === "leap-call" || o.kind === "leap-put-hedge";

// One tappable "side" — the whole column highlights on press so it's clear you're
// drilling into that entire strategy, not a single metric.
export default async function OptionsPage() {
  const snap = await getSnapshot();
  const { id, data } = await getSelectedAccount(snap);
  const { options } = data;

  const sum = (os: OptionPosition[], f: (o: OptionPosition) => number) => os.reduce((s, o) => s + f(o), 0);
  const csps = options.filter(isCsp);
  const leaps = options.filter(isLeap);

  // Strategy allocation by capital deployed: CSP collateral (cash-secured) vs
  // current LEAP market value. (Raw CSP contract value would read ~2% and hide
  // how much capital the wheel actually ties up.)
  const cspCapital = sum(csps, cspCollateral);
  const leapCapital = sum(leaps, optionMarketValue);
  const stratTotal = cspCapital + leapCapital;
  const allocation: DonutSlice[] = [
    { label: "CSPs", value: cspCapital, color: CSP_COLOR },
    { label: "LEAPs", value: leapCapital, color: LEAP_COLOR },
  ];

  const { campaigns } = await getCampaigns(snap);
  const activeCampaigns = campaigns.filter((c) => c.active);
  const needsAction = activeCampaigns.filter((c) => c.needsAction.length > 0).length;
  const rank = (c: (typeof campaigns)[number]) => (c.needsAction.length > 0 ? 0 : c.sharesHeld > 0 ? 1 : 2);
  const preview = activeCampaigns.slice().sort((a, b) => rank(a) - rank(b) || b.capital - a.capital).slice(0, 4);

  return (
    <main className="px-4 tablet:px-6" data-wide="1">
      <ShowAmounts>
        <PageHeader
          title="Options"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <AccountSwitcher accounts={snap.accounts} selectedId={id} />
              <span>· {options.length} positions</span>
            </span>
          }
          right={<RefreshButton generatedAt={snap.meta.generatedAt} />}
        />

        {/* Capital wheel + all-options cards + per-strategy cards + Simulate toggle.
            The wheel lives inside the client island so the Simulate toggle can overlay
            its corner and drive every re-priced number in one place. */}
        <OptionsSummarySim options={options} allocation={allocation} stratTotal={stratTotal} />

        {/* Wheel campaigns: each ticker's put → shares → calls run as one record. A short
            preview here (anything needing action, then wheels holding shares); the full
            list and per-campaign detail live under /options/wheel. */}
        <SectionTitle
          action={
            <Link href="/options/wheel" className="text-xs font-medium text-muted active:opacity-80">
              All ›
            </Link>
          }
        >
          Wheel campaigns
        </SectionTitle>
        <Card className="divide-y divide-border overflow-hidden">
          {preview.map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
          <Link href="/options/wheel" className="tabular flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] text-muted active:bg-surface-2">
            <span>
              {activeCampaigns.length} active
              {activeCampaigns.length > preview.length && ` · ${activeCampaigns.length - preview.length} more`}
              {needsAction > 0 && <span className="text-orange-300"> · {needsAction} need action</span>}
            </span>
            <span>Open ›</span>
          </Link>
        </Card>

        {/* Tablet only: the wide all-positions table (the rail also links it). */}
        <Link href="/positions" className="mt-3 hidden active:opacity-80 tablet:block">
          <Card className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Open positions table</div>
              <div className="text-[11px] text-muted">Every option and stock across every account — Δ, IV, theta, returns, sortable</div>
            </div>
            <span className="shrink-0 text-sm font-medium text-muted">Open ›</span>
          </Card>
        </Link>

        <SectionTitle>How this works</SectionTitle>
        <p className="-mt-1 px-1 text-[11px] leading-relaxed text-muted">
          Tap the <span className="text-sky-300">CSP</span> or <span className="text-violet-300">LEAP</span> side to open
          a focused view — positions default to <span className="text-text">Open</span>; flip the toggle to{" "}
          <span className="text-text">Closed</span> for that type&apos;s realized round-trips, and find new ideas from
          inside that view. Keeps the page glanceable no matter how many positions you carry.
        </p>
      </ShowAmounts>
    </main>
  );
}
