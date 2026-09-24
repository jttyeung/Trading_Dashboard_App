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
import { YtdReturnsChart } from "@/components/YtdReturnsChart";
import type { MyTradesFile, PerformanceRow, ScoreFactorsFile, YtdReturnsFile } from "@/lib/types";

export function MyTradesScorecard({
  rows,
  totalSuggestions,
  myTrades,
  ytdReturns,
}: {
  rows: PerformanceRow[];
  totalSuggestions: number;
  myTrades: MyTradesFile;
  ytdReturns: YtdReturnsFile;
}) {
  // Every underlying the account holder has a closed trade on, from the
  // files this tab already renders: suggestion-matched rows, every graded
  // short trade, and the LEAPs section.
  const tickers = [
    ...rows.filter((r) => r.origin === "real").map((r) => r.ticker),
    ...myTrades.trades.map((t) => t.ticker),
    ...myTrades.leaps.trades.map((t) => t.ticker),
  ];
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={rows} origin="real" totalSuggestions={totalSuggestions} />
        <YtdReturnsChart file={ytdReturns} tickers={tickers} title="Tickers you traded" />
      </div>
      <div>
        <MyTradesReport file={myTrades} />
      </div>
    </div>
  );
}

export function BotScorecard({
  rows,
  scoreFactors,
  ytdReturns,
}: {
  rows: PerformanceRow[];
  scoreFactors: ScoreFactorsFile;
  ytdReturns: YtdReturnsFile;
}) {
  // The bots' resolved picks — the same rows the strategy view above grades.
  const tickers = rows.filter((r) => r.origin === "paper").map((r) => r.ticker);
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={rows} origin="paper" />
        <YtdReturnsChart file={ytdReturns} tickers={tickers} title="Tickers the bots traded" />
      </div>
      <div>
        <FactorScorecard file={scoreFactors} />
      </div>
    </div>
  );
}
