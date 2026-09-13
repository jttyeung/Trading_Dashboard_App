"use client";

// The /overview Scorecard tab: the real-vs-paper strategy scorecard and
// the score-factor scorecard side by side. Moved here from the phone
// /scorecard page per the account holder's own call — the factor section
// is a sit-down review that wants width (a sparkline beside its numbers,
// not under them) and belongs next to the three bot tables whose picks it
// grades. The phone page keeps the strategy view only.
import { ScorecardView } from "@/components/ScorecardView";
import { FactorScorecard } from "@/components/FactorScorecard";
import type { PerformanceRow, ScoreFactorsFile } from "@/lib/types";

export function ScorecardDesktop({
  rows,
  totalSuggestions,
  scoreFactors,
}: {
  rows: PerformanceRow[];
  totalSuggestions: number;
  scoreFactors: ScoreFactorsFile;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={rows} totalSuggestions={totalSuggestions} />
      </div>
      <div>
        <FactorScorecard file={scoreFactors} variant="desktop" />
      </div>
    </div>
  );
}
