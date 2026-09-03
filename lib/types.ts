// Domain models for the portfolio app.
// Data is loaded from data/*.json (written by the data bridge) at runtime, with a
// built-in example dataset as a fallback. The shapes below are the contract the UI
// relies on, independent of where the data comes from.

export interface Account {
  id: string; // opaque, one-way-hash-derived id (schwab.MaskAccountNumber) — never a real digit of the account number
  mask: string; // last 4 chars of a hash-derived id, e.g. "••••9c1d" — not real account digits
  type: string; // "margin" | "cash"
  brokerageType: string; // "individual"
  nickname?: string;
  isDefault: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  equityValue: number;
  optionsValue: number;
  cryptoValue: number;
  cash: number;
  buyingPower: number;
  optionsBuyingPower?: number; // Schwab options buying power (deployable, net of collateral)
}

export interface Equity {
  symbol: string;
  name: string;
  qty: number;
  avgCost: number; // average cost per share
  price: number; // latest close per share
  dayChange?: number | null; // per-share $ move today (vs prior close), for Top Movers
  coveredCalls?: CoveredCallQuote[]; // ~30Δ call premiums at 1–4 week tenors (holdings ≥100 sh)
  bbSigma?: number | null; // current price's σ from its 20-day mean (−2 = lower band)
  gamma?: GammaWalls | null; // naive dealer-gamma walls from option OI (holdings ≥100 sh)
  priceHistory?: number[] | null; // last ~7 daily closes (oldest→newest), for the expanded mini chart
}

// Naive dealer-gamma walls from option open interest — same shape the Brief uses.
export interface GammaWalls {
  flip: number | null; // zero-gamma flip strike
  callWall: number | null; // highest call-OI strike (resistance)
  putWall: number | null; // highest put-OI strike (support)
  net: "pos" | "neg"; // net dealer gamma sign
}

// One ~30-delta covered-call quote at a target tenor, written by the bridge for held
// stock of ≥100 shares. Premiums refresh on a short cache during market hours.
export interface CoveredCallQuote {
  targetDte: number; // requested tenor (14 | 21 | 30)
  dte: number; // actual days to the chosen expiration
  strike: number;
  delta: number;
  mark: number; // premium per share to sell the call
  premPct: number; // mark ÷ spot, %
  annPct: number | null; // premPct annualized (×365/dte)
  oi: number;
  bbSigma?: number | null; // this call strike's σ from the underlying's 20-day mean
}

export interface CryptoHolding {
  symbol: string; // e.g. "BTC"
  name: string; // e.g. "Bitcoin"
  qty: number;
  avgCost?: number; // average cost per unit (optional — connector may not supply)
  price: number; // latest price per unit
}

// Extended to carry every category the Schwab bridge (export_to_app.py)
// classifies. The original three (csp / leap-call / leap-put-hedge) still drive
// the CSP and LEAPS tabs; the rest flow through the data so nothing is dropped
// and get their own surfaces incrementally.
export type OptionKind =
  | "leap-call"
  | "leap-put-hedge"
  | "csp"
  | "covered-call"
  | "put-spread"
  | "call-spread"
  | "other";

export interface OptionPosition {
  id: string;
  kind: OptionKind;
  symbol: string;
  optionType: "call" | "put";
  side: "long" | "short";
  qty: number;
  strike: number;
  expiration: string; // ISO yyyy-mm-dd
  entryPerShare: number; // premium per share at entry (cost basis); positive magnitude
  mark: number; // current mark per share
  delta: number;
  gamma?: number | null; // dΔ/dS (long-option convention), for the Simulate projection
  vega?: number | null; // dV/dσ per vol-point (long-option convention), for the Simulate IV-shift term
  theta: number;
  iv: number; // implied volatility (decimal, e.g. 0.61)
  breakeven: number;
  underlyingPrice?: number; // current price of the underlying (for "to strike")
  underlyingChange?: number | null; // underlying per-share $ move today (Top Movers)
  underlyingClose?: number | null; // regular-session close — Simulate reference price
  underlyingLive?: number | null; // current/after-hours last — Simulate target price
  dayValueChange?: number | null; // this leg's signed $ value move today (Top Movers)
  bbSigma?: number | null; // strike's σ from the underlying's 20-day mean (−2 = lower BB)
  chanceOfProfitShort?: number; // 0..1, for short positions
  openedAt?: string; // ISO date the position was opened (held positions only)
  erDate?: string | null; // next earnings date (ISO) for the underlying, if known
}

export interface ValuePoint {
  label: string;
  value: number;
}

export interface ResearchIdea {
  symbol: string;
  name: string;
  strategy: "csp" | "leap";
  thesis: string;
  signal: string; // short tag, e.g. "IV rank 62%"
  watch: boolean;
}

// ---- CSP screener model ----------------------------------------------------
/**
 * A screened cash-secured-put candidate. Raw inputs only — the composite score
 * is computed at render time by lib/csp-model.ts so the breakdown is always
 * visible. Fields the data bridge can't supply (IV Rank, technicals,
 * event calendar) are nullable and the score renormalizes over what's present.
 */
export interface CSPCandidate {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  underlyingPrice: number;
  strike: number;
  expiration: string; // ISO yyyy-mm-dd
  dte: number;
  bid: number;
  ask: number;
  mark: number; // per share
  delta: number; // assignment proxy, magnitude (e.g. 0.21)
  theta: number;
  iv: number; // decimal (absolute IV)
  openInterest: number;
  volume: number;
  chanceOfProfitShort: number; // 0..1
  fundamentals: {
    largeCap: boolean | null;
    sp500: boolean | null;
    profitable: boolean | null;
  };
  ivRank: number | null; // 0..100; null = no historical-IV feed
  technical: {
    aboveSma50: boolean | null;
    rsi: number | null;
    strikeBelowSupport: boolean | null;
  };
  flags: {
    earningsBeforeExp: boolean | null; // null = unverified (no earnings feed)
    exDivBeforeExp: boolean | null;
  };
  washSaleWarning: string | null; // RULE-014 heuristic, not tax advice — see the message itself for the specific prior loss
  source?: "holding" | "discovered"; // how the name entered the screen
  instrumentId?: string;
}

export interface CSPCandidatesFile {
  meta: {
    generatedAt: string;
    pricesAsOf: string;
    dteBasis: string; // human note, e.g. "as of 2026-06-15"
    universe: string;
    note?: string;
  };
  candidates: CSPCandidate[];
}

export type BotStatus = "pending_approval" | "approved" | "rejected";
export type BotOutcome = "WIN" | "ASSIGNED";
// Grade compares a DECIDED trade (approved/rejected) against its
// resolved outcome — see OptionsEvaluator's internal/export/paperbot.go
// gradeDecision for the full mapping. Empty/undefined means ungraded:
// either never decided, or decided but not yet resolved.
export type BotGrade = "good_call" | "risk_realized" | "missed_win" | "good_pass";

// One row of the /bot or /bot-20-delta-safe paper-trading review table —
// a frozen snapshot of a real suggestion-engine candidate (same scoring,
// same rationale as the live digest), plus whatever approval/outcome
// state has accumulated since. status/personallySelected are writable
// from the dashboard itself via lib/paperbot-api.ts (a live call into
// OptionsEvaluator's own localhost API) — the one place this app's
// frontend writes anything back, rather than only reading exported JSON.
export interface BotTrade {
  id: number;
  ticker: string;
  strategy: string; // CSP / CSP_SAFE
  contractSymbol: string;
  strike: number;
  expiration: string;
  dteAtPost: number;
  delta: number;
  ivPercent: number;
  premium: number; // per share
  premiumTotal: number; // per contract (×100)
  breakeven: number;
  rorPct: number;
  annualizedRorPct: number;
  score: number;
  rationale: string;
  stockPriceAtPost: number;
  postedAt: string;
  status: BotStatus;
  decidedAt?: string;
  outcome?: BotOutcome;
  stockPriceAtClose?: number;
  realizedPnl?: number;
  returnPct?: number;
  currentPrice?: number;
  itmOtm?: "ITM" | "OTM";
  personallySelected: boolean;
  grade?: BotGrade;
}

// The account holder's own approve/reject track record — a mirror for
// THEIR judgment, distinct from the bot's own future self-performance
// scorecard (not built yet — the account holder's own stated "eventually"
// ask, deliberately deferred).
export interface MyGradeSummary {
  goodCalls: number; // approved, and it won
  riskRealized: number; // approved, and it got assigned
  missedWins: number; // rejected, but it would have won
  goodPasses: number; // rejected, and it would have been assigned
  ungraded: number; // pending, or decided but not yet resolved
}

export interface BotSnapshot {
  generatedAt: string;
  bot: string;
  trades: BotTrade[];
  myGrade: MyGradeSummary;
}

// A closed cash-secured-put round-trip (reconstructed from option order history).
export interface ClosedCSP {
  id: string;
  symbol: string;
  name: string;
  strike: number;
  expiration: string;
  openedAt: string;
  closedAt: string;
  contracts: number;
  creditPerShare: number;
  creditReceived: number; // $ credit at open
  costToClose: number; // $ debit to buy-to-close (0 if expired)
  realizedPnl: number; // $
  outcome: "closed_profit" | "closed_loss" | "expired" | "assigned";
  daysHeld: number;
  collateral: number;
  returnOnCollateral: number; // decimal
  annualized: number; // decimal
  washSaleWarning: string | null;
  accountId: string; // matches Account.id in snapshot.json
}

export interface ClosedCSPFile {
  meta: { generatedAt: string; source: string; note?: string };
  closed: ClosedCSP[];
}

// A closed long-LEAP round-trip (reconstructed from option order history).
export interface ClosedLeap {
  id: string;
  symbol: string;
  name: string;
  optionType: "call" | "put";
  strike: number;
  expiration: string;
  openedAt: string;
  closedAt: string;
  contracts: number;
  entryPerShare: number; // debit paid per share at open
  costBasis: number; // $ paid at open
  proceeds: number; // $ received at close (0 if expired worthless)
  realizedPnl: number; // proceeds − costBasis
  outcome: "closed_profit" | "closed_loss" | "expired";
  daysHeld: number;
  returnPct: number; // realizedPnl ÷ costBasis (decimal)
  annualized: number; // decimal
  washSaleWarning: string | null;
  accountId: string; // matches Account.id in snapshot.json
}

export interface ClosedLeapFile {
  meta: { generatedAt: string; source: string; note?: string };
  closed: ClosedLeap[];
}

// A closed covered-call round-trip (short call written against stock).
export interface ClosedCoveredCall {
  id: string;
  symbol: string;
  name: string;
  strike: number;
  expiration: string;
  openedAt: string;
  closedAt: string;
  contracts: number;
  creditPerShare: number;
  creditReceived: number; // $ collected at open
  costToClose: number; // $ to buy-to-close (0 if expired)
  realizedPnl: number;
  outcome: "closed_profit" | "closed_loss" | "expired";
  daysHeld: number;
  returnOnNotional: number; // realizedPnl ÷ (strike × 100 × contracts), decimal
  annualized: number; // decimal
  washSaleWarning: string | null;
  accountId: string; // matches Account.id in snapshot.json
}

export interface ClosedCoveredFile {
  meta: { generatedAt: string; source: string; note?: string };
  closed: ClosedCoveredCall[];
}

// A closed vertical-spread round-trip (short + long leg, same expiration).
export interface ClosedSpread {
  id: string;
  symbol: string;
  name: string;
  optionType: "call" | "put";
  shortStrike: number;
  longStrike: number;
  width: number;
  expiration: string;
  openedAt: string;
  closedAt: string;
  contracts: number;
  isCredit: boolean;
  netCreditPerShare: number; // signed per share: + credit, − debit
  netOpen: number; // $ net received(+)/paid(−) at open
  netClose: number; // $ net to close (signed)
  realizedPnl: number;
  maxRisk: number; // defined risk in $
  outcome: "closed_profit" | "closed_loss" | "expired";
  daysHeld: number;
  returnOnRisk: number; // realizedPnl ÷ maxRisk, decimal
  annualized: number; // decimal
}

export interface ClosedSpreadFile {
  meta: { generatedAt: string; source: string; note?: string };
  closed: ClosedSpread[];
}

// A closed stock round-trip (FIFO buys→sells, or short cover).
export interface ClosedStock {
  id: string;
  symbol: string;
  name: string;
  side: "long" | "short";
  shares: number;
  avgOpen: number; // avg fill at the opening side
  avgClose: number; // avg fill at the closing side
  costBasis: number; // $ at open
  proceeds: number; // $ at close
  realizedPnl: number;
  outcome: "closed_profit" | "closed_loss";
  openedAt: string;
  closedAt: string;
  daysHeld: number;
  returnPct: number; // realizedPnl ÷ costBasis (decimal)
  annualized: number; // decimal
  accountId?: string; // matches Account.id — absent for Schwab's manual-entry stock sales, which aren't attributed to one account
}

export interface ClosedStockFile {
  meta: { generatedAt: string; source: string; note?: string };
  closed: ClosedStock[];
}

export interface SnapshotMeta {
  generatedAt: string; // ISO timestamp the data was pulled
  pricesAsOf: string; // human label, e.g. "2026-06-12 close"
  source: string; // "schwab-bridge" | "seed"
  coveredCallsNextAt?: string | null; // ISO — when the covered-call ladders next refresh; null off-hours
}

/** Per-account market data. */
export interface AccountData {
  summary: PortfolioSummary;
  equities: Equity[];
  options: OptionPosition[];
  valueHistory: ValuePoint[];
  /**
   * Per-coin crypto holdings. Optional: the data bridge exposes no
   * crypto-positions read tool, so this is absent unless seeded by hand. When
   * absent, the UI falls back to summary.cryptoValue (aggregate only).
   */
  crypto?: CryptoHolding[];
}

/**
 * The live, refreshable market data the UI renders. Produced by the data bridge
 * and written to data/snapshot.json.
 *
 * `data` is keyed by account id (see `accounts[].id`).
 */
export interface Snapshot {
  meta: SnapshotMeta;
  accounts: Account[];
  data: Record<string, AccountData>;
}

// ---------------------------------------------------------------------------
// Single-leg candidates (LEAPS / CC / LONG_PUT / BEAR_MKT_PUT) — the raw
// qualifying universe, same design as CSPCandidate above, from
// data/single-leg-candidates.json. Note rorPercent/annualizedRorPercent mean
// "cost as % of buying the stock outright" for LEAPS/LONG_PUT (long,
// bought positions) — NOT a yield the way CSPCandidate's numbers are.
// ---------------------------------------------------------------------------
export interface SingleLegCandidate {
  id: string;
  strategy: "LEAPS" | "CC" | "LONG_PUT" | "BEAR_MKT_PUT";
  putCall: "PUT" | "CALL";
  symbol: string;
  name: string;
  sector: string;
  underlyingPrice: number;
  strike: number;
  expiration: string;
  dte: number;
  bid: number;
  ask: number;
  mark: number;
  delta: number;
  theta: number;
  iv: number;
  openInterest: number;
  volume: number;
  rorPercent: number | null;
  annualizedRorPercent: number | null;
  fundamentals: {
    largeCap: boolean | null;
    sp500: boolean | null;
    profitable: boolean | null;
  };
  ivRank: number | null;
  technical: {
    aboveSma50: boolean | null;
    rsi: number | null;
    strikeBelowSupport: boolean | null;
  };
  flags: {
    earningsBeforeExp: boolean | null;
    exDivBeforeExp: boolean | null;
  };
  washSaleWarning: string | null;
  source?: "holding" | "discovered";
}

export interface SingleLegCandidatesFile {
  meta: {
    generatedAt: string;
    pricesAsOf: string;
    dteBasis: string;
    universe: string;
    note?: string;
  };
  candidates: SingleLegCandidate[];
}

// ---------------------------------------------------------------------------
// Spread candidates (BULL_PUT / BEAR_CALL / IRON_CONDOR / BULL_CALL /
// BEAR_PUT / PMCC) from data/spread-candidates.json. Whichever strike pair
// a strategy doesn't use is null (e.g. a bull put spread only populates
// putShortStrike/putLongStrike). PMCC is the one shape with two distinct
// expirations — longExpiration/longDte is its LEAPS leg.
// ---------------------------------------------------------------------------
export type SpreadStrategy = "BULL_PUT" | "BEAR_CALL" | "IRON_CONDOR" | "BULL_CALL" | "BEAR_PUT" | "PMCC";

export interface SpreadCandidate {
  id: string;
  strategy: SpreadStrategy;
  symbol: string;
  name: string;
  sector: string;
  underlyingPrice: number;
  expiration: string; // the short-dated leg's expiration
  dte: number;
  longExpiration: string | null; // PMCC only
  longDte: number | null;
  putShortStrike: number | null;
  putLongStrike: number | null;
  callShortStrike: number | null;
  callLongStrike: number | null;
  netPremium: number;
  isCredit: boolean;
  width: number | null;
  maxProfit: number | null;
  maxLoss: number | null;
  rorPercent: number | null;
  breakeven: number | null; // iron condor: lower breakeven only — the upper one isn't persisted upstream
  washSaleWarning: string | null;
  source?: "holding" | "discovered";
}

export interface SpreadCandidatesFile {
  meta: {
    generatedAt: string;
    pricesAsOf: string;
    dteBasis: string;
    universe: string;
    note?: string;
  };
  candidates: SpreadCandidate[];
}

// ---------------------------------------------------------------------------
// Portfolio risk (RULE-006 theta ceiling, RULE-011 sector cap) from
// data/portfolio-risk.json. Thresholds ship alongside the values so the UI
// never hardcodes RULE-006/011's numbers itself.
// ---------------------------------------------------------------------------
export interface RiskView {
  thetaToday: number;
  thetaPct: number;
  thetaStatus: "below_target" | "on_target" | "above_target_below_ceiling" | "over_ceiling" | "unknown";
  thetaMinPct: number;
  thetaTargetMaxPct: number;
  thetaMaxPct: number;
  sectorValues: Record<string, number>;
  maxSectorAllocationPct: number;
  portfolioValue: number; // the liquidation value sectorValues/thetaPct were each computed against
  openPnL: number; // RULE-019 — total unrealized P&L across every open position (Schwab only at this Overall/PerAccount level)
  openPnLPct: number;
  openPnLStatus: "on_target" | "below_target" | "unknown";
  openPnLMinPct: number;
}

// AccountThetaView is one account's own theta-only reading — Schwab,
// SnapTrade (Fidelity), or E*TRADE alike. It used to carry a full
// RiskView (sector + open P&L) per Schwab-only account; the account
// holder asked to see every linked account here instead, with just
// theta — open P&L and sector exposure now live once, portfolio-wide, in
// Overall/Blended rather than being repeated per row.
export interface AccountThetaView {
  accountLabel: string; // always masked/labeled server-side — never a raw account number
  thetaToday: number;
  thetaPct: number;
  thetaStatus: "below_target" | "on_target" | "above_target_below_ceiling" | "over_ceiling" | "unknown";
  thetaMinPct: number;
  thetaTargetMaxPct: number;
  thetaMaxPct: number;
  portfolioValue: number; // this one account's own value, not the whole portfolio's
}

// RULE-006 (theta), RULE-018 (beta-weighted-to-QQQ target, 0.6-1.05), and
// RULE-019 (open-P&L floor, -10%) combined across Schwab + SnapTrade +
// E*TRADE — Schwab alone reads nowhere near the account holder's own
// real numbers, since SnapTrade (Fidelity) + E*TRADE together hold
// roughly 2.5x Schwab's own value. All three soft guidance here (never a
// suggestion-engine gate) even though RULE-006 does gate at the
// Schwab-only Overall level (see RiskView above) — this blended theta is
// informational only. Sector exposure (RULE-011) has no blended
// equivalent: the other accounts' holdings are mostly broad index funds
// with no one meaningful sector to attribute.
export interface BlendedRiskView {
  portfolioValue: number; // Schwab + SnapTrade + E*TRADE combined
  thetaToday: number;
  thetaPct: number;
  thetaStatus: "below_target" | "on_target" | "above_target_below_ceiling" | "over_ceiling" | "unknown";
  thetaMinPct: number;
  thetaTargetMaxPct: number;
  thetaMaxPct: number;
  beta: number;
  betaCoverage: number; // fraction of portfolioValue with a computable per-underlying beta
  betaStatus: "below_target" | "on_target" | "above_target" | "unknown";
  betaMinTarget: number;
  betaMaxTarget: number;
  openPnL: number;
  openPnLPct: number;
  openPnLStatus: "on_target" | "below_target" | "unknown";
  openPnLMinPct: number;
}

// RULE-010's own 2%/month floor, 3%/month target — real Schwab options
// realized P&L for the current calendar month, paced against
// portfolioValueBaseline: the blended (Schwab + SnapTrade + E*TRADE)
// portfolio value FROZEN once at the start of this calendar month, not
// the live current value — the account holder's own explicit ask, so
// the dollar target doesn't silently drift as the live portfolio value
// moves throughout the month. (An earlier version had no portfolio-value
// field at all and computed a live capital base client-side instead;
// that base was also corrected once already for being Schwab-only,
// understating Fidelity/E*TRADE's own real wheel positions — this
// baseline is blended across all three from the start.) realizedThisMonth
// is still Schwab-only, though: internal/pnl's own FIFO reconstruction
// has no SnapTrade/E*TRADE equivalent for options (only stocks).
// targetPercent is a starting point only; the dashboard itself lets the
// account holder override it (a personal pacing goal, not an enforced
// rule).
export interface MonthlyGoalFile {
  meta: { generatedAt: string };
  realizedThisMonth: number;
  targetPercent: number;
  floorPercent: number;
  asOfDate: string; // YYYY-MM-DD, America/New_York
  daysInMonth: number;
  portfolioValueBaseline: number;
}

export interface PortfolioRiskFile {
  meta: { generatedAt: string };
  overall: RiskView;
  // Spans every linked account — Schwab, SnapTrade (Fidelity), E*TRADE —
  // each theta-only. Only the Schwab entries feed RULE-006's real gating
  // decision; the rest are informational only, same as blended below.
  perAccount: AccountThetaView[];
  blended: BlendedRiskView;
}

// ---------------------------------------------------------------------------
// Active position alerts (close/roll/monitor) from data/alerts.json —
// always the tracker's current full set, not history (see position_alerts'
// own doc comment on the Go side).
// ---------------------------------------------------------------------------
export interface Alert {
  ticker: string;
  putCall: "PUT" | "CALL";
  contractSymbol: string;
  strike: number;
  expirationDate: string;
  dte: number;
  entryCredit: number;
  currentValue: number;
  profitLoss: number;
  profitPct: number;
  underlyingPrice: number;
  action: "close" | "roll" | "watch" | "monitor" | "profit_target" | "leap_expiring" | "roll_up";
  rationale: string;
  rollToSymbol: string | null;
  rollToStrike: number | null;
  rollToExpirationDate: string | null;
  rollToDte: number | null;
  rollToDelta: number | null;
  rollToNetCredit: number | null;
  // 0-3 "how many of the three supporting measures are true" score,
  // meaningful only when action === "roll_up" (profit captured >=20%,
  // delta <=0.15, target strike at a real support level) -- see
  // internal/agents/tracker/roll_up.go's rollUpConviction.
  rollUpConviction: number;
  evaluatedAt: string;
}

export interface AlertsFile {
  meta: { generatedAt: string };
  alerts: Alert[];
}

// ---------------------------------------------------------------------------
// Suggestion-vs-actual-performance scorecard from data/suggestion-performance.json
// — a mirror for spotting your own patterns (e.g. "0.25-delta CSPs closed at
// 82% win rate, 0.30-delta at 65%"), not a self-tuning input. Only
// suggestions actually traded appear here; grouping/win-rate math happens
// client-side, same as lib closed-trade data already does for the P&L page.
// ---------------------------------------------------------------------------
export interface MatchedSuggestion {
  ticker: string;
  strategy: string;
  contractSymbol: string;
  strike: number | null;
  delta: number | null;
  dte: number | null;
  rorPercent: number | null;
  annualizedRorPercent: number | null;
  rank: number | null;
  timesSuggested: number;
  firstSuggestedAt: string;
  openDate: string;
  closeDate: string;
  realizedPnl: number;
  closeReason: string;
}

export interface SuggestionPerformanceFile {
  meta: { generatedAt: string; totalSuggestions: number };
  matched: MatchedSuggestion[];
}

// ---------------------------------------------------------------------------
// Phase 1 of the paper-bot feedback-loop plan: real-trade (matched
// suggestion_history) and paper-trade (resolved paper_trades, both bots)
// outcomes unioned into one flat list from data/strategy-performance.json,
// so "does the paper bots' much bigger sample agree with the smaller
// real-trade sample" is answerable on one screen instead of two that can't
// be compared. win is always derived from realizedPnl > 0 for both origins
// (never paperbot's own WIN/ASSIGNED outcome label) so the two stay
// comparable on the same definition. Grouping/win-rate math happens
// client-side, same convention as MatchedSuggestion above.
// ---------------------------------------------------------------------------
export interface PerformanceRow {
  origin: "real" | "paper";
  ticker: string;
  strategy: string;
  contractSymbol: string;
  delta: number | null;
  dte: number | null;
  rorPercent: number | null;
  annualizedRorPercent: number | null;
  realizedPnl: number;
  win: boolean;
  openDate: string;
  closeDate: string;
}

export interface StrategyPerformanceFile {
  meta: { generatedAt: string };
  rows: PerformanceRow[];
}

// ---------------------------------------------------------------------------
// Pre-OTU portfolio counterfactual vs. S&P 500 vs. actual (data/benchmark.json).
// All three are full historical series from cutoffDate to today, plotted on
// the same axis. "frozen" and "spy" are exactly reconstructable (real
// historical prices, no options involved). "actual" reconstructs the
// account's real, changing holdings + cash day by day — a close
// approximation everywhere except its own last point, which is
// "actualToday" exactly (today's real, options-inclusive account value) —
// see meta.note for what it can't capture.
// ---------------------------------------------------------------------------
export interface BenchmarkMeta {
  generatedAt: string;
  cutoffDate: string;
  frozenHoldings: Record<string, number>; // ticker -> shares, includes cash-equivalents
  frozenCash: number;
  note: string;
}

export interface BenchmarkFile {
  meta: BenchmarkMeta;
  frozen: ValuePoint[];
  spy: ValuePoint[];
  actual: ValuePoint[];
  actualToday: number;
}
