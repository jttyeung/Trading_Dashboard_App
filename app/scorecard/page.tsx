import { BackLink, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { ScorecardView } from "@/components/ScorecardView";
import { getSuggestionPerformance } from "@/lib/suggestion-performance";

export const dynamic = "force-dynamic";

export default async function ScorecardPage() {
  const { matched, meta } = await getSuggestionPerformance();

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader title="Suggestion Scorecard" subtitle="Suggested vs. actual — what you traded and how it closed" right={<BackLink />} />
        <ScorecardView matched={matched} totalSuggestions={meta.totalSuggestions} />
      </ShowAmounts>
    </main>
  );
}
