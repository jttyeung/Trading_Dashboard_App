import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { ScorecardView } from "@/components/ScorecardView";
import { getSuggestionPerformance } from "@/lib/suggestion-performance";
import { getStrategyPerformance } from "@/lib/strategy-performance";

export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  // totalSuggestions (context: "how small a slice of everything ever
  // suggested this is") is still sourced from the real-trade-only file —
  // there's no single "total ever suggested" concept spanning both real
  // suggestions and paper-bot candidates, so this stays real-specific.
  const [{ meta }, { rows }] = await Promise.all([getSuggestionPerformance(), getStrategyPerformance()]);

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader title="Suggestion Scorecard" subtitle="Suggested vs. actual — real and paper trades compared" right={<BackLink />} />
        <ScorecardView rows={rows} totalSuggestions={meta.totalSuggestions} />
        {/* The score-factor scorecard (which factors in the bots' own
            score correlated with a better outcome) lives on the desktop
            /overview Scorecard tab — a sit-down review that wants width,
            moved there per the account holder's own call. */}
        <p className="mt-3 px-1 text-[11px] text-muted">
          Score-factor correlations (VRP, IV rank, signals, walls, gamma, timing vs outcome) are on the desktop
          Scorecard tab.
        </p>
      </ShowAmounts>
    </main>
  );
}
