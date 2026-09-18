import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { SecurityChart } from "@/components/SecurityChart";
import { getSnapshot } from "@/lib/snapshot";
import { getResearch } from "@/lib/research";

export const dynamic = "force-dynamic";

// Chart a Ticker: any symbol, charted on demand. Suggestions come from the
// screened universe (research.json's ticker keys — the Google Sheets watchlist,
// same source app/research/page.tsx uses) plus every name currently held
// (stock or option underlying). Upstream draws on a curated "approved" list
// here; this fork has no such list — the sheet is the list.
export default async function ChartPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const snap = await getSnapshot();
  const research = getResearch(snap.meta.source === "example");
  const held = new Set<string>(research ? Object.keys(research.tickers) : []);
  for (const acct of Object.values(snap.data)) {
    for (const e of acct.equities) held.add(e.symbol.toUpperCase());
    for (const o of acct.options) held.add(o.symbol.toUpperCase());
  }
  const watchlist = [...held].sort();
  const initial = symbol && /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(symbol) ? symbol.toUpperCase() : undefined;

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Chart a Ticker"
          subtitle="2-year daily · Bollinger · SMA 50/200 · MACD · RSI · walls for held names"
          right={<BackLink />}
        />
        <SecurityChart watchlist={watchlist} initialSymbol={initial} />
        {/* The same chart is one long-press away from anywhere in the app — worth
            saying here, where people come looking for a chart on purpose. */}
        <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted">
          <span className="font-medium text-text">Quick charting:</span> hold any ticker for 1.8 seconds — in Holdings,
          Options, P&amp;L, the Brief, anywhere it appears — and it opens here. A small{" "}
          <span className="text-violet-300">hold to chart</span> pill shows once the press is deliberate; lift early to cancel.
        </p>
      </ShowAmounts>
    </main>
  );
}
