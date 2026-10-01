import Link from "next/link";
import { notFound } from "next/navigation";
import { WHEEL_CAMPAIGNS } from "@/lib/features";
import { BackLink, PageHeader, Stat } from "@/components/ui";
import { Amt, ShowAmounts } from "@/components/privacy";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { CampaignCard, Signed } from "@/components/WheelCampaigns";
import { getSnapshot } from "@/lib/snapshot";
import { getCampaigns } from "@/lib/campaigns-load";
import { CAMPAIGN_GAP_DAYS } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/calc";

export const dynamic = "force-dynamic";

type View = "active" | "closed" | "action";

export default async function WheelCampaignsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!WHEEL_CAMPAIGNS) notFound(); // parked; see lib/features.ts
  const { view: v } = await searchParams;
  const view: View = v === "closed" || v === "action" ? v : "active";
  const snap = await getSnapshot();
  const { id, campaigns } = await getCampaigns(snap);

  const active = campaigns.filter((c) => c.active);
  const closed = campaigns.filter((c) => !c.active);
  const action = active.filter((c) => c.needsAction.length > 0);
  // Wheels that reached shares first — they carry the most capital and the most decisions.
  const order = { calls: 0, shares: 0, puts: 1 } as Record<string, number>;
  const shown = (view === "closed" ? closed : view === "action" ? action : active).slice().sort((a, b) =>
    view === "closed" ? 0 : (order[a.stage] ?? 2) - (order[b.stage] ?? 2) || b.capital - a.capital,
  );

  const sum = (xs: typeof campaigns, f: (c: (typeof campaigns)[number]) => number) => xs.reduce((s, c) => s + f(c), 0);
  const year = String(new Date().getFullYear());
  const closedYtd = closed.filter((c) => (c.end ?? "").startsWith(year));

  const chip = (label: string, key: View, n: number) => (
    <Link
      href={key === "active" ? "/options/wheel" : `/options/wheel?view=${key}`}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset ${
        view === key ? "bg-sky-500/25 text-sky-100 ring-sky-500/50" : "bg-surface-2 text-muted ring-border active:bg-surface"
      }`}
    >
      {label} · {n}
    </Link>
  );

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Wheel campaigns"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <AccountSwitcher accounts={snap.accounts} selectedId={id} />
              <span>· put → shares → calls → exit</span>
            </span>
          }
          right={<BackLink href="/options" />}
        />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Active" value={active.length} sub={<Amt>{`${fmtMoney(sum(active, (c) => c.capitalNow))} tied up`}</Amt>} />
          <Stat label="Premium" value={<Amt>{fmtMoney(sum(active, (c) => c.premium))}</Amt>} sub="active" />
          <Stat
            label="Net P/L"
            value={<Signed n={sum(active, (c) => c.netPnl)} />}
            sub="incl. shares"
          />
        </div>

        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chip("Active", "active", active.length)}
          {chip("Closed", "closed", closed.length)}
          {chip("Needs action", "action", action.length)}
        </div>

        {view === "closed" && closedYtd.length > 0 && (
          <div className="mt-2 flex justify-between px-1 text-xs text-muted">
            <span>Closed in {year}</span>
            <span>
              <Signed n={sum(closedYtd, (c) => c.netPnl)} /> · {closedYtd.length} campaign{closedYtd.length === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {shown.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
          {shown.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted">
              {view === "action" ? "Nothing needs attention." : view === "closed" ? "No closed campaigns in the trade history yet." : "No open puts, covered calls or assigned shares."}
            </p>
          )}
        </div>

        <p className="mt-5 px-1 pb-6 text-[11px] leading-relaxed text-muted">
          A campaign is one ticker from the first put sold (or the first call written on shares you already held) until
          it&apos;s flat again: put closed or expired with no shares, shares called away, or shares sold. A new put within{" "}
          {CAMPAIGN_GAP_DAYS} days of going flat continues the same campaign. Premium counts every leg&apos;s credit minus
          its buy-back, assigned legs included; shares count at the assignment strike, so the{" "}
          <span className="text-text">adjusted basis</span> is that cost minus the premium per share. Built from the
          trade history the bridge has, which reaches back about a year.
        </p>
      </ShowAmounts>
    </main>
  );
}
