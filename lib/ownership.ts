// Insider activity under the chart (components/InsiderPanel.tsx). Mirrors
// OptionsEvaluator's internal/chartapi OwnershipResponse: insiders' open-market
// trades from Form 4 (via Finnhub), kept to real purchases and sales (grants,
// option exercises and tax withholding dropped), each tagged from the Form 4
// itself with the insider's role, title and whether it was a pre-planned
// 10b5-1 trade.

export type InsiderRoleGroup = "C-suite" | "Other officer" | "Director" | "10% owner" | "Other";

export interface InsiderTrade {
  name: string;
  date: string;
  filed: string;
  buy: boolean;
  shares: number;
  price: number;
  value: number;
  sharesAfter: number;
  role: InsiderRoleGroup | ""; // "" when the Form 4 couldn't be read
  title: string; // the filing's own words, e.g. "Chairman, CEO and President"
  planned: boolean | null; // 10b5-1 trading plan; null when unknown
}

export interface InsiderRole {
  role: InsiderRoleGroup;
  buyValue: number;
  sellValue: number;
  plannedSellValue: number; // part of sellValue under 10b5-1 plans
  buyers: string[];
  sellers: string[];
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

export interface Ownership {
  symbol: string;
  trades: InsiderTrade[]; // newest first, last 12 months
  windows: InsiderWindow[]; // 3, 6, 12 months
  months: InsiderMonth[]; // oldest first, 12
  roles: InsiderRole[]; // last 12 months, most senior first
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
