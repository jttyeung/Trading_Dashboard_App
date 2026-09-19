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
import { getBenchmark } from "@/lib/benchmark";
import { optionPnl, equityPnl, daysBetween } from "@/lib/calc";
import { PnlView, type BucketInput } from "@/components/PnlView";
import { BuildHistory } from "@/components/BuildHistory";
import { CostBasisAlert } from "@/components/CostBasisAlert";
import { ReconcileSchwab } from "@/components/ReconcileSchwab";
import type { AppClosed } from "@/lib/reconcile";
import { accountLabel } from "@/lib/account-shared";
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
  const [cspF, coveredF, spreadF, leapF, stockF, benchmark] = await Promise.all([
    getClosedCsps(),
    getClosedCovered(),
    getClosedSpreads(),
    getClosedLeaps(),
    getClosedStocks(),
    getBenchmark(),
  ]);
  // Real historical portfolio value (Schwab + the rollover blend --
  // internal/benchmark's own Actual series), reused here as each month's
  // starting capital base for a monthly ROI% -- see PnlView's own
  // capitalBaseForMonth for why this specific series over anything else.
  const capitalHistory = benchmark.actual;
  // Same series, already flow-adjusted per day, for the By-month table's
  // TWR/NAV strip -- the Benchmark page links these exact numbers too.
  const dailyReturns = benchmark.actualDailyReturns ?? [];
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
  // Every closed round-trip, flattened for the Schwab reconcile (compares by symbol and month).
  const appClosed: AppClosed[] = [
    ...cspF.closed.map((r) => ({ kind: "csp" as const, symbol: r.symbol, closedAt: r.closedAt, realizedPnl: r.realizedPnl, outcome: r.outcome, accountId: r.accountId })),
    ...coveredF.closed.map((r) => ({ kind: "covered" as const, symbol: r.symbol, closedAt: r.closedAt, realizedPnl: r.realizedPnl, outcome: r.outcome, accountId: r.accountId })),
    ...spreadF.closed.map((r) => ({ kind: "spread" as const, symbol: r.symbol, closedAt: r.closedAt, realizedPnl: r.realizedPnl, outcome: r.outcome, accountId: r.accountId })),
    ...leapF.closed.map((r) => ({ kind: "leap" as const, symbol: r.symbol, closedAt: r.closedAt, realizedPnl: r.realizedPnl, outcome: r.outcome, accountId: r.accountId })),
    ...stockF.closed.map((r) => ({ kind: "stock" as const, symbol: r.symbol, closedAt: r.closedAt, realizedPnl: r.realizedPnl, outcome: r.outcome, accountId: r.accountId })),
  ];
  const reconcileAccounts = snap.accounts.map((a) => ({ id: a.id, label: `${accountLabel(a)} ${a.mask}` }));

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
              {hasHistory && <ReconcileSchwab records={appClosed} accounts={reconcileAccounts} unresolved={unresolved} />}
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
        <PnlView realized={realized} open={open} capitalHistory={capitalHistory} dailyReturns={dailyReturns} />

        {/* The suggestion scorecard (real vs paper by strategy, and which
            score factors correlated with a better outcome) lives on the
            desktop /overview Scorecard tab only — the phone page it used
            to link to was a strict subset of that tab, removed so there's
            one place for that read. A pointer rather than nothing, so the
            path to it isn't lost from where it used to start. */}
        <Card className="mt-3 px-4 py-3 text-[11px] text-muted">
          <span className="font-medium text-text">Suggestion scorecard</span> — win rate &amp; P&amp;L by strategy, and
          which score factors are earning their place — is on the desktop Scorecard tab.
        </Card>
      </ShowAmounts>
    </main>
  );
}
