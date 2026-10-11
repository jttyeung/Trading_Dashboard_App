// "Closing the gap" plan for the blended theta goal (RULE-032, owned by the backend
// and read from portfolio-risk.json). Pure — no fs, no React — so the Brief and any
// test share one definition.
//
// Two levers only, because those are where the missing theta actually sits:
//  1. Shares with no call against them (a covered call earns theta on stock that
//     otherwise earns none), valued with the call ladder the snapshot already carries.
//  2. Free cash above the VIX regime's cash reserve, valued with the suggest engine's
//     own short-put picks (already gated by sector, size and liquidity rules).
// Nothing here re-ranks or invents a trade: it reads the engine's picks and the
// snapshot's ladders, and adds up what they would earn per day.
import { daysToExpiry, freeCashValue } from "./calc";
import type { Account, AccountData, CspPick, CoveredCallQuote } from "./types";

/** Most picks the cash lever lists. A thin day lists fewer: nothing here pads a list. */
const MAX_CASH_PICKS = 8;
/** Engine rank (within its strategy) a pick must hold to be listed. */
const MAX_PICK_RANK = 10;
/** A lot earning less than this a day is noise next to the goal, so it isn't listed. */
const MIN_LOT_THETA = 10;
/** Sheltered accounts: a call-away there realizes no tax. Matched on the label. */
const SHELTERED = /\b(IRA|HSA|401\s?k?|Roth)\b/i;

export interface UncoveredLot {
  accountId: string;
  accountLabel: string;
  symbol: string;
  contracts: number; // whole 100-share lots with no short call against them
  shares: number;
  call: CoveredCallQuote; // the ladder rung that earns the most per day
  /** Premium per day if sold today: mark × 100 × contracts ÷ DTE. An average decay, so
   *  an estimate — real theta runs lower early in the life and higher near expiry. */
  estThetaPerDay: number;
  /** Gain (negative = loss) if called away at that strike, for a taxable account; null
   *  in a sheltered one or when cost basis is unknown. */
  callAwayGain: number | null;
}

export interface CashPick {
  pick: CspPick;
  dte: number; // recomputed from the expiration, not the stored `dte`
  collateral: number; // strike × 100, one contract
  thetaPerDay: number; // the contract's own theta, $/day
  thetaPer1kCollateral: number;
}

export interface ThetaGoalPlan {
  goal: number;
  current: number;
  gap: number;
  uncovered: UncoveredLot[];
  uncoveredTheta: number;
  freeCash: number;
  reserve: number | null; // dollars the VIX regime says to keep, null without a VIX read
  room: number; // free cash above the reserve
  picks: CashPick[];
  picksCollateral: number;
  picksTheta: number;
  projected: number; // current + both levers
  reachesGoal: boolean;
}

export interface AccountInput {
  account: Account;
  data: AccountData;
}

function label(a: Account): string {
  return a.nickname ?? a.mask ?? a.id;
}

/** Lots with no call against them, per account. A short call on a symbol covers 100
 *  shares per contract; an already-expired contract (a weekend snapshot still lists
 *  Friday's) no longer covers anything. */
export function uncoveredLots(inputs: AccountInput[], today?: string): UncoveredLot[] {
  const out: UncoveredLot[] = [];
  for (const { account, data } of inputs) {
    const covered = new Map<string, number>();
    for (const o of data.options) {
      if (o.optionType !== "call" || o.side !== "short") continue;
      if (daysToExpiry(o.expiration, today) < 0) continue;
      const sym = o.symbol.toUpperCase();
      covered.set(sym, (covered.get(sym) ?? 0) + o.qty);
    }
    for (const e of data.equities) {
      const contracts = Math.floor(e.qty / 100) - (covered.get(e.symbol.toUpperCase()) ?? 0);
      if (contracts <= 0) continue;
      // The ladder is ~30Δ at 7–28 days. A rung with no premium or no days is no rung.
      const rungs = (e.coveredCalls ?? []).filter((c) => c.dte > 0 && c.mark > 0);
      if (rungs.length === 0) continue;
      const call = rungs.reduce((best, c) => (c.mark / c.dte > best.mark / best.dte ? c : best));
      const estThetaPerDay = (call.mark * 100 * contracts) / call.dte;
      if (estThetaPerDay < MIN_LOT_THETA) continue;
      const sheltered = SHELTERED.test(label(account));
      out.push({
        accountId: account.id,
        accountLabel: label(account),
        symbol: e.symbol,
        contracts,
        shares: contracts * 100,
        call,
        estThetaPerDay,
        callAwayGain: sheltered || !(e.avgCost > 0) ? null : (call.strike - e.avgCost) * contracts * 100,
      });
    }
  }
  return out.sort((a, b) => b.estThetaPerDay - a.estThetaPerDay);
}

/** One contract per underlying from the engine's picks, best theta per collateral
 *  dollar first, until the room above the cash reserve is used up. */
export function cashPicks(picks: CspPick[], room: number, today?: string): CashPick[] {
  const cands: CashPick[] = [];
  for (const p of picks) {
    const dte = daysToExpiry(p.expiration, today);
    if (dte < 1 || p.rank > MAX_PICK_RANK || p.thetaPerDay == null || p.thetaPerDay <= 0) continue;
    const collateral = p.strike * 100;
    cands.push({ pick: p, dte, collateral, thetaPerDay: p.thetaPerDay, thetaPer1kCollateral: (p.thetaPerDay / collateral) * 1000 });
  }
  cands.sort((a, b) => b.thetaPer1kCollateral - a.thetaPer1kCollateral);
  const seen = new Set<string>();
  const out: CashPick[] = [];
  let used = 0;
  for (const c of cands) {
    if (out.length >= MAX_CASH_PICKS) break;
    if (seen.has(c.pick.ticker) || used + c.collateral > room) continue;
    seen.add(c.pick.ticker);
    used += c.collateral;
    out.push(c);
  }
  return out;
}

export function buildThetaGoalPlan(args: {
  goal: number;
  current: number;
  inputs: AccountInput[];
  picks: CspPick[];
  /** The VIX regime's cash target as a share of the whole portfolio; null when unknown. */
  reservePct: number | null;
  /** ISO date; defaults to today (ET) — only a test needs to pin it. */
  today?: string;
}): ThetaGoalPlan {
  const { goal, current, inputs, picks, reservePct, today } = args;
  const uncovered = uncoveredLots(inputs, today);
  const uncoveredTheta = uncovered.reduce((s, l) => s + l.estThetaPerDay, 0);

  const freeCash = inputs.reduce((s, { data }) => s + freeCashValue(data.summary, data.equities, data.options), 0);
  const total = inputs.reduce((s, { data }) => s + data.summary.totalValue, 0);
  const reserve = reservePct == null ? null : reservePct * total;
  const room = Math.max(0, freeCash - (reserve ?? 0));
  const chosen = cashPicks(picks, room, today);
  const picksTheta = chosen.reduce((s, c) => s + c.thetaPerDay, 0);
  const projected = current + uncoveredTheta + picksTheta;

  return {
    goal,
    current,
    gap: Math.max(0, goal - current),
    uncovered,
    uncoveredTheta,
    freeCash,
    reserve,
    room,
    picks: chosen,
    picksCollateral: chosen.reduce((s, c) => s + c.collateral, 0),
    picksTheta,
    projected,
    reachesGoal: projected >= goal,
  };
}
