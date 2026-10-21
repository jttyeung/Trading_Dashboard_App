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
/** A taxable holding with a gain is written a third of its lots at a time (rounded up),
 *  per the account holder: calls on those shares, but never all at once. */
export const KEEP_BATCH_FRACTION = 1 / 3;
/** Sheltered accounts: a call-away there realizes no tax. Matched on the label. */
export const SHELTERED = /\b(IRA|HSA|401\s?k?|Roth)\b/i;

export interface UncoveredLot {
  accountId: string;
  accountLabel: string;
  symbol: string;
  /** "keep": a taxable holding with a gain — far-OTM calls, a batch at a time, so a
   *  call-away is unlikely and never takes the whole position. "near": the ~30Δ ladder. */
  mode: "near" | "keep";
  lotsOpen: number; // whole 100-share lots with no short call against them
  contracts: number; // how many to write now: all of them, or a batch for "keep"
  /** The rung that earns the most per day and expires before the next earnings report;
   *  null when every rung spans it (see waitUntil). */
  call: CoveredCallQuote | null;
  /** The earnings date blocking every rung — write after it. Null when a rung was found. */
  waitUntil: string | null;
  /** Premium per day if sold today: mark × 100 × contracts ÷ DTE. An average decay, so
   *  an estimate — real theta runs lower early in the life and higher near expiry. */
  estThetaPerDay: number;
  /** Gain (negative = loss) if called away at that strike, for a taxable account; null
   *  in a sheltered one, without a call, or when cost basis is unknown. */
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

/** True when a report on `earnings` lands on or before the rung's expiration. A rung
 *  stored before expirations were recorded can't be checked and passes. */
export function spansEarnings(c: CoveredCallQuote, earnings: string | undefined): boolean {
  return Boolean(earnings && c.expiration && earnings <= c.expiration);
}

/** Lots with no call against them, per account. A short call on a symbol covers 100
 *  shares per contract; an already-expired contract (a weekend snapshot still lists
 *  Friday's) no longer covers anything. A taxable holding with a gain is valued with its
 *  far-OTM rungs and a partial batch; everything else with the ~30Δ ladder. Either way a
 *  rung that spans the next earnings report is skipped. */
export function uncoveredLots(inputs: AccountInput[], earnings: Record<string, string> = {}, today?: string): UncoveredLot[] {
  const out: UncoveredLot[] = [];
  for (const { account, data } of inputs) {
    const covered = new Map<string, number>();
    for (const o of data.options) {
      if (o.optionType !== "call" || o.side !== "short") continue;
      if (daysToExpiry(o.expiration, today) < 0) continue;
      const sym = o.symbol.toUpperCase();
      covered.set(sym, (covered.get(sym) ?? 0) + o.qty);
    }
    const sheltered = SHELTERED.test(label(account));
    for (const e of data.equities) {
      const lotsOpen = Math.floor(e.qty / 100) - (covered.get(e.symbol.toUpperCase()) ?? 0);
      if (lotsOpen <= 0) continue;
      const keep = !sheltered && e.avgCost > 0 && e.price > e.avgCost;
      const all = (keep ? e.farCalls : e.coveredCalls) ?? [];
      const rungs = all.filter((c) => c.dte > 0 && c.mark > 0);
      if (rungs.length === 0) continue; // nothing quoted (a far rung list fills in at the next open)
      const report = earnings[e.symbol.toUpperCase()];
      const clear = rungs.filter((c) => !spansEarnings(c, report));
      const contracts = keep ? Math.ceil(lotsOpen * KEEP_BATCH_FRACTION) : lotsOpen;
      const base = { accountId: account.id, accountLabel: label(account), symbol: e.symbol, mode: keep ? "keep" : "near", lotsOpen, contracts } as const;
      if (clear.length === 0) {
        out.push({ ...base, call: null, waitUntil: report ?? null, estThetaPerDay: 0, callAwayGain: null });
        continue;
      }
      const call = clear.reduce((best, c) => (c.mark / c.dte > best.mark / best.dte ? c : best));
      const estThetaPerDay = (call.mark * 100 * contracts) / call.dte;
      if (estThetaPerDay < MIN_LOT_THETA) continue;
      out.push({
        ...base,
        call,
        waitUntil: null,
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
  /** Next earnings date per ticker (data/earnings.json). */
  earnings?: Record<string, string>;
  /** The VIX regime's cash target as a share of the whole portfolio; null when unknown. */
  reservePct: number | null;
  /** ISO date; defaults to today (ET) — only a test needs to pin it. */
  today?: string;
}): ThetaGoalPlan {
  const { goal, current, inputs, picks, earnings, reservePct, today } = args;
  const uncovered = uncoveredLots(inputs, earnings, today);
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
