"use client";

// The two desktop /overview scorecard tabs, split per the account
// holder's own call ("I want my trade scorecard to be separate from the
// bots"): MyTradesScorecard is the account holder's own broker-confirmed
// trades — a strategy/delta drill-down over EVERY closed trade on top
// (not just the ones the app had suggested: "it should include all the
// trades I made"), then the same trades graded against their own
// guidelines, management and entry conditions (MyTradesReport); BotScorecard is the paper bots'
// resolved picks beside the score-factor scorecard that grades the
// scoring behind them. They used to be one tab with a real/paper toggle.
import { ScorecardView } from "@/components/ScorecardView";
import { FactorScorecard } from "@/components/FactorScorecard";
import { MyTradesReport } from "@/components/MyTradesReport";
import type { MyLeapTrade, MyTrade, MyTradesFile, PerformanceRow, ScoreFactorsFile } from "@/lib/types";

// myTradeRows reshapes my-trades.json into the drill-down's rows, grouped
// by what was actually traded rather than by the app's strategy labels —
// most real trades never matched a suggestion, so a strategy label would
// hide them. A short call is labelled covered because the brokers'
// covered-call tables are where every one of them lands.
function myTradeRows(file: MyTradesFile): PerformanceRow[] {
  const row = (t: MyTrade | MyLeapTrade, strategy: string, annualized: number | null): PerformanceRow => ({
    origin: "real",
    ticker: t.ticker,
    strategy,
    contractSymbol: t.contractSymbol,
    delta: t.deltaAtOpen,
    dte: t.dteAtOpen,
    rorPercent: t.returnPct,
    annualizedRorPercent: annualized,
    realizedPnl: t.realizedPnl,
    win: t.win,
    openDate: t.openDate,
    closeDate: t.closeDate,
    deltaAtOpen: t.deltaAtOpen,
    dteAtOpen: t.dteAtOpen,
  });
  return [
    ...file.trades.map((t) => row(t, t.putCall === "CALL" ? "Covered calls" : "Cash-secured puts", t.annualizedRorAtOpen)),
    ...(file.leaps?.trades ?? []).map((t) => row(t, "LEAPs", null)),
  ];
}

export function MyTradesScorecard({ myTrades }: { myTrades: MyTradesFile }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <ScorecardView rows={myTradeRows(myTrades)} origin="real" />
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
