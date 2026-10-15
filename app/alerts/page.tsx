import { BackLink, PageHeader } from "@/components/ui";
import { AlertsView } from "@/components/AlertsView";
import { signalAlertsRunning, exampleSignalAlerts, isStale, readSignalAlerts, refreshSignalAlerts } from "@/lib/signal-alerts";
import { isExampleMode } from "@/lib/example-mode";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

// Signal alerts: golden/death crosses, 200-day, MACD, RSI and Bollinger signals
// across the watchlist, read off the same series Chart-a-Ticker draws.
export default async function AlertsPage() {
  const example = await isExampleMode();
  const alerts = example ? exampleSignalAlerts() : readSignalAlerts();
  if (!example && isStale(alerts) && !signalAlertsRunning()) void refreshSignalAlerts().catch(() => {});

  const snap = await getSnapshot();
  const held = new Set<string>();
  for (const acct of Object.values(snap.data)) {
    for (const e of acct.equities) held.add(e.symbol.toUpperCase());
    for (const o of acct.options) held.add(o.symbol.toUpperCase());
  }

  return (
    <main className="px-4">
      <PageHeader
        title="Signal alerts"
        subtitle="Watchlist · daily chart signals · last 20 sessions"
        right={<BackLink />}
      />
      <AlertsView initial={alerts} held={[...held]} initialRunning={!example && signalAlertsRunning()} example={example} />
    </main>
  );
}
