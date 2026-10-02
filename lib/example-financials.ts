// Synthetic financials for example mode, seeded off the ticker the same way
// exampleChartData is, so different tickers look different. Every number is
// made up but internally consistent (net income under revenue, the waterfall
// reconciles, FCF = operating cash flow − capex) so the panel exercises every
// mark it draws, including a losing quarter and an EPS miss.
import type { Financials, FinancialPeriod } from "./financials";

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const QUARTER_ENDS = ["2024-09-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"];

function period(label: string, fiscalYear: number, fiscalQuarter: number, end: string, rand: () => number, scale: number): FinancialPeriod {
  const revenue = scale * (0.8 + rand() * 0.4);
  // One period in five loses money, so the negative bars and margin show.
  const margin = rand() < 0.2 ? -(0.05 + rand() * 0.3) : 0.04 + rand() * 0.22;
  const netIncome = revenue * margin;
  const operatingCashFlow = revenue * (0.1 + rand() * 0.2);
  const capex = revenue * (0.04 + rand() * 0.12);
  return {
    label,
    fiscalYear,
    fiscalQuarter,
    end,
    revenue,
    netIncome,
    netMarginPct: margin * 100,
    debt: scale * (1.5 + rand() * 0.6),
    cash: scale * (0.4 + rand() * 0.5),
    operatingCashFlow,
    capex,
    freeCashFlow: operatingCashFlow - capex,
  };
}

export function exampleFinancials(symbol: string): Financials {
  const seed = symbol.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  const rand = rng(seed);
  const qScale = (1 + (seed % 40)) * 1e8;

  // A calendar fiscal year, so the quarter is just the end month / 3.
  const quarterly = QUARTER_ENDS.map((end, i) => {
    const fy = Number(end.slice(0, 4));
    const q = Number(end.slice(5, 7)) / 3;
    return period(`Q${q} '${String(fy).slice(2)}`, fy, q, end, rand, qScale * (1 + i * 0.04));
  });
  const annual = [2021, 2022, 2023, 2024, 2025].map((fy, i) => period(`FY${fy}`, fy, 0, `${fy}-12-31`, rand, qScale * 4 * (0.8 + i * 0.08)));

  const last = annual[annual.length - 1];
  const revenue = last.revenue ?? 0;
  const costOfRevenue = -revenue * 0.45;
  const grossProfit = revenue + costOfRevenue;
  const operatingExpenses = -revenue * 0.3;
  const operatingIncome = grossProfit + operatingExpenses;
  const nonOperating = -revenue * 0.02;
  const netIncome = last.netIncome ?? 0;
  const taxesAndOther = netIncome - (operatingIncome + nonOperating);

  // The same last four quarters the bars show; the third one misses.
  const eps = quarterly.slice(-4).map((p, i) => {
    const estimate = 0.5 + rand();
    return { period: p.end, year: p.fiscalYear, quarter: p.fiscalQuarter, estimate, actual: estimate * (i === 2 ? 0.8 : 1.05 + rand() * 0.1) };
  });

  return {
    symbol,
    entityName: `${symbol} Example Corp`,
    fiscalYearEndMonth: 12,
    lastFiled: "2026-08-01",
    quarterly,
    annual,
    waterfall: { label: last.label, end: last.end, revenue, costOfRevenue, grossProfit, operatingExpenses, operatingIncome, nonOperating, taxesAndOther, netIncome },
    eps,
    nextEarnings: { date: "2026-10-28", hour: "amc" },
    concepts: {},
    fetchedAt: new Date().toISOString(),
  };
}
