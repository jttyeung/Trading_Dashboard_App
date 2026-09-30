// Quant CSP scan: the wheel study's put-selection rule, read from the bridge's
// data/quant-scan.json and sized against the selected account here.
//
// The rule (from the 2022–2026 backtests, confirmed on the 2023 hold-out): sell
// the LOWEST-delta put paying at least 4% of the strike per 30 days, never above
// 0.35 delta, across every expiration 28–45 days out; close at 50% of the credit.
// The bridge applies that to every approved name (market data only). What a pick
// means for THIS account — how many contracts fit, whether the name is already at
// its full size — depends on which account is selected, so that part lives here.
import fs from "node:fs";
import path from "node:path";
import type { AccountData } from "./types";
import { EXAMPLE_CLOSES, EXAMPLE_EARNINGS, lastClose } from "./example-market";

export interface QuantContract {
  exp: string;
  dte: number;
  strike: number;
  bid: number;
  ask: number;
  mark: number;
  delta: number;
  yield30: number; // % of strike per 30 days, at the mid
  annPct: number;
  premium: number; // $ per contract at the mid
  collateral: number;
  oi: number;
  volume: number;
  spreadPct: number | null;
  iv: number | null;
  belowSpotPct: number | null;
}

export interface QuantRow {
  sym: string;
  price: number | null;
  pick: QuantContract | null; // the contract the rule would sell
  best: QuantContract | null; // richest contract under the delta cap (the closest miss)
  reason: "ok" | "low" | "no_puts" | "no_chain" | string;
  erDate: string | null;
  erDays: number | null;
  erInWindow: boolean;
}

export interface QuantScan {
  meta: {
    asOf: string;
    marketOpen: boolean | null;
    universe: number;
    qualifying: number;
    params: { targetYield: number; yieldDays: number; maxDelta: number; expMin: number; expMax: number; closeAtPct: number; maxPerTicker: number; tickerBand: number };
    source: string;
    elapsedSec?: number;
  };
  rows: QuantRow[];
}

export const QUANT_PATH = path.join(process.cwd(), "data", "quant-scan.json");

export function getQuantScan(example = false): QuantScan | null {
  if (example) return exampleQuantScan();
  try {
    return JSON.parse(fs.readFileSync(QUANT_PATH, "utf8")) as QuantScan;
  } catch {
    return null;
  }
}

// ---- sizing against the selected account ----------------------------------------
// Mirrors the backtest's sell_put(): buying power = total value × (1 + margin),
// margin set from the VIX (0 under 20, then 5% per 5 points, capped at 35%); a
// ticker may hold 10% of buying power (one contract may overshoot to 15% when
// adding to a name already held); and every put stays cash-secured.
export interface QuantFit {
  contracts: number; // how many the rules allow right now (0 is fine — see flags)
  held: boolean; // shares, puts or LEAPS already on this name
  full: boolean; // the name is already at its per-ticker size
  cashShort: boolean; // free cash can't secure even one contract
  committed: number; // $ already tied up in this name
  perTickerCap: number; // $ the rule allows per name
}

export interface QuantCapacity {
  totalValue: number;
  cash: number;
  vix: number | null;
  margin: number; // VIX-scaled allowance, as a fraction of total value
  buyingPower: number;
  putObligations: number;
  committedTotal: number;
  freeCash: number; // cash + margin allowance − collateral already pledged
}

export function vixMargin(vix: number | null): number {
  if (vix == null || vix < 20) return 0;
  return Math.min(0.35, 0.05 * Math.floor(vix / 5));
}

export function quantCapacity(data: AccountData, vix: number | null): QuantCapacity {
  const totalValue = data.summary.totalValue;
  const margin = vixMargin(vix);
  const putObligations = data.options.filter((o) => o.side === "short" && o.optionType === "put").reduce((s, o) => s + o.strike * 100 * o.qty, 0);
  const stock = data.equities.reduce((s, e) => s + e.qty * e.price, 0);
  const leaps = data.options.filter((o) => o.side === "long" && o.optionType === "call").reduce((s, o) => s + o.mark * 100 * o.qty, 0);
  return {
    totalValue,
    cash: data.summary.cash,
    vix,
    margin,
    buyingPower: totalValue * (1 + margin),
    putObligations,
    committedTotal: putObligations + stock + leaps,
    freeCash: data.summary.cash + margin * totalValue - putObligations,
  };
}

export function quantFit(row: QuantRow, data: AccountData, cap: QuantCapacity, params: QuantScan["meta"]["params"]): QuantFit | null {
  const pick = row.pick;
  if (!pick) return null;
  const sym = row.sym.toUpperCase();
  const puts = data.options.filter((o) => o.symbol === sym && o.side === "short" && o.optionType === "put").reduce((s, o) => s + o.strike * 100 * o.qty, 0);
  const stock = data.equities.filter((e) => e.symbol === sym).reduce((s, e) => s + e.qty * e.price, 0);
  const leaps = data.options.filter((o) => o.symbol === sym && o.side === "long" && o.optionType === "call").reduce((s, o) => s + o.mark * 100 * o.qty, 0);
  const committed = puts + stock + leaps;
  const perTickerCap = params.maxPerTicker * cap.buyingPower;
  const roomTicker = perTickerCap - committed;
  const roomTotal = cap.buyingPower - cap.committedTotal;
  const room = Math.min(roomTicker, roomTotal, cap.freeCash);
  let contracts = room > 0 ? Math.floor(room / pick.collateral) : 0;
  if (contracts < 1 && roomTicker > 0) {
    // Under target but one contract doesn't fit: allowed up to cap + band when the
    // account-level limits still have room (the study's "adds" rule).
    const capHi = (params.maxPerTicker + params.tickerBand) * cap.buyingPower - committed;
    if (capHi >= pick.collateral && Math.min(roomTotal, cap.freeCash) >= pick.collateral) contracts = 1;
  }
  return {
    contracts,
    held: committed > 0,
    full: committed >= perTickerCap,
    cashShort: cap.freeCash < pick.collateral,
    committed,
    perTickerCap,
  };
}

// ---- demo ---------------------------------------------------------------------
// A plausible scan for the public demo: strikes sit 7–9% under the real close,
// premiums are set so roughly half the names pay the target. Not market data.
function exampleQuantScan(): QuantScan {
  const today = new Date();
  const exp = (dte: number) => new Date(today.getTime() + dte * 86_400_000).toISOString().slice(0, 10);
  const rows: QuantRow[] = Object.keys(EXAMPLE_CLOSES).map((sym, i) => {
    const price = lastClose(sym);
    const dte = [30, 35, 37, 42][i % 4];
    const inc = price < 30 ? 0.5 : price < 100 ? 1 : price < 250 ? 5 : 10;
    const strike = Math.round((price * (1 - 0.07 - (i % 3) * 0.01)) / inc) * inc;
    const yield30 = 3.1 + ((i * 7) % 23) / 10; // 3.1 … 5.3
    const mark = Math.round(((yield30 / 100) * strike * dte) / 30 * 100) / 100;
    const bid = Math.round((mark - 0.03) * 100) / 100;
    const contract: QuantContract = {
      exp: exp(dte), dte, strike, bid, ask: Math.round((mark + 0.03) * 100) / 100, mark,
      delta: Math.round((0.22 + ((i * 5) % 13) / 100) * 1000) / 1000,
      yield30: Math.round(yield30 * 100) / 100, annPct: Math.round((mark / strike) * (365 / dte) * 1000) / 10,
      premium: Math.round(mark * 100 * 100) / 100, collateral: strike * 100, oi: 1200 + ((i * 917) % 9000), volume: 80 + ((i * 131) % 700),
      spreadPct: Math.round((4 + (i % 5)) * 10) / 10, iv: Math.round((0.35 + ((i * 3) % 40) / 100) * 1000) / 1000,
      belowSpotPct: Math.round((1 - strike / price) * 1000) / 10,
    };
    const ok = yield30 >= 4;
    const er = EXAMPLE_EARNINGS[sym] ?? null;
    const erDays = er ? Math.ceil((Date.parse(er + "T21:00:00Z") - Date.now()) / 86_400_000) : null;
    return { sym, price, pick: ok ? contract : null, best: contract, reason: ok ? "ok" : "low", erDate: er, erDays, erInWindow: !!(ok && erDays != null && erDays >= 0 && erDays <= dte) };
  });
  rows.sort((a, b) => Number(!!b.pick) - Number(!!a.pick) || (b.pick ?? b.best)!.yield30 - (a.pick ?? a.best)!.yield30);
  return {
    meta: { asOf: new Date().toISOString(), marketOpen: true, universe: rows.length, qualifying: rows.filter((r) => r.pick).length, params: { targetYield: 0.04, yieldDays: 30, maxDelta: 0.35, expMin: 28, expMax: 45, closeAtPct: 50, maxPerTicker: 0.1, tickerBand: 0.05 }, source: "example" },
    rows,
  };
}
