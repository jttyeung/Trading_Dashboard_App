import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { SecurityChart } from "@/components/SecurityChart";
import { getSnapshot } from "@/lib/snapshot";
import { getApproved } from "@/lib/approved";

export const dynamic = "force-dynamic";

// Lookup a Ticker: any symbol, charted on demand. Suggestions come from the
// approved universe plus every name currently held (stock or option underlying).
export default async function ChartPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const snap = await getSnapshot();
  const held = new Set<string>();
  for (const acct of Object.values(snap.data)) {
    for (const e of acct.equities) held.add(e.symbol.toUpperCase());
    for (const o of acct.options) held.add(o.symbol.toUpperCase());
  }
  const watchlist = [...new Set([...getApproved(), ...held])].sort();
  const initial = symbol && /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(symbol) ? symbol.toUpperCase() : undefined;

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Lookup a Ticker"
          subtitle="2-year daily · Bollinger · SMA 50/200 · MACD · RSI · walls for held names"
          right={<BackLink />}
        />
        <SecurityChart watchlist={watchlist} initialSymbol={initial} />
      </ShowAmounts>
    </main>
  );
}
