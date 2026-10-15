import { notFound } from "next/navigation";
import { BRIDGE } from "@/lib/features";
import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { PortfolioRiskView } from "@/components/PortfolioRiskView";
import { getPortfolioRisk } from "@/lib/portfolio-risk";
import { appFeed } from "@/lib/refresh-status";
import { DataRefresh } from "@/components/DataRefresh";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  if (BRIDGE) notFound(); // OptionsEvaluator-only; see lib/features.ts
  const feed = await appFeed(); // the data badge: next refresh, or Login needed / failed
  const risk = await getPortfolioRisk();

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Portfolio Risk"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Theta ceiling · sector cap ({(risk.blended.maxSectorAllocationPct * 100).toFixed(0)}%) · beta &amp; open P&L</span>
              <DataRefresh status={feed} />
            </span>
          }
          right={<BackLink />}
        />
        <PortfolioRiskView perAccount={risk.perAccount} blended={risk.blended} />
      </ShowAmounts>
    </main>
  );
}
