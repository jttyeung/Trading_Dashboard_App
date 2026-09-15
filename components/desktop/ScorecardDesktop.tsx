"use client";

// The two desktop /overview scorecard tabs, split per the account
// holder's own call ("I want my trade scorecard to be separate from the
// bots"): MyTradesScorecard is the account holder's own broker-confirmed
// trades — the suggestion-matched strategy/delta drill-down on top, then
// every closed trade graded against their own guidelines, management and
// entry conditions (MyTradesReport); BotScorecard is the paper bots'
// resolved picks beside the score-factor scorecard that grades the
// scoring behind them. They used to be one tab with a real/paper toggle.
import { ScorecardView } from "@/components/ScorecardView";
import { FactorScorecard } from "@/components/FactorScorecard";
import { MyTradesReport } from "@/components/MyTradesReport";
import type { MyTradesFile, PerformanceRow, ScoreFactorsFile } from "@/lib/types";

export function MyTradesScorecard({ rows, totalSuggestions, myTrades }: { rows: PerformanceRow[]; totalSuggestions: number; myTrades: MyTradesFile }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={rows} origin="real" totalSuggestions={totalSuggestions} />
      </div>
      <div>
        <MyTradesReport file={myTrades} />
      </div>
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
