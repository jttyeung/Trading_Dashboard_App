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
      </ShowAmounts>
    </main>
  );
}
