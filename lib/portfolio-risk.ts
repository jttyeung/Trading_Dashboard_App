// Portfolio-risk rollup: sector concentration, daily theta against its bands,
// and open P&L against its floor — for the whole portfolio (every account across
// every bridge) and per account. Pure — no fs, no React — so it can be computed
// in any server component from the merged snapshot plus the sector map.
//
// Capital per ticker reuses computeHoldings (stock value + CSP collateral + LEAP
// / hedge market value + spread defined risk), so a sector's dollar figure is
// exactly the sum of the Holdings table rows that feed it. Theta reuses the
// Home page's own daily-theta rollup; open P&L is unrealized stock + option P&L
// from cost basis.
import type {
  AccountData,
  AccountRisk,
  PortfolioRisk,
  RiskReading,
  SectorBucket,
  Snapshot,
  SectorMap,
  ThetaStatus,
  OpenPnlStatus,
} from "./types";
import { computeHoldings } from "./holdings";
import { dailyThetaBreakdown } from "./theta";
import { equityPnl, isCashEquivalent, optionPnl } from "./calc";
import { accountLabel } from "./account-shared";
import { RISK_RULES, UNCLASSIFIED } from "./risk-rules";

function thetaStatus(thetaPct: number, portfolioValue: number): ThetaStatus {
  if (portfolioValue <= 0) return "unknown";
  const t = RISK_RULES.theta;
  if (thetaPct < t.minPct) return "below_target";
  if (thetaPct <= t.targetMaxPct) return "on_target";
  if (thetaPct <= t.maxPct) return "above_target_below_ceiling";
  return "over_ceiling";
}

function openPnlStatus(openPnLPct: number, portfolioValue: number): OpenPnlStatus {
  if (portfolioValue <= 0) return "unknown";
  return openPnLPct < RISK_RULES.openPnl.minPct ? "below_target" : "on_target";
}

function openPnl(data: AccountData): number {
  let total = 0;
  for (const e of data.equities) if (!isCashEquivalent(e.symbol)) total += equityPnl(e);
  for (const o of data.options) total += optionPnl(o);
  return total;
}

function reading(portfolioValue: number, thetaToday: number, openPnL: number): RiskReading {
  const thetaPct = portfolioValue > 0 ? thetaToday / portfolioValue : 0;
  const openPnLPct = portfolioValue > 0 ? openPnL / portfolioValue : 0;
  return {
    portfolioValue,
    thetaToday,
    thetaPct,
    thetaStatus: thetaStatus(thetaPct, portfolioValue),
    thetaGapToTarget: Math.max(0, RISK_RULES.theta.minPct * portfolioValue - thetaToday),
    openPnL,
    openPnLPct,
    openPnLStatus: openPnlStatus(openPnLPct, portfolioValue),
  };
}

/** Sector buckets from a capital-per-ticker map. Exported for the fixture and
 *  for any surface that wants the breakout without the theta/P&L readings. */
export function bucketBySector(
  capitalByTicker: Map<string, number>,
  sectors: SectorMap,
  portfolioValue: number,
): SectorBucket[] {
  const buckets = new Map<string, SectorBucket>();
  for (const [symbol, value] of capitalByTicker) {
    if (value <= 0) continue;
    const sector = sectors[symbol.toUpperCase()] ?? UNCLASSIFIED;
    const b: SectorBucket = buckets.get(sector) ?? {
      sector,
      value: 0,
      pct: 0,
      over: false,
      unclassified: sector === UNCLASSIFIED,
      tickers: [],
    };
    b.value += value;
    b.tickers.push({ symbol, value });
    buckets.set(sector, b);
  }
  const out = [...buckets.values()];
  for (const b of out) {
    b.pct = portfolioValue > 0 ? b.value / portfolioValue : 0;
    b.over = b.pct > RISK_RULES.sector.maxAllocationPct;
    b.tickers.sort((a, z) => z.value - a.value);
  }
  return out.sort((a, z) => z.value - a.value);
}

export function computePortfolioRisk(snap: Snapshot, sectors: SectorMap): PortfolioRisk {
  const capital = new Map<string, number>();
  let totalValue = 0;
  let totalTheta = 0;
  let totalOpenPnl = 0;
  const perAccount: AccountRisk[] = [];

  for (const account of snap.accounts) {
    const data = snap.data[account.id];
    if (!data) continue;
    for (const row of computeHoldings(data)) {
      capital.set(row.symbol, (capital.get(row.symbol) ?? 0) + row.value);
    }
    const theta = dailyThetaBreakdown(data.options).total;
    const pnl = openPnl(data);
    const value = data.summary.totalValue;
    totalValue += value;
    totalTheta += theta;
    totalOpenPnl += pnl;
    perAccount.push({ accountId: account.id, accountLabel: accountLabel(account), ...reading(value, theta, pnl) });
  }

  return {
    overall: reading(totalValue, totalTheta, totalOpenPnl),
    sectors: bucketBySector(capital, sectors, totalValue),
    perAccount: perAccount.sort((a, z) => a.accountLabel.localeCompare(z.accountLabel)),
    rules: RISK_RULES,
  };
}
