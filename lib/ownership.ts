// Insider activity and 5%+ holders under the chart (components/InsiderPanel.tsx).
// Mirrors OptionsEvaluator's internal/chartapi OwnershipResponse: insiders'
// open-market trades from Form 4 (via Finnhub), kept to real purchases and
// sales (grants, option exercises and tax withholding dropped), and current
// 5%+ holders from SEC Schedule 13G filings.

export interface InsiderTrade {
  name: string;
  date: string;
  filed: string;
  buy: boolean;
  shares: number;
  price: number;
  value: number;
  sharesAfter: number;
}

export interface InsiderWindow {
  months: number;
  buyValue: number;
  sellValue: number;
  buyers: number; // distinct insiders
  sellers: number;
  buyTrades: number;
  sellTrades: number;
}

export interface InsiderMonth {
  month: string; // YYYY-MM
  buyValue: number;
  sellValue: number;
}

export interface Holder {
  name: string;
  percent: number;
  shares: number;
  asOf: string; // event date the filing reports; "" when an older filing's text didn't say
  filed: string;
  form: string;
}

export interface Ownership {
  symbol: string;
  trades: InsiderTrade[]; // newest first, last 12 months
  windows: InsiderWindow[]; // 3, 6, 12 months
  months: InsiderMonth[]; // oldest first, 12
  holders: Holder[];
  fetchedAt: string;
}

export async function fetchOwnership(symbol: string): Promise<Ownership> {
  const res = await fetch(`/api/ownership?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (Ownership & { error?: string }) | null;
  if (!res.ok || !body || body.error) {
    throw new Error(body?.error ?? `insider data failed for ${symbol} (${res.status})`);
  }
  return body;
}
