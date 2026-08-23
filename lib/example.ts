// A complete, self-consistent EXAMPLE portfolio used by "Example" mode so the
// app can be demoed to others without exposing real values. Every view is
// exercised: all option kinds (with full greeks + underlying live/close so
// Simulate and Top Movers work), equities enriched with covered-call ladders,
// gamma walls, Bollinger σ and 7-day price history, crypto, a value history,
// two accounts (so the account switcher shows), and closed round-trips in each
// bucket spread across recent months. Tickers are drawn from the approved
// universe so the CSP board / research / holdings-overlap flags look authentic.
// Numbers are invented but internally consistent (the summary adds up).
import type {
  Snapshot,
  ClosedCSPFile,
  ClosedLeapFile,
  ClosedCoveredFile,
  ClosedSpreadFile,
  ClosedStockFile,
} from "./types";

const ACC = "EX000000"; // primary margin account
const IRA = "EX000001"; // second account, to exercise the account switcher

// Dates are derived from today rather than written down, so the demo always reads
// as a snapshot of right now: expirations stay in the future, days-to-expiry and
// annualized yields stay sensible, and the closed trades stay recent. Hardcoding
// them means the whole dataset silently rots the moment the calendar passes it.
const DAY_MS = 86_400_000;
const isoDay = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const NOW_ISO = new Date().toISOString();

export const exampleSnapshot: Snapshot = {
  meta: {
    generatedAt: NOW_ISO,
    pricesAsOf: `${isoDay(0)} close`,
    source: "example",
    coveredCallsNextAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  },
  accounts: [
    { id: ACC, mask: "••••0000", type: "margin", brokerageType: "individual", nickname: "Individual", isDefault: true },
    { id: IRA, mask: "••••0001", type: "cash", brokerageType: "individual", nickname: "Roth IRA", isDefault: false },
  ],
  data: {
    [ACC]: {
      // equityValue tracks the holdings below (qty x price); the four buckets sum to
      // totalValue so the allocation donut and the percentages reconcile.
      summary: {
        totalValue: 248010,
        equityValue: 159410,
        optionsValue: 6200,
        cryptoValue: 22400,
        cash: 60000,
        buyingPower: 70000,
        optionsBuyingPower: 110000,
      },
      equities: [
        // ≥100 sh with covered-call ladders whose strikes sit ABOVE cost basis and
        // carry a real premium — so the Stocks "write a call" green flag lights up
        // for the ones with no CC already written (NVDA, SOFI, CLS, INTC). AAPL has
        // a covered call open (see options), so it shows the CC count instead.
        {
          symbol: "NVDA", name: "NVIDIA", qty: 150, avgCost: 80, price: 128.4, dayChange: 2.15, bbSigma: 0.8,
          priceHistory: [119.0, 121.5, 118.9, 123.2, 125.6, 124.1, 128.4],
          gamma: { flip: 120, callWall: 135, putWall: 115, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 135, delta: 0.30, mark: 3.1, premPct: 2.41, annPct: 63, oi: 12400, bbSigma: 1.4 },
            { targetDte: 21, dte: 21, strike: 138, delta: 0.28, mark: 4.0, premPct: 3.12, annPct: 54, oi: 8900, bbSigma: 1.8 },
            { targetDte: 30, dte: 30, strike: 140, delta: 0.26, mark: 5.2, premPct: 4.05, annPct: 49, oi: 15200, bbSigma: 2.1 },
          ],
        },
        {
          symbol: "AAPL", name: "Apple", qty: 200, avgCost: 150, price: 211.3, dayChange: -1.2, bbSigma: 0.4,
          priceHistory: [206.0, 208.5, 210.1, 213.4, 212.0, 210.8, 211.3],
          gamma: { flip: 205, callWall: 225, putWall: 200, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 220, delta: 0.31, mark: 2.6, premPct: 1.23, annPct: 32, oi: 30100, bbSigma: 1.2 },
            { targetDte: 21, dte: 21, strike: 225, delta: 0.27, mark: 3.3, premPct: 1.56, annPct: 27, oi: 22400, bbSigma: 1.6 },
            { targetDte: 30, dte: 30, strike: 230, delta: 0.24, mark: 4.1, premPct: 1.94, annPct: 24, oi: 41800, bbSigma: 2.0 },
          ],
        },
        {
          symbol: "SOFI", name: "SoFi Technologies", qty: 500, avgCost: 25, price: 28.4, dayChange: 0.42, bbSigma: 1.1,
          priceHistory: [26.4, 27.1, 26.8, 27.6, 28.1, 27.9, 28.4],
          gamma: { flip: 28, callWall: 32, putWall: 26, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 30, delta: 0.31, mark: 0.68, premPct: 2.39, annPct: 62, oi: 41200, bbSigma: 0.9 },
            { targetDte: 21, dte: 21, strike: 31, delta: 0.27, mark: 0.82, premPct: 2.89, annPct: 50, oi: 55800, bbSigma: 1.7 },
            { targetDte: 30, dte: 30, strike: 32, delta: 0.24, mark: 0.97, premPct: 3.42, annPct: 42, oi: 55800, bbSigma: 1.5 },
          ],
        },
        {
          symbol: "CLS", name: "Celestica", qty: 120, avgCost: 90, price: 138.2, dayChange: 3.4, bbSigma: 1.6,
          priceHistory: [126.0, 129.4, 131.0, 134.8, 133.2, 135.9, 138.2],
          gamma: { flip: 130, callWall: 145, putWall: 125, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 145, delta: 0.29, mark: 3.6, premPct: 2.60, annPct: 68, oi: 3100, bbSigma: 1.3 },
            { targetDte: 21, dte: 21, strike: 150, delta: 0.25, mark: 4.4, premPct: 3.18, annPct: 55, oi: 2400, bbSigma: 1.9 },
            { targetDte: 30, dte: 30, strike: 155, delta: 0.22, mark: 5.1, premPct: 3.69, annPct: 45, oi: 1800, bbSigma: 2.4 },
          ],
        },
        {
          // Small position (~3.8% of the account) → underweight, so if INTC is on the
          // CSP board it earns the home-screen "CSP" tag. Also has a CC opportunity.
          symbol: "INTC", name: "Intel", qty: 300, avgCost: 22, price: 24.1, dayChange: -0.35, bbSigma: -0.6,
          priceHistory: [24.8, 24.5, 24.0, 23.6, 24.2, 24.4, 24.1],
          gamma: { flip: 24, callWall: 26, putWall: 22, net: "neg" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 25, delta: 0.34, mark: 0.42, premPct: 1.74, annPct: 45, oi: 60200, bbSigma: 0.7 },
            { targetDte: 21, dte: 21, strike: 26, delta: 0.26, mark: 0.51, premPct: 2.12, annPct: 37, oi: 48900, bbSigma: 1.3 },
            { targetDte: 30, dte: 30, strike: 26, delta: 0.30, mark: 0.68, premPct: 2.82, annPct: 34, oi: 48900, bbSigma: 1.1 },
          ],
        },
        {
          symbol: "GLW", name: "Corning", qty: 200, avgCost: 41.5, price: 52.0, dayChange: 0.62, bbSigma: 1.0,
          priceHistory: [49.2, 50.1, 49.6, 50.8, 51.4, 51.1, 52.0],
          gamma: { flip: 50, callWall: 55, putWall: 48, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 55, delta: 0.30, mark: 0.88, premPct: 1.69, annPct: 44, oi: 8400, bbSigma: 1.4 },
            { targetDte: 21, dte: 21, strike: 57.5, delta: 0.26, mark: 1.02, premPct: 1.96, annPct: 34, oi: 5100, bbSigma: 1.9 },
            { targetDte: 30, dte: 30, strike: 60, delta: 0.23, mark: 1.24, premPct: 2.38, annPct: 29, oi: 6700, bbSigma: 2.3 },
          ],
        },
        {
          // Held below cost — the covered-call ladder's strikes above basis are the
          // ones that matter here, so this exercises that "above avg cost" styling.
          symbol: "IREN", name: "IREN", qty: 400, avgCost: 21.8, price: 18.4, dayChange: -0.44, bbSigma: -1.4,
          priceHistory: [19.6, 19.1, 18.8, 19.2, 18.6, 18.8, 18.4],
          gamma: { flip: 19, callWall: 22, putWall: 17, net: "neg" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 20, delta: 0.33, mark: 0.61, premPct: 3.32, annPct: 87, oi: 14200, bbSigma: 0.8 },
            { targetDte: 21, dte: 21, strike: 22, delta: 0.27, mark: 0.74, premPct: 4.02, annPct: 70, oi: 9800, bbSigma: 1.5 },
            { targetDte: 30, dte: 30, strike: 23, delta: 0.25, mark: 0.92, premPct: 5.00, annPct: 61, oi: 7300, bbSigma: 1.8 },
          ],
        },
        {
          symbol: "PLTR", name: "Palantir", qty: 200, avgCost: 150, price: 176.2, dayChange: 2.05, bbSigma: 1.3,
          priceHistory: [166.5, 170.2, 168.4, 173.1, 175.8, 174.2, 176.2],
          gamma: { flip: 175, callWall: 200, putWall: 160, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 185, delta: 0.30, mark: 4.20, premPct: 2.38, annPct: 62, oi: 22100, bbSigma: 1.5 },
            { targetDte: 21, dte: 21, strike: 190, delta: 0.27, mark: 5.10, premPct: 2.89, annPct: 50, oi: 31400, bbSigma: 1.9 },
            { targetDte: 30, dte: 30, strike: 195, delta: 0.24, mark: 6.30, premPct: 3.58, annPct: 44, oi: 18900, bbSigma: 2.2 },
          ],
        },
        // < 100 sh: no covered-call ladder (exercises the "can't write a call" path).
        { symbol: "MU", name: "Micron Technology", qty: 60, avgCost: 90, price: 115.2, dayChange: 1.85, bbSigma: 0.9, priceHistory: [108.0, 110.3, 109.1, 112.6, 114.0, 113.2, 115.2] },
      ],
      crypto: [
        { symbol: "BTC", name: "Bitcoin", qty: 0.25, avgCost: 40000, price: 64000 },
        { symbol: "ETH", name: "Ethereum", qty: 2, avgCost: 2000, price: 3200 },
      ],
      // One of every OptionKind. underlyingLive ≠ underlyingClose so Simulate is
      // enabled; dayValueChange + underlyingChange feed Top Movers; shorts carry
      // chanceOfProfitShort; CSPs carry erDate so the -ER flag shows.
      // The CSPs are written so all three insight buckets have something in them —
      // the At risk / Rollable / Hold filter chips are a big part of this screen:
      //   SOFI, IREN — most premium harvested, remaining yield annualizes under 25% → "Rollable"
      //   MU         — through the strike on delta                                 → "Assignment risk"
      //   CDE, INTC, GLW, CLS, TSM — premium still working, well OTM               → "Hold"
      options: [
        { id: "ex-o1", kind: "csp", symbol: "SOFI", optionType: "put", side: "short", qty: 2, strike: 26, expiration: isoDay(20), entryPerShare: 1.10, mark: 0.22, delta: -0.12, gamma: 0.06, vega: 0.04, theta: 0.02, iv: 0.52, breakeven: 24.90, underlyingPrice: 28.4, underlyingChange: 0.42, underlyingClose: 27.98, underlyingLive: 28.4, dayValueChange: 14.0, bbSigma: -1.2, chanceOfProfitShort: 0.88, openedAt: isoDay(-38), erDate: isoDay(46) },
        { id: "ex-o2", kind: "csp", symbol: "MU", optionType: "put", side: "short", qty: 1, strike: 118, expiration: isoDay(27), entryPerShare: 3.2, mark: 4.6, delta: -0.56, gamma: 0.01, vega: 0.12, theta: 0.05, iv: 0.44, breakeven: 114.8, underlyingPrice: 115.2, underlyingChange: 1.85, underlyingClose: 113.4, underlyingLive: 115.2, dayValueChange: 22.0, bbSigma: -0.8, chanceOfProfitShort: 0.44, openedAt: isoDay(-43), erDate: isoDay(12) },
        { id: "ex-o3", kind: "csp", symbol: "CDE", optionType: "put", side: "short", qty: 3, strike: 6, expiration: isoDay(34), entryPerShare: 0.35, mark: 0.28, delta: -0.20, gamma: 0.10, vega: 0.01, theta: 0.004, iv: 0.58, breakeven: 5.65, underlyingPrice: 6.85, underlyingChange: 0.05, underlyingClose: 6.80, underlyingLive: 6.85, dayValueChange: 6.0, bbSigma: -0.4, chanceOfProfitShort: 0.80, openedAt: isoDay(-32), erDate: null },
        { id: "ex-o11", kind: "csp", symbol: "IREN", optionType: "put", side: "short", qty: 4, strike: 16, expiration: isoDay(13), entryPerShare: 0.62, mark: 0.08, delta: -0.08, gamma: 0.05, vega: 0.02, theta: 0.008, iv: 0.71, breakeven: 15.38, underlyingPrice: 18.4, underlyingChange: -0.44, underlyingClose: 18.84, underlyingLive: 18.4, dayValueChange: 18.0, bbSigma: -1.6, chanceOfProfitShort: 0.92, openedAt: isoDay(-29), erDate: null },
        { id: "ex-o12", kind: "csp", symbol: "INTC", optionType: "put", side: "short", qty: 5, strike: 23, expiration: isoDay(27), entryPerShare: 0.72, mark: 0.45, delta: -0.28, gamma: 0.07, vega: 0.03, theta: 0.012, iv: 0.49, breakeven: 22.28, underlyingPrice: 24.1, underlyingChange: -0.35, underlyingClose: 24.45, underlyingLive: 24.1, dayValueChange: 24.0, bbSigma: -0.7, chanceOfProfitShort: 0.72, openedAt: isoDay(-19), erDate: isoDay(31) },
        { id: "ex-o13", kind: "csp", symbol: "GLW", optionType: "put", side: "short", qty: 2, strike: 48, expiration: isoDay(41), entryPerShare: 2.05, mark: 1.60, delta: -0.24, gamma: 0.02, vega: 0.16, theta: 0.028, iv: 0.33, breakeven: 45.95, underlyingPrice: 52.0, underlyingChange: 0.62, underlyingClose: 51.38, underlyingLive: 52.0, dayValueChange: 14.0, bbSigma: -0.6, chanceOfProfitShort: 0.76, openedAt: isoDay(-12), erDate: null },
        { id: "ex-o14", kind: "csp", symbol: "CLS", optionType: "put", side: "short", qty: 1, strike: 125, expiration: isoDay(34), entryPerShare: 4.10, mark: 3.40, delta: -0.26, gamma: 0.01, vega: 0.29, theta: 0.055, iv: 0.55, breakeven: 120.9, underlyingPrice: 138.2, underlyingChange: 3.4, underlyingClose: 134.8, underlyingLive: 138.2, dayValueChange: 41.0, bbSigma: -0.5, chanceOfProfitShort: 0.74, openedAt: isoDay(-24), erDate: null },
        { id: "ex-o4", kind: "leap-call", symbol: "NVDA", optionType: "call", side: "long", qty: 2, strike: 100, expiration: isoDay(146), entryPerShare: 38, mark: 45, delta: 0.72, gamma: 0.01, vega: 0.45, theta: -0.03, iv: 0.50, breakeven: 138, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: 86.0, bbSigma: 0.8, openedAt: isoDay(-194) },
        { id: "ex-o5", kind: "leap-put-hedge", symbol: "SMH", optionType: "put", side: "long", qty: 1, strike: 240, expiration: isoDay(209), entryPerShare: 14, mark: 11, delta: -0.30, gamma: 0.01, vega: 0.55, theta: -0.02, iv: 0.26, breakeven: 226, underlyingPrice: 258, underlyingChange: 3.1, underlyingClose: 254.9, underlyingLive: 258, dayValueChange: -31.0, bbSigma: 1.0, openedAt: isoDay(-143) },
        { id: "ex-o6", kind: "covered-call", symbol: "AAPL", optionType: "call", side: "short", qty: 2, strike: 225, expiration: isoDay(20), entryPerShare: 4.2, mark: 3.1, delta: 0.34, gamma: 0.02, vega: 0.18, theta: 0.05, iv: 0.28, breakeven: 229.2, underlyingPrice: 211.3, underlyingChange: -1.2, underlyingClose: 212.5, underlyingLive: 211.3, dayValueChange: 24.0, bbSigma: 1.6, chanceOfProfitShort: 0.66, openedAt: isoDay(-35) },
        { id: "ex-o7", kind: "put-spread", symbol: "GOOGL", optionType: "put", side: "short", qty: 1, strike: 170, expiration: isoDay(34), entryPerShare: 6, mark: 4.2, delta: -0.30, gamma: 0.02, vega: 0.20, theta: 0.03, iv: 0.30, breakeven: 164, underlyingPrice: 178.4, underlyingChange: 0.9, underlyingClose: 177.5, underlyingLive: 178.4, dayValueChange: 12.0, bbSigma: 0.3, chanceOfProfitShort: 0.70, openedAt: isoDay(-39) },
        { id: "ex-o8", kind: "put-spread", symbol: "GOOGL", optionType: "put", side: "long", qty: 1, strike: 160, expiration: isoDay(34), entryPerShare: 3, mark: 2, delta: -0.18, gamma: 0.02, vega: 0.15, theta: 0.02, iv: 0.32, breakeven: 157, underlyingPrice: 178.4, underlyingChange: 0.9, underlyingClose: 177.5, underlyingLive: 178.4, dayValueChange: -6.0, bbSigma: -0.1, openedAt: isoDay(-39) },
        { id: "ex-o9", kind: "call-spread", symbol: "NVDA", optionType: "call", side: "short", qty: 2, strike: 140, expiration: isoDay(34), entryPerShare: 5, mark: 6, delta: 0.40, gamma: 0.02, vega: 0.22, theta: 0.04, iv: 0.48, breakeven: 145, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: -40.0, bbSigma: 0.8, chanceOfProfitShort: 0.62, openedAt: isoDay(-51) },
        { id: "ex-o10", kind: "call-spread", symbol: "NVDA", optionType: "call", side: "long", qty: 2, strike: 150, expiration: isoDay(34), entryPerShare: 2.5, mark: 3.2, delta: 0.28, gamma: 0.02, vega: 0.18, theta: 0.03, iv: 0.50, breakeven: 152.5, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: 28.0, bbSigma: 0.8, openedAt: isoDay(-51) },
      ],
      valueHistory: [
        { label: "Jul", value: 150000 },
        { label: "Aug", value: 158000 },
        { label: "Sep", value: 152000 },
        { label: "Oct", value: 165000 },
        { label: "Nov", value: 172000 },
        { label: "Dec", value: 169000 },
        { label: "Jan", value: 181000 },
        { label: "Feb", value: 188000 },
        { label: "Mar", value: 179000 },
        { label: "Apr", value: 186000 },
        { label: "May", value: 189000 },
        { label: "Jun", value: 191610 },
      ],
    },
    [IRA]: {
      summary: {
        totalValue: 48250,
        equityValue: 31250,
        optionsValue: 500,
        cryptoValue: 0,
        cash: 16500,
        buyingPower: 16500,
        optionsBuyingPower: 16500,
      },
      equities: [
        { symbol: "GOOGL", name: "Alphabet", qty: 100, avgCost: 140, price: 178.4, dayChange: 0.9, bbSigma: 0.3, priceHistory: [172.0, 174.5, 173.1, 176.8, 177.9, 177.2, 178.4], gamma: { flip: 175, callWall: 185, putWall: 170, net: "pos" }, coveredCalls: [ { targetDte: 21, dte: 21, strike: 185, delta: 0.28, mark: 3.4, premPct: 1.91, annPct: 33, oi: 12800, bbSigma: 1.5 } ] },
        { symbol: "AMZN", name: "Amazon", qty: 60, avgCost: 170, price: 205.6, dayChange: 1.4, bbSigma: 0.7, priceHistory: [197.0, 199.4, 198.2, 202.6, 204.1, 203.5, 205.6] },
      ],
      options: [
        { id: "ex-ira1", kind: "csp", symbol: "TSM", optionType: "put", side: "short", qty: 1, strike: 190, expiration: isoDay(27), entryPerShare: 5.0, mark: 3.4, delta: -0.25, gamma: 0.01, vega: 0.30, theta: 0.06, iv: 0.34, breakeven: 185, underlyingPrice: 205.3, underlyingChange: 2.2, underlyingClose: 203.1, underlyingLive: 205.3, dayValueChange: 16.0, bbSigma: -0.5, chanceOfProfitShort: 0.76, openedAt: isoDay(-36), erDate: isoDay(25) },
      ],
      valueHistory: [
        { label: "Jan", value: 41000 },
        { label: "Feb", value: 43500 },
        { label: "Mar", value: 42200 },
        { label: "Apr", value: 45100 },
        { label: "May", value: 46800 },
        { label: "Jun", value: 48250 },
      ],
    },
  },
};

const META = { generatedAt: NOW_ISO, source: "example" as const };

export const exampleCspFile: ClosedCSPFile = {
  meta: META,
  closed: [
    { id: "ex-c1", symbol: "SOFI", name: "SoFi Technologies", strike: 24, expiration: isoDay(-8), openedAt: isoDay(-53), closedAt: isoDay(-8), contracts: 2, creditPerShare: 0.95, creditReceived: 190, costToClose: 0, realizedPnl: 190, outcome: "expired", daysHeld: 45, collateral: 4800, returnOnCollateral: 0.0396, annualized: 0.354 },
    { id: "ex-c2", symbol: "MU", name: "Micron Technology", strike: 95, expiration: isoDay(-12), openedAt: isoDay(-57), closedAt: isoDay(-19), contracts: 1, creditPerShare: 3.0, creditReceived: 300, costToClose: 80, realizedPnl: 220, outcome: "closed_profit", daysHeld: 38, collateral: 9500, returnOnCollateral: 0.0232, annualized: 0.223 },
    { id: "ex-c3", symbol: "NVDA", name: "NVIDIA", strike: 95, expiration: isoDay(-34), openedAt: isoDay(-77), closedAt: isoDay(-34), contracts: 1, creditPerShare: 2.4, creditReceived: 240, costToClose: 0, realizedPnl: 240, outcome: "expired", daysHeld: 43, collateral: 9500, returnOnCollateral: 0.0253, annualized: 0.214 },
    { id: "ex-c4", symbol: "SOFI", name: "SoFi Technologies", strike: 26, expiration: isoDay(-61), openedAt: isoDay(-96), closedAt: isoDay(-61), contracts: 3, creditPerShare: 1.15, creditReceived: 345, costToClose: 0, realizedPnl: 345, outcome: "expired", daysHeld: 35, collateral: 7800, returnOnCollateral: 0.0442, annualized: 0.521 },
    { id: "ex-c5", symbol: "CLS", name: "Celestica", strike: 120, expiration: isoDay(-89), openedAt: isoDay(-120), closedAt: isoDay(-96), contracts: 1, creditPerShare: 3.5, creditReceived: 350, costToClose: 520, realizedPnl: -170, outcome: "closed_loss", daysHeld: 24, collateral: 12000, returnOnCollateral: -0.0142, annualized: -0.215 },
    { id: "ex-c6", symbol: "INTC", name: "Intel", strike: 22, expiration: isoDay(-3), openedAt: isoDay(-31), closedAt: isoDay(-3), contracts: 4, creditPerShare: 0.55, creditReceived: 220, costToClose: 0, realizedPnl: 220, outcome: "expired", daysHeld: 28, collateral: 8800, returnOnCollateral: 0.025, annualized: 0.326 },
    { id: "ex-c7", symbol: "IREN", name: "IREN", strike: 15, expiration: isoDay(-24), openedAt: isoDay(-45), closedAt: isoDay(-15), contracts: 3, creditPerShare: 0.71, creditReceived: 213, costToClose: 42, realizedPnl: 171, outcome: "closed_profit", daysHeld: 30, collateral: 4500, returnOnCollateral: 0.038, annualized: 0.462 },
    { id: "ex-c8", symbol: "GLW", name: "Corning", strike: 45, expiration: isoDay(-6), openedAt: isoDay(-40), closedAt: isoDay(-6), contracts: 2, creditPerShare: 1.35, creditReceived: 270, costToClose: 0, realizedPnl: 270, outcome: "expired", daysHeld: 34, collateral: 9000, returnOnCollateral: 0.03, annualized: 0.322 },
  ],
};

export const exampleLeapFile: ClosedLeapFile = {
  meta: META,
  closed: [
    { id: "ex-l1", symbol: "NVDA", name: "NVIDIA", optionType: "call", strike: 70, expiration: isoDay(-66), openedAt: isoDay(-215), closedAt: isoDay(-90), contracts: 1, entryPerShare: 22, costBasis: 2200, proceeds: 5600, realizedPnl: 3400, outcome: "closed_profit", daysHeld: 125, returnPct: 1.545, annualized: 4.51 },
    { id: "ex-l2", symbol: "MU", name: "Micron Technology", optionType: "call", strike: 80, expiration: isoDay(146), openedAt: isoDay(-179), closedAt: isoDay(-110), contracts: 1, entryPerShare: 28, costBasis: 2800, proceeds: 2100, realizedPnl: -700, outcome: "closed_loss", daysHeld: 69, returnPct: -0.25, annualized: -0.83 },
    { id: "ex-l3", symbol: "AAPL", name: "Apple", optionType: "call", strike: 160, expiration: isoDay(118), openedAt: isoDay(-170), closedAt: isoDay(-78), contracts: 1, entryPerShare: 30, costBasis: 3000, proceeds: 4200, realizedPnl: 1200, outcome: "closed_profit", daysHeld: 92, returnPct: 0.4, annualized: 1.59 },
  ],
};

export const exampleCoveredFile: ClosedCoveredFile = {
  meta: META,
  closed: [
    { id: "ex-cc1", symbol: "AAPL", name: "Apple", strike: 200, expiration: isoDay(-11), openedAt: isoDay(-42), closedAt: isoDay(-11), contracts: 2, creditPerShare: 3.0, creditReceived: 600, costToClose: 0, realizedPnl: 600, outcome: "expired", daysHeld: 31, returnOnNotional: 0.015, annualized: 0.177 },
    { id: "ex-cc2", symbol: "CLS", name: "Celestica", strike: 130, expiration: isoDay(-25), openedAt: isoDay(-48), closedAt: isoDay(-25), contracts: 1, creditPerShare: 5.0, creditReceived: 500, costToClose: 0, realizedPnl: 500, outcome: "expired", daysHeld: 23, returnOnNotional: 0.0385, annualized: 0.611 },
    { id: "ex-cc3", symbol: "NVDA", name: "NVIDIA", strike: 130, expiration: isoDay(-52), openedAt: isoDay(-82), closedAt: isoDay(-67), contracts: 1, creditPerShare: 4.0, creditReceived: 400, costToClose: 650, realizedPnl: -250, outcome: "closed_loss", daysHeld: 15, returnOnNotional: -0.0192, annualized: -0.468 },
    { id: "ex-cc4", symbol: "INTC", name: "Intel", strike: 25, expiration: isoDay(-9), openedAt: isoDay(-34), closedAt: isoDay(-9), contracts: 2, creditPerShare: 0.5, creditReceived: 100, costToClose: 0, realizedPnl: 100, outcome: "expired", daysHeld: 25, returnOnNotional: 0.02, annualized: 0.292 },
  ],
};

export const exampleSpreadFile: ClosedSpreadFile = {
  meta: META,
  closed: [
    { id: "ex-s1", symbol: "GOOGL", name: "Alphabet", optionType: "put", shortStrike: 160, longStrike: 150, width: 10, expiration: isoDay(-14), openedAt: isoDay(-52), closedAt: isoDay(-14), contracts: 1, isCredit: true, netCreditPerShare: 3.0, netOpen: 300, netClose: 0, realizedPnl: 300, maxRisk: 700, outcome: "closed_profit", daysHeld: 38, returnOnRisk: 0.429, annualized: 4.12 },
    { id: "ex-s2", symbol: "NVDA", name: "NVIDIA", optionType: "call", shortStrike: 140, longStrike: 150, width: 10, expiration: isoDay(-58), openedAt: isoDay(-90), closedAt: isoDay(-65), contracts: 2, isCredit: true, netCreditPerShare: 2.5, netOpen: 500, netClose: 900, realizedPnl: -400, maxRisk: 1500, outcome: "closed_loss", daysHeld: 26, returnOnRisk: -0.267, annualized: -3.74 },
    { id: "ex-s3", symbol: "AAPL", name: "Apple", optionType: "put", shortStrike: 210, longStrike: 200, width: 10, expiration: isoDay(-21), openedAt: isoDay(-48), closedAt: isoDay(-21), contracts: 1, isCredit: true, netCreditPerShare: 2.2, netOpen: 220, netClose: 0, realizedPnl: 220, maxRisk: 780, outcome: "closed_profit", daysHeld: 27, returnOnRisk: 0.282, annualized: 3.81 },
  ],
};

export const exampleStockFile: ClosedStockFile = {
  meta: META,
  closed: [
    { id: "ex-st1", symbol: "NVDA", name: "NVIDIA", side: "long", shares: 100, avgOpen: 95, avgClose: 128, costBasis: 9500, proceeds: 12800, realizedPnl: 3300, outcome: "closed_profit", openedAt: isoDay(-131), closedAt: isoDay(-36), daysHeld: 95, returnPct: 0.347, annualized: 1.33 },
    { id: "ex-st2", symbol: "MU", name: "Micron Technology", side: "long", shares: 100, avgOpen: 100, avgClose: 92, costBasis: 10000, proceeds: 9200, realizedPnl: -800, outcome: "closed_loss", openedAt: isoDay(-95), closedAt: isoDay(-57), daysHeld: 38, returnPct: -0.08, annualized: -0.77 },
    { id: "ex-st3", symbol: "AAPL", name: "Apple", side: "long", shares: 50, avgOpen: 175, avgClose: 205, costBasis: 8750, proceeds: 10250, realizedPnl: 1500, outcome: "closed_profit", openedAt: isoDay(-121), closedAt: isoDay(-11), daysHeld: 110, returnPct: 0.171, annualized: 0.568 },
    { id: "ex-st4", symbol: "SOFI", name: "SoFi Technologies", side: "long", shares: 300, avgOpen: 22.4, avgClose: 27.8, costBasis: 6720, proceeds: 8340, realizedPnl: 1620, outcome: "closed_profit", openedAt: isoDay(-109), closedAt: isoDay(-5), daysHeld: 120, returnPct: 0.368, annualized: 1.12 },
    { id: "ex-st5", symbol: "CLS", name: "Celestica", side: "long", shares: 60, avgOpen: 115, avgClose: 108, costBasis: 6900, proceeds: 6480, realizedPnl: -420, outcome: "closed_loss", openedAt: isoDay(-72), closedAt: isoDay(-46), daysHeld: 26, returnPct: -0.0609, annualized: -0.85 },
  ],
};
