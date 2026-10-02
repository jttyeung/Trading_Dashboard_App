// Company financials shown under the chart (components/FinancialsPanel.tsx).
// Mirrors OptionsEvaluator's internal/chartapi FinancialsResponse: SEC-filed
// quarterly/annual figures (internal/sec) plus Finnhub's last four quarters of
// EPS actual vs estimate. A null field means the filings didn't tag that value
// for the period, not zero.

export interface FinancialPeriod {
  label: string; // "Q4 '26" or "FY2026", on the company's own fiscal calendar
  fiscalYear: number;
  fiscalQuarter: number; // 0 for a full year
  end: string; // YYYY-MM-DD
  revenue: number | null;
  netIncome: number | null;
  netMarginPct: number | null;
  debt: number | null;
  cash: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
}

// One fiscal year from revenue down to net income. The in-between steps are
// residuals of the filed subtotals, so they reconcile; costs are negative.
export interface FinancialWaterfall {
  label: string;
  end: string;
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  operatingExpenses: number | null;
  operatingIncome: number | null;
  nonOperating: number | null;
  taxesAndOther: number | null;
  netIncome: number | null;
}

export interface EarningsSurprise {
  period: string;
  year: number; // fiscal
  quarter: number;
  actual: number | null;
  estimate: number | null;
}

export interface Financials {
  symbol: string;
  entityName: string;
  fiscalYearEndMonth: number;
  lastFiled: string;
  quarterly: FinancialPeriod[] | null; // oldest first
  annual: FinancialPeriod[] | null;
  waterfall: FinancialWaterfall | null;
  eps: EarningsSurprise[] | null; // oldest first
  nextEarnings: { date: string; hour: string } | null;
  // us-gaap tags each metric was read from, for checking a number against the filing.
  concepts: Record<string, string[] | null>;
  fetchedAt: string;
}

// Same-origin route (app/api/financials/route.ts), same reason fetchChart uses
// one: the phone's browser never has to reach the daemon's port. A 404 means
// "no SEC filings" (an ETF, an index, a 20-F filer), which the panel shows as
// a note rather than an error.
export async function fetchFinancials(symbol: string): Promise<Financials | { unavailable: string }> {
  const res = await fetch(`/api/financials?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  let body: (Financials & { error?: string }) | { error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 404) return { unavailable: body?.error ?? `No SEC filings for ${symbol}.` };
  if (!res.ok || !body || ("error" in body && body.error)) {
    throw new Error(body?.error ?? `financials failed for ${symbol} (${res.status})`);
  }
  return body as Financials;
}
