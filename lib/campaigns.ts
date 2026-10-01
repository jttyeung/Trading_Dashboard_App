// Wheel campaigns: one ticker's run from the first short put (or the first covered
// call on shares already held) to the exit — put closed/expired with no shares,
// shares called away, or shares sold. Built in the app from the closed-trade files
// plus the open positions; nothing new comes from the bridge.
//
// Accounting, so nothing counts twice. The bridge folds an assigned put's premium
// into the shares' cost (and a called-away call's premium into the sale proceeds)
// and books those option legs at $0. Campaigns undo that: every option leg counts
// its own cash (credit − buy-back), and shares count at RAW prices — in at the
// assignment strike, out at the called-away strike or the sale fill. So
//   net P/L      = premium − cost to close the open legs + share P/L
//   adjusted basis = raw share cost − premium ÷ shares held
import type { ClosedCSP, ClosedCoveredCall, ClosedStock, Equity, OptionPosition } from "./types";
import { daysBetween, daysToExpiry } from "./calc";

const MULT = 100;
/** A ticker that goes flat and sells a new put within this many days continues the same campaign. */
export const CAMPAIGN_GAP_DAYS = 10;
/** The close-at-50% rule from the wheel study. */
export const CLOSE_AT = 0.5;

export type CampaignStage =
  | "puts" // selling puts, no shares yet
  | "shares" // holding shares, no call open
  | "calls" // holding shares, call open
  | "called-away" // closed: shares called away
  | "put-only" // closed: puts closed/expired, never assigned
  | "shares-sold"; // closed: shares sold (or gone from the account)

export interface CampaignLeg {
  id: string;
  optionType: "put" | "call";
  strike: number;
  expiration: string;
  contracts: number;
  openedAt: string;
  closedAt: string | null; // null = open
  credit: number; // $ received at open
  debit: number; // $ paid to close (0 if expired/assigned/open)
  mark: number | null; // open legs: current mark per share
  outcome: "open" | "expired" | "closed" | "assigned";
}

export interface ShareEvent {
  date: string;
  kind: "assigned" | "called-away" | "sold" | "held"; // held = shares already owned when a call was first written
  shares: number;
  price: number; // per share, raw
  estimated?: boolean; // the cost of shares owned before the history reaches is a guess
}

export interface Campaign {
  id: string; // `${symbol}-${start}`
  symbol: string;
  start: string;
  end: string | null; // null = active
  stage: CampaignStage;
  active: boolean;
  days: number;
  legs: CampaignLeg[];
  shareEvents: ShareEvent[];
  price: number | null; // underlying now
  premium: number; // Σ credit − debit over every leg (open legs: credit)
  openCost: number; // $ to buy back the open short legs now
  sharePnl: number; // realized + unrealized share P/L at raw prices
  shareRealized: number;
  shareUnrealized: number;
  netPnl: number;
  sharesHeld: number;
  shareCostPerShare: number | null; // raw average cost of the shares held
  adjustedBasis: number | null; // shareCostPerShare − premium ÷ sharesHeld
  ifAssignedBasis: number | null; // puts stage: open put strike − premium per assignable share
  capital: number; // peak cash tied up (put collateral + share cost) — what returns are measured on
  capitalNow: number; // cash tied up today
  returnPct: number; // netPnl ÷ capital
  annualized: number;
  openPut: CampaignLeg | null; // the nearest open put (first of openPuts)
  openCall: CampaignLeg | null; // the lowest-strike open call (first of openCalls)
  openPuts: CampaignLeg[];
  openCalls: CampaignLeg[];
  calledAway: { strikes: string; expiration: string; pnl: number; days: number } | null; // if every open call is assigned
  needsAction: string[]; // flags, never gates
  estimatedBasis: boolean;
}

interface Inputs {
  closedCsps: ClosedCSP[];
  closedCovered: ClosedCoveredCall[];
  closedStocks: ClosedStock[];
  options: OptionPosition[]; // open positions of the selected account
  equities: Equity[];
  today?: string;
}

type Ev =
  | { date: string; order: number; t: "open"; leg: CampaignLeg }
  | { date: string; order: number; t: "close"; leg: CampaignLeg }
  | { date: string; order: number; t: "sale"; shares: number; price: number; openPrice: number };

const up = (s: string) => s.toUpperCase();
const day = (s: string) => s.slice(0, 10);

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function closedLeg(r: ClosedCSP | ClosedCoveredCall, optionType: "put" | "call"): CampaignLeg {
  return {
    id: r.id,
    optionType,
    strike: r.strike,
    expiration: r.expiration,
    contracts: r.contracts,
    openedAt: day(r.openedAt),
    closedAt: day(r.closedAt),
    credit: r.creditReceived,
    debit: r.outcome === "assigned" || r.outcome === "expired" ? 0 : r.costToClose,
    mark: null,
    outcome: r.outcome === "assigned" ? "assigned" : r.outcome === "expired" ? "expired" : "closed",
  };
}

function openLeg(o: OptionPosition, today: string): CampaignLeg {
  return {
    id: o.id,
    optionType: o.optionType,
    strike: o.strike,
    expiration: o.expiration,
    contracts: o.qty,
    openedAt: day(o.openedAt ?? today),
    closedAt: null,
    credit: o.entryPerShare * MULT * o.qty,
    debit: 0,
    mark: o.mark,
    outcome: "open",
  };
}

/** Build every campaign for the given account data, newest first. */
export function buildCampaigns(input: Inputs): Campaign[] {
  const today = input.today ?? todayISO();
  const bySym = new Map<string, Ev[]>();
  const push = (sym: string, e: Ev) => {
    const k = up(sym);
    if (!bySym.has(k)) bySym.set(k, []);
    bySym.get(k)!.push(e);
  };

  for (const r of input.closedCsps) {
    const leg = closedLeg(r, "put");
    push(r.symbol, { date: leg.openedAt, order: 0, t: "open", leg });
    push(r.symbol, { date: leg.closedAt!, order: 1, t: "close", leg });
  }
  const calledAwayDates = new Map<string, string[]>();
  for (const r of input.closedCovered) {
    const leg = closedLeg(r, "call");
    push(r.symbol, { date: leg.openedAt, order: 0, t: "open", leg });
    push(r.symbol, { date: leg.closedAt!, order: 1, t: "close", leg });
    if (r.outcome === "assigned") {
      const k = up(r.symbol);
      calledAwayDates.set(k, [...(calledAwayDates.get(k) ?? []), day(r.closedAt)]);
    }
  }
  for (const o of input.options) {
    if (o.side !== "short") continue;
    if (o.kind !== "csp" && o.kind !== "covered-call") continue;
    const leg = openLeg(o, today);
    push(o.symbol, { date: leg.openedAt, order: 0, t: "open", leg });
  }
  // Only symbols that carry a wheel leg get campaigns; stock sales join them.
  for (const s of input.closedStocks) {
    const k = up(s.symbol);
    if (!bySym.has(k) || s.side !== "long") continue;
    // A called-away sale is already the call's assignment — don't take the shares out twice.
    const sold = day(s.closedAt);
    const near = (calledAwayDates.get(k) ?? []).some((d) => Math.max(daysBetween(d, sold), daysBetween(sold, d)) <= 3);
    if (near) continue;
    push(s.symbol, { date: day(s.closedAt), order: 2, t: "sale", shares: s.shares, price: s.avgClose, openPrice: s.avgOpen });
  }

  const equityBySym = new Map(input.equities.map((e) => [up(e.symbol), e] as const));
  const out: Campaign[] = [];

  for (const [sym, evs] of bySym) {
    evs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
    const equity = equityBySym.get(sym);
    const underlying =
      equity?.price ?? input.options.find((o) => up(o.symbol) === sym && o.underlyingPrice)?.underlyingPrice ?? null;

    // Shares written against before the history saw them arrive ("held") have no fill
    // of their own. First pass prices them at Schwab's average cost; when the campaign
    // still holds shares, that average is for the WHOLE holding (assigned lots
    // included), so solve for the one held-share price that makes today's raw cost
    // match it. Cost is linear in that price, so two probe runs give it exactly.
    const first = simulate(sym, evs, equity, underlying, today, input.closedStocks, null);
    const last = first[first.length - 1];
    let result = first;
    if (last && last.active && last.sharesHeld > 0 && equity && equity.avgCost > 0 && last.shareEvents.some((s) => s.kind === "held")) {
      const cost = (p: number) => {
        const c = simulate(sym, evs, equity, underlying, today, input.closedStocks, { from: last.start, price: p });
        const l = c[c.length - 1];
        return l && l.shareCostPerShare != null ? l.shareCostPerShare * l.sharesHeld : 0;
      };
      const f0 = cost(0);
      const f1 = cost(1);
      const p = f1 - f0 > 0 ? (equity.avgCost * last.sharesHeld - f0) / (f1 - f0) : NaN;
      if (Number.isFinite(p) && p > 0) result = simulate(sym, evs, equity, underlying, today, input.closedStocks, { from: last.start, price: p });
    }
    out.push(...result);
  }

  return out.sort((a, b) => (a.active !== b.active ? (a.active ? -1 : 1) : (b.end ?? b.start).localeCompare(a.end ?? a.start)));
}

/** One symbol's campaigns from its sorted events. `heldPx` overrides the price of shares
 *  already held when a call was written, for campaigns starting on/after `heldPx.from`. */
function simulate(
  sym: string,
  evs: Ev[],
  equity: Equity | undefined,
  underlying: number | null,
  today: string,
  closedStocks: ClosedStock[],
  heldPx: { from: string; price: number } | null,
): Campaign[] {
  const out: Campaign[] = [];
  {
    // The campaign being built and the date it went flat (no legs, no shares), if it has.
    const st: { cur: Draft | null; flatSince: string | null } = { cur: null, flatSince: null };
    const finalize = () => {
      if (st.cur) out.push(finish(st.cur, sym, st.flatSince, underlying, today));
      st.cur = null;
      st.flatSince = null;
    };

    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.t === "open") {
        if (st.cur && st.flatSince && daysBetween(st.flatSince, e.date) > CAMPAIGN_GAP_DAYS) finalize();
        const d: Draft = st.cur ?? newDraft(e.date);
        st.cur = d;
        st.flatSince = null;
        d.legs.push(e.leg);
        d.openLegs.add(e.leg);
        if (e.leg.optionType === "call") {
          // A call written on shares the history never saw come in: they were held already.
          let covered = 0;
          for (const l of d.openLegs) if (l.optionType === "call") covered += l.contracts * MULT;
          const need = covered - d.shares;
          if (need > 0) {
            const solved = heldPx && d.start >= heldPx.from ? heldPx.price : null;
            const cost = solved ?? equity?.avgCost ?? closedStocks.find((s) => up(s.symbol) === sym && day(s.closedAt) >= e.date)?.avgOpen;
            const price = cost != null && cost >= 0 ? cost : e.leg.strike;
            const guessed = solved == null && !(cost != null && cost > 0);
            d.shares += need;
            d.shareCost += need * price;
            d.shareEvents.push({ date: e.date, kind: "held", shares: need, price, estimated: guessed });
            if (guessed) d.estimated = true;
          }
        }
      } else if (st.cur) {
        const d: Draft = st.cur;
        if (e.t === "close") {
          d.openLegs.delete(e.leg);
          if (e.leg.outcome === "assigned") {
            const n = e.leg.contracts * MULT;
            if (e.leg.optionType === "put") {
              d.shares += n;
              d.shareCost += n * e.leg.strike;
              d.shareEvents.push({ date: e.date, kind: "assigned", shares: n, price: e.leg.strike });
            } else {
              const q = Math.min(n, d.shares);
              sellShares(d, q, e.leg.strike);
              d.shareEvents.push({ date: e.date, kind: "called-away", shares: q, price: e.leg.strike });
            }
          }
        } else if (d.shares > 0) {
          const q = Math.min(e.shares, d.shares);
          sellShares(d, q, e.price);
          d.shareEvents.push({ date: e.date, kind: "sold", shares: q, price: e.price });
        }
      }
      // Settle once per day, after all of its events: a same-day roll opens the new put
      // before the old one closes, and both must not count as collateral at once.
      if (st.cur && evs[i + 1]?.date !== e.date) {
        const d: Draft = st.cur;
        d.capital = Math.max(d.capital, collateral(d) + d.shareCost);
        if (d.openLegs.size === 0 && d.shares <= 0) st.flatSince = st.flatSince ?? e.date;
        else st.flatSince = null;
      }
    }
    if (st.cur) {
      // Shares the history says are held but the account no longer has: gone without a record.
      const d: Draft = st.cur;
      const held = equity?.qty ?? 0;
      if (d.shares > held) {
        const q = d.shares - held;
        const px = underlying ?? d.shareCost / d.shares;
        sellShares(d, q, px);
        d.shareEvents.push({ date: today, kind: "sold", shares: q, price: px, estimated: true });
        d.estimated = true;
        if (d.openLegs.size === 0 && d.shares <= 0) st.flatSince = st.flatSince ?? today;
      } else if (d.shares > 0 && held > d.shares) {
        // The wheel holds shares and the account has more of them than the history
        // explains (bought outright, never written against): they're part of the holding.
        const q = held - d.shares;
        const solved = heldPx && d.start >= heldPx.from ? heldPx.price : null;
        const price = solved ?? equity!.avgCost;
        const date = evs[evs.length - 1]?.date ?? today;
        d.shares += q;
        d.shareCost += q * price;
        d.shareEvents.push({ date, kind: "held", shares: q, price });
      }
      finalize();
    }
  }
  return out;
}

interface Draft {
  start: string;
  legs: CampaignLeg[];
  openLegs: Set<CampaignLeg>;
  shareEvents: ShareEvent[];
  shares: number;
  shareCost: number; // raw $ cost of the shares held
  shareRealized: number;
  capital: number;
  estimated: boolean;
}

function newDraft(start: string): Draft {
  return { start, legs: [], openLegs: new Set(), shareEvents: [], shares: 0, shareCost: 0, shareRealized: 0, capital: 0, estimated: false };
}

function sellShares(d: Draft, q: number, price: number) {
  if (q <= 0 || d.shares <= 0) return;
  const avg = d.shareCost / d.shares;
  d.shareRealized += (price - avg) * q;
  d.shareCost -= avg * q;
  d.shares -= q;
  if (d.shares <= 0) {
    d.shares = 0;
    d.shareCost = 0;
  }
}

function collateral(d: Draft): number {
  let c = 0;
  for (const l of d.openLegs) if (l.optionType === "put") c += l.strike * MULT * l.contracts;
  return c;
}

function finish(d: Draft, symbol: string, flatSince: string | null, price: number | null, today: string): Campaign {
  const open = [...d.openLegs];
  const active = open.length > 0 || d.shares > 0;
  const end = active ? null : flatSince ?? d.legs.reduce((m, l) => (l.closedAt && l.closedAt > m ? l.closedAt : m), d.start);
  const premium = d.legs.reduce((s, l) => s + l.credit - l.debit, 0);
  const openCost = open.reduce((s, l) => s + (l.mark ?? 0) * MULT * l.contracts, 0);
  const shareCostPerShare = d.shares > 0 ? d.shareCost / d.shares : null;
  const shareUnrealized = d.shares > 0 && price != null ? (price - shareCostPerShare!) * d.shares : 0;
  const sharePnl = d.shareRealized + shareUnrealized;
  const netPnl = premium - openCost + sharePnl;
  const openPut = open.filter((l) => l.optionType === "put").sort((a, b) => a.expiration.localeCompare(b.expiration))[0] ?? null;
  const openCall = open.filter((l) => l.optionType === "call").sort((a, b) => a.strike - b.strike)[0] ?? null;
  const adjustedBasis = d.shares > 0 ? shareCostPerShare! - premium / d.shares : null;
  const putShares = open.filter((l) => l.optionType === "put").reduce((s, l) => s + l.contracts * MULT, 0);
  const ifAssignedBasis = d.shares === 0 && openPut && putShares > 0 ? openPut.strike - premium / putShares : null;
  const days = Math.max(1, daysBetween(d.start, end ?? today));
  const capital = d.capital || 1;
  const returnPct = netPnl / capital;

  const ever = (k: ShareEvent["kind"]) => d.shareEvents.some((s) => s.kind === k);
  const stage: CampaignStage = active
    ? d.shares > 0
      ? openCall
        ? "calls"
        : "shares"
      : "puts"
    : ever("called-away")
      ? "called-away"
      : ever("sold") || ever("assigned") || ever("held")
        ? "shares-sold"
        : "put-only";

  // Every open call assigned at its strike (lowest strikes take the shares first);
  // shares no call covers stay at today's price.
  const openCalls = open.filter((l) => l.optionType === "call").sort((a, b) => a.strike - b.strike);
  const openPuts = open.filter((l) => l.optionType === "put").sort((a, b) => a.expiration.localeCompare(b.expiration));
  let calledAway: Campaign["calledAway"] = null;
  if (openCalls.length && d.shares > 0 && shareCostPerShare != null) {
    let left = d.shares;
    let pnl = premium + d.shareRealized;
    for (const l of openCalls) {
      const q = Math.min(left, l.contracts * MULT);
      pnl += (l.strike - shareCostPerShare) * q;
      left -= q;
    }
    if (price != null) pnl += (price - shareCostPerShare) * left;
    const expiration = openCalls.reduce((m, l) => (l.expiration > m ? l.expiration : m), openCalls[0].expiration);
    const strikes = [...new Set(openCalls.map((l) => `$${l.strike}`))].join(" / ");
    calledAway = { strikes, expiration, pnl, days: Math.max(1, daysBetween(d.start, expiration)) };
  }

  const needsAction: string[] = [];
  if (stage === "shares") needsAction.push("No call open on the shares");
  if (adjustedBasis != null && price != null && price < adjustedBasis) needsAction.push("Below adjusted basis");
  if (adjustedBasis != null && openCalls.some((l) => l.strike < adjustedBasis)) needsAction.push("Call strike under adjusted basis");
  // Close-at-50% is a PUT rule (the wheel study's exit_mode 1). Covered calls are only
  // written where expiring or being called away is fine, so they run to expiration.
  for (const l of openPuts) {
    const cap = legCaptured(l);
    if (cap >= CLOSE_AT) needsAction.push(`Put $${l.strike} ${Math.round(cap * 100)}% captured — close`);
  }
  // Cash committed right now: open put collateral + the shares' raw cost.
  const capitalNow = collateral(d) + (d.shares > 0 ? d.shareCost : 0);

  return {
    id: `${symbol}-${d.start}`,
    symbol,
    start: d.start,
    end,
    stage,
    active,
    days,
    legs: [...d.legs].sort((a, b) => (b.closedAt ?? "9999").localeCompare(a.closedAt ?? "9999") || b.openedAt.localeCompare(a.openedAt)),
    shareEvents: d.shareEvents,
    price,
    premium,
    openCost,
    sharePnl,
    shareRealized: d.shareRealized,
    shareUnrealized,
    netPnl,
    sharesHeld: d.shares,
    shareCostPerShare,
    adjustedBasis,
    ifAssignedBasis,
    capital: d.capital,
    capitalNow,
    openPuts,
    openCalls,
    returnPct,
    annualized: (returnPct * 365) / days,
    openPut,
    openCall,
    calledAway,
    needsAction,
    estimatedBasis: d.estimated,
  };
}

/** Share of an open short leg's credit already captured (0..1). */
export function legCaptured(l: CampaignLeg): number {
  if (l.mark == null || l.credit <= 0) return 0;
  return 1 - (l.mark * MULT * l.contracts) / l.credit;
}

/** Days left on an open leg. */
export function legDte(l: CampaignLeg): number {
  return daysToExpiry(l.expiration);
}

export const STAGE_LABEL: Record<CampaignStage, string> = {
  puts: "Selling puts",
  shares: "Shares · no call",
  calls: "Shares · selling calls",
  "called-away": "Called away",
  "put-only": "Put closed",
  "shares-sold": "Shares sold",
};

export const STAGE_CHIP: Record<CampaignStage, string> = {
  puts: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  shares: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  calls: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  "called-away": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  "put-only": "bg-surface-2 text-muted ring-border",
  "shares-sold": "bg-surface-2 text-muted ring-border",
};

/** 0 Puts · 1 Assigned · 2 Calls · 3 Exit — how far along the wheel this campaign got. */
export function stageStep(c: Campaign): number {
  if (!c.active) return 3;
  if (c.stage === "calls") return 2;
  if (c.stage === "shares") return 1;
  return 0;
}
