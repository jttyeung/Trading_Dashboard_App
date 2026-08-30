import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { PortfolioRiskView } from "@/components/PortfolioRiskView";
import { getPortfolioRisk } from "@/lib/portfolio-risk";
import { getRefreshStatus } from "@/lib/refresh-status";
import { DataRefresh } from "@/components/DataRefresh";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const risk = await getPortfolioRisk();

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title="Portfolio Risk"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Theta ceiling · sector concentration cap</span>
              <DataRefresh nextAt={getRefreshStatus().app?.nextAt} />
            </span>
          }
          right={<BackLink />}
        />
        <PortfolioRiskView overall={risk.overall} perAccount={risk.perAccount} />
      </ShowAmounts>
    </main>
  );
}
