// /overview combines the desktop positions table and all three paper-bot
// review tables behind one icon rail, instead of four separately-typed
// URLs (/desktop, /bot, /bot-20-delta-safe, /bot-aggressive — all four
// still work on their own too, nothing here removes them). Fetches
// everything once server-side, same "fetch once, pass down" convention
// as the rest of this app, so switching tabs client-side is instant
// with no re-fetch.
import { notFound } from "next/navigation";
import { BRIDGE } from "@/lib/features";
import { getSnapshot } from "@/lib/snapshot";
import { getAlerts } from "@/lib/alerts";
import { getGeneralBot, get20DeltaSafeBot, getAggressiveBot } from "@/lib/bot";
import { getStrategyPerformance } from "@/lib/strategy-performance";
import { getScoreFactors } from "@/lib/score-factors";
import { getMyTrades } from "@/lib/my-trades";
import { getCspPicks } from "@/lib/csp-picks";
import { getPortfolioRisk } from "@/lib/portfolio-risk";
import { accountLabel, paperAccounts, realAccounts } from "@/lib/account-shared";
import { readAutotraderReport } from "@/lib/autotrader";
import { isExampleMode } from "@/lib/example-mode";
import { OverviewShell } from "@/components/overview/OverviewShell";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  if (BRIDGE) notFound(); // OptionsEvaluator-only; see lib/features.ts
  const snap = await getSnapshot();
  const alerts = (await getAlerts()).alerts;
  const [generalBot, safeBot, aggressiveBot, strategyPerf, scoreFactors, myTrades, cspPicks, risk, exampleMode] =
    await Promise.all([
      getGeneralBot(),
      get20DeltaSafeBot(),
      getAggressiveBot(),
      getStrategyPerformance(),
      getScoreFactors(),
      getMyTrades(),
      getCspPicks(),
      getPortfolioRisk(),
      isExampleMode(),
    ]);

  // Same per-account flatten app/desktop/page.tsx uses — see its own
  // comment for why this can't just read the pre-merged "combined" bucket.
  const options = realAccounts(snap.accounts).flatMap((a) =>
    snap.data[a.id].options.map((o) => ({ ...o, sourceLabel: accountLabel(a) })),
  );
  // The Auto Trader paper accounts' positions, for their own tab — never
  // mixed into the Positions tab above.
  const paperOptions = paperAccounts(snap.accounts).flatMap((a) =>
    (snap.data[a.id]?.options ?? []).map((o) => ({ ...o, sourceLabel: accountLabel(a) })),
  );
  const hasAutotrader = readAutotraderReport() !== null;

  return (
    <OverviewShell
      options={options}
      paperOptions={paperOptions}
      hasAutotrader={hasAutotrader}
      alerts={alerts}
      generalBot={generalBot}
      safeBot={safeBot}
      aggressiveBot={aggressiveBot}
      scoreRows={strategyPerf.rows}
      scoreFactors={scoreFactors}
      myTrades={myTrades}
      cspPicks={cspPicks}
      risk={risk}
      exampleMode={exampleMode}
    />
  );
}
