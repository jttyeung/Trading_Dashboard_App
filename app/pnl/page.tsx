import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { getSnapshot } from "@/lib/snapshot";
import { getSelectedAccount } from "@/lib/account";
import { getClosedCsps } from "@/lib/csp-closed";
import { getClosedLeaps } from "@/lib/leaps-closed";
import { getClosedCovered } from "@/lib/covered-closed";
import { getClosedSpreads } from "@/lib/spreads-closed";
import { getClosedStocks } from "@/lib/stocks-closed";
import { optionPnl, equityPnl, daysBetween } from "@/lib/calc";
import { PnlView, type BucketInput } from "@/components/PnlView";
import { BuildHistory } from "@/components/BuildHistory";
import { CostBasisAlert } from "@/components/CostBasisAlert";
import { ManualStockEntry } from "@/components/ManualStockEntry";
import { readUnresolvedStocks, readManualStockSales } from "@/lib/bridge-files";
import type { OptionKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// Map each open-option kind to a P&L bucket key (matches the realized buckets).
const KIND_KEY: Record<OptionKind, string> = {
  csp: "csp",
  "leap-call": "leap",
  "leap-put-hedge": "leap",
  "covered-call": "covered",
  "put-spread": "spread",
  "call-spread": "spread",
  other: "other",
};

// Compact price: "$80", "$80.5", "$1,234.56" — no forced trailing zeros.
const px = (n: number) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default async function PnlPage() {
  const snap = await getSnapshot();
  const { id, data } = await getSelectedAccount(snap);
  // Matches internal/export/snapshot.go's combinedAccountID — the synthetic
  // "All Accounts" entry every real account's data is blended into.
  const showAll = id === "combined";

  // Realized — closed round-trips per strategy bucket. CSP/covered/LEAP
  // (Schwab, internal/pnl) and stock (SnapTrade Fidelity/E*TRADE,
  // internal/agents/snaptrade's own FIFO match) carry a real accountId;
  // an item with no accountId (Schwab's manual stock-sale entries, which
  // aren't attributed to one account) always shows rather than being
  // hidden the moment any specific account is selected. Spreads never
  // carry one — internal/export/closed_trades.go's own documented scope
  // cut means that file is always empty against real data today anyway.
  const [cspF, coveredF, spreadF, leapF, stockF] = await Promise.all([
    getClosedCsps(),
    getClosedCovered(),
    getClosedSpreads(),
    getClosedLeaps(),
    getClosedStocks(),
  ]);
  const realized: BucketInput[] = [
    { key: "csp", label: "CSPs", items: cspF.closed.filter((r) => showAll || r.accountId === id).map((r) => ({ pnl: r.realizedPnl, date: r.closedAt, sym: r.symbol, strikeLabel: `$${r.strike}`, openedAt: r.openedAt, daysHeld: r.daysHeld })) },
    { key: "covered", label: "Covered calls", items: coveredF.closed.filter((r) => showAll || r.accountId === id).map((r) => ({ pnl: r.realizedPnl, date: r.closedAt, sym: r.symbol, strikeLabel: `$${r.strike}`, openedAt: r.openedAt, daysHeld: r.daysHeld })) },
    { key: "spread", label: "Spreads", items: spreadF.closed.map((r) => ({ pnl: r.realizedPnl, date: r.closedAt, sym: r.symbol, strikeLabel: `$${r.shortStrike}/${r.longStrike}`, openedAt: r.openedAt, daysHeld: r.daysHeld })) },
    { key: "leap", label: "LEAPs", items: leapF.closed.filter((r) => showAll || r.accountId === id).map((r) => ({ pnl: r.realizedPnl, date: r.closedAt, sym: r.symbol, strikeLabel: `$${r.strike}`, openedAt: r.openedAt, daysHeld: r.daysHeld })) },
    { key: "stock", label: "Stocks", items: stockF.closed.filter((r) => showAll || !r.accountId || r.accountId === id).map((r) => ({ pnl: r.realizedPnl, date: r.closedAt, sym: r.symbol, strikeLabel: `${px(r.avgOpen)} → ${px(r.avgClose)}`, openedAt: r.openedAt, daysHeld: r.daysHeld })) },
  ];

  // Open — current unrealized mark-to-market per bucket.
  const openByKey: Record<string, { pnl: number; sym?: string; strikeLabel?: string; openedAt?: string; daysHeld?: number }[]> = {};
  for (const o of data.options) {
    const key = KIND_KEY[o.kind] ?? "other";
    (openByKey[key] ??= []).push({
      pnl: optionPnl(o),
      sym: o.symbol,
      strikeLabel: `$${o.strike}`,
      openedAt: o.openedAt,
      daysHeld: o.openedAt ? daysBetween(o.openedAt) : undefined,
    });
  }
  const open: BucketInput[] = [
    { key: "csp", label: "CSPs", items: openByKey.csp ?? [] },
    { key: "covered", label: "Covered calls", items: openByKey.covered ?? [] },
    { key: "spread", label: "Spreads", items: openByKey.spread ?? [] },
    { key: "leap", label: "LEAPs", items: openByKey.leap ?? [] },
    { key: "stock", label: "Stocks", items: data.equities.map((e) => ({ pnl: equityPnl(e), sym: e.symbol, strikeLabel: `${px(e.avgCost)} → ${px(e.price)}` })) },
    { key: "other", label: "Other", items: openByKey.other ?? [] },
  ];

  // New users have no closed round-trips yet — offer a one-time Schwab backfill.
  const hasHistory = realized.some((b) => b.items.length > 0);
  // Stock sales the bridge couldn't auto-cost (bought before our data history).
  const unresolved = readUnresolvedStocks();
  // Fully user-added sales that predate the data window entirely.
  const manualSales = readManualStockSales();

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Profit & Loss"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <AccountSwitcher accounts={snap.accounts} selectedId={id} />
              <span>· realized and open by strategy</span>
            </span>
          }
          right={
            <div className="flex items-center gap-2">
              <CostBasisAlert unresolved={unresolved} />
              <BuildHistory hasHistory={hasHistory} />
            </div>
          }
        />
        {!hasHistory && (
          <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-center text-xs text-muted">
            No closed trades yet — tap <span className="font-medium text-text">Build history</span> above to
            pull your realized trades from Schwab.
          </p>
        )}
        <ManualStockEntry sales={manualSales} />
        <PnlView realized={realized} open={open} />

        <Link href="/scorecard" className="mt-3 block active:opacity-80">
          <Card className="flex items-center justify-between gap-3 bg-amber-500/5 px-4 py-3 ring-1 ring-inset ring-amber-500/25">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-200">Suggestion scorecard</div>
              <div className="text-[11px] text-muted">Win rate &amp; P&amp;L by strategy for suggestions you traded</div>
            </div>
            <span className="shrink-0 text-sm font-medium text-amber-300">View ›</span>
          </Card>
        </Link>
      </ShowAmounts>
    </main>
  );
}
