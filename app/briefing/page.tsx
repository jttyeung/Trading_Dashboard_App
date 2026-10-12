import { PageHeader, Card } from "@/components/ui";
import { AmReportView } from "@/components/AmReportView";
import { getAmReport } from "@/lib/am-report";
import { getSnapshot } from "@/lib/snapshot";
import { getSelectedAccount } from "@/lib/account";
import { computeHoldings, underweightTickers } from "@/lib/holdings";
import { getRefreshStatus } from "@/lib/refresh-status";
import { DataRefresh } from "@/components/DataRefresh";
import { BriefingRefresh } from "@/components/BriefingRefresh";
import { BRIDGE } from "@/lib/features";
import { ThetaGoalCard } from "@/components/ThetaGoalCard";
import { getPortfolioRisk } from "@/lib/portfolio-risk";
import { getCspPicks } from "@/lib/csp-picks";
import { getVixSnapshot } from "@/lib/vix-data";
import { assessVix } from "@/lib/vix";
import { buildThetaGoalPlan } from "@/lib/theta-goal";
import { getEarnings } from "@/lib/earnings";

export const dynamic = "force-dynamic";

function asOfLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver" });
  } catch {
    return iso;
  }
}

export default async function BriefingPage() {
  const snap = await getSnapshot();
  const { data } = await getSelectedAccount(snap);
  const report = getAmReport(snap.meta.source === "example");
  // Names sitting under 8.5% of the selected account — the Brief green-flags any
  // CSP-board row that's also underweight (the same overlap the Portfolio page marks).
  const underweight = underweightTickers(computeHoldings(data));
  // Everything you already hold in any form (stock or option) — used to spot
  // high-conviction board names you DON'T own yet.
  const book = Array.from(
    new Set([...data.equities.map((e) => e.symbol.toUpperCase()), ...data.options.map((o) => o.symbol.toUpperCase())]),
  );

  // Theta goal across every real account (not the selected one): the goal is the whole
  // portfolio's, and the plan needs each account's own shares, calls and cash.
  const risk = await getPortfolioRisk();
  const vixSnap = getVixSnapshot(snap.meta.source === "example");
  const thetaPlan =
    risk.blended.thetaGoal > 0
      ? buildThetaGoalPlan({
          goal: risk.blended.thetaGoal,
          current: risk.blended.thetaToday,
          inputs: snap.accounts
            .filter((a) => a.type !== "all" && a.type !== "paper" && snap.data[a.id])
            .map((a) => ({ account: a, data: snap.data[a.id] })),
          picks: (await getCspPicks()).picks,
          earnings: getEarnings(snap.meta.source === "example"),
          reservePct: vixSnap ? assessVix(vixSnap).targetReservePct : null,
        })
      : null;

  return (
    <main className="px-4">
      <PageHeader
        title="Morning Brief"
        subtitle={
          report ? (
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Pre-open · {report.meta.passed} on board · {asOfLabel(report.meta.asOf)}</span>
              <DataRefresh nextAt={getRefreshStatus().am_report?.nextAt} />
            </span>
          ) : (
            "Run am_report.py to build the report"
          )
        }
        // The bridge rebuilds the brief on request; OptionsEvaluator rebuilds
        // it hourly in the session, and an on-demand run would re-fetch every
        // watchlist chain, so the button only shows on the bridge.
        right={report && BRIDGE ? <BriefingRefresh /> : undefined}
      />
      {thetaPlan && <ThetaGoalCard plan={thetaPlan} />}
      {report ? (
        <AmReportView report={report} underweight={underweight} book={book} />
      ) : (
        <Card className="mt-3 px-4 py-4 text-[12px] leading-relaxed text-muted">
          No briefing yet. Run <span className="font-mono">python am_report.py</span> (or add it to auto_push) to
          build the regime gate, CSP board, VRP heat map, and gamma walls from your Schwab market data.
        </Card>
      )}
    </main>
  );
}
