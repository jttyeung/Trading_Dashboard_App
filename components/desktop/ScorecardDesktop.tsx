"use client";

// The two desktop /overview scorecard tabs, split per the account
// holder's own call ("I want my trade scorecard to be separate from the
// bots"): MyTradesScorecard is the account holder's own broker-confirmed
// trades that matched a suggestion; BotScorecard is the paper bots'
// resolved picks beside the score-factor scorecard that grades the
// scoring behind them. They used to be one tab with a real/paper toggle.
import { ScorecardView } from "@/components/ScorecardView";
import { FactorScorecard } from "@/components/FactorScorecard";
import type { PerformanceRow, ScoreFactorsFile } from "@/lib/types";

export function MyTradesScorecard({ rows, totalSuggestions }: { rows: PerformanceRow[]; totalSuggestions: number }) {
  return (
    <div className="max-w-3xl">
      <ScorecardView rows={rows} origin="real" totalSuggestions={totalSuggestions} />
    </div>
  );
}

export function BotScorecard({ rows, scoreFactors }: { rows: PerformanceRow[]; scoreFactors: ScoreFactorsFile }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={rows} origin="paper" />
      </div>
      <div>
        <FactorScorecard file={scoreFactors} />
      </div>
    </div>
  );
}
