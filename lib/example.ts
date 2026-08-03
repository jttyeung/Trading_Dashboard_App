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

export const exampleSnapshot: Snapshot = {
  meta: {
    generatedAt: "2026-06-18T20:00:00Z",
    pricesAsOf: "2026-06-18 close",
    source: "example",
    coveredCallsNextAt: "2026-06-18T20:05:00Z",
  },
  accounts: [
    { id: ACC, mask: "••••0000", type: "margin", brokerageType: "individual", nickname: "Individual", isDefault: true },
    { id: IRA, mask: "••••0001", type: "cash", brokerageType: "individual", nickname: "Roth IRA", isDefault: false },
  ],
  data: {
    [ACC]: {
      summary: {
        totalValue: 191610,
        equityValue: 103010,
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
          symbol: "SOFI", name: "SoFi Technologies", qty: 800, avgCost: 9, price: 13.55, dayChange: 0.28, bbSigma: 1.1,
          priceHistory: [12.6, 12.9, 12.7, 13.1, 13.4, 13.2, 13.55],
          gamma: { flip: 13, callWall: 14, putWall: 12, net: "pos" },
          coveredCalls: [
            { targetDte: 14, dte: 14, strike: 14, delta: 0.33, mark: 0.32, premPct: 2.36, annPct: 62, oi: 41200, bbSigma: 0.9 },
            { targetDte: 21, dte: 21, strike: 15, delta: 0.24, mark: 0.28, premPct: 2.07, annPct: 36, oi: 55800, bbSigma: 1.7 },
            { targetDte: 30, dte: 30, strike: 15, delta: 0.28, mark: 0.41, premPct: 3.03, annPct: 37, oi: 55800, bbSigma: 1.5 },
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
      options: [
        { id: "ex-o1", kind: "csp", symbol: "SOFI", optionType: "put", side: "short", qty: 2, strike: 12, expiration: "2026-08-21", entryPerShare: 0.55, mark: 0.30, delta: -0.22, gamma: 0.06, vega: 0.02, theta: 0.01, iv: 0.52, breakeven: 11.45, underlyingPrice: 13.55, underlyingChange: 0.28, underlyingClose: 13.30, underlyingLive: 13.55, dayValueChange: 9.0, bbSigma: -1.2, chanceOfProfitShort: 0.78, openedAt: "2026-06-02", erDate: "2026-07-28" },
        { id: "ex-o2", kind: "csp", symbol: "MU", optionType: "put", side: "short", qty: 1, strike: 105, expiration: "2026-08-21", entryPerShare: 3.2, mark: 1.9, delta: -0.28, gamma: 0.01, vega: 0.12, theta: 0.05, iv: 0.44, breakeven: 101.8, underlyingPrice: 115.2, underlyingChange: 1.85, underlyingClose: 113.4, underlyingLive: 115.2, dayValueChange: 22.0, bbSigma: -0.8, chanceOfProfitShort: 0.74, openedAt: "2026-05-28", erDate: "2026-06-25" },
        { id: "ex-o3", kind: "csp", symbol: "CDE", optionType: "put", side: "short", qty: 3, strike: 6, expiration: "2026-09-18", entryPerShare: 0.35, mark: 0.28, delta: -0.20, gamma: 0.10, vega: 0.01, theta: 0.004, iv: 0.58, breakeven: 5.65, underlyingPrice: 6.85, underlyingChange: 0.05, underlyingClose: 6.80, underlyingLive: 6.85, dayValueChange: 6.0, bbSigma: -0.4, chanceOfProfitShort: 0.80, openedAt: "2026-06-08", erDate: null },
        { id: "ex-o4", kind: "leap-call", symbol: "NVDA", optionType: "call", side: "long", qty: 2, strike: 100, expiration: "2027-01-15", entryPerShare: 38, mark: 45, delta: 0.72, gamma: 0.01, vega: 0.45, theta: -0.03, iv: 0.50, breakeven: 138, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: 86.0, bbSigma: 0.8, openedAt: "2026-02-10" },
        { id: "ex-o5", kind: "leap-put-hedge", symbol: "SMH", optionType: "put", side: "long", qty: 1, strike: 240, expiration: "2027-03-19", entryPerShare: 14, mark: 11, delta: -0.30, gamma: 0.01, vega: 0.55, theta: -0.02, iv: 0.26, breakeven: 226, underlyingPrice: 258, underlyingChange: 3.1, underlyingClose: 254.9, underlyingLive: 258, dayValueChange: -31.0, bbSigma: 1.0, openedAt: "2026-04-01" },
        { id: "ex-o6", kind: "covered-call", symbol: "AAPL", optionType: "call", side: "short", qty: 2, strike: 225, expiration: "2026-08-21", entryPerShare: 4.2, mark: 3.1, delta: 0.34, gamma: 0.02, vega: 0.18, theta: 0.05, iv: 0.28, breakeven: 229.2, underlyingPrice: 211.3, underlyingChange: -1.2, underlyingClose: 212.5, underlyingLive: 211.3, dayValueChange: 24.0, bbSigma: 1.6, chanceOfProfitShort: 0.66, openedAt: "2026-06-05" },
        { id: "ex-o7", kind: "put-spread", symbol: "GOOGL", optionType: "put", side: "short", qty: 1, strike: 170, expiration: "2026-09-18", entryPerShare: 6, mark: 4.2, delta: -0.30, gamma: 0.02, vega: 0.20, theta: 0.03, iv: 0.30, breakeven: 164, underlyingPrice: 178.4, underlyingChange: 0.9, underlyingClose: 177.5, underlyingLive: 178.4, dayValueChange: 12.0, bbSigma: 0.3, chanceOfProfitShort: 0.70, openedAt: "2026-06-01" },
        { id: "ex-o8", kind: "put-spread", symbol: "GOOGL", optionType: "put", side: "long", qty: 1, strike: 160, expiration: "2026-09-18", entryPerShare: 3, mark: 2, delta: -0.18, gamma: 0.02, vega: 0.15, theta: 0.02, iv: 0.32, breakeven: 157, underlyingPrice: 178.4, underlyingChange: 0.9, underlyingClose: 177.5, underlyingLive: 178.4, dayValueChange: -6.0, bbSigma: -0.1, openedAt: "2026-06-01" },
        { id: "ex-o9", kind: "call-spread", symbol: "NVDA", optionType: "call", side: "short", qty: 2, strike: 140, expiration: "2026-09-18", entryPerShare: 5, mark: 6, delta: 0.40, gamma: 0.02, vega: 0.22, theta: 0.04, iv: 0.48, breakeven: 145, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: -40.0, bbSigma: 0.8, chanceOfProfitShort: 0.62, openedAt: "2026-05-20" },
        { id: "ex-o10", kind: "call-spread", symbol: "NVDA", optionType: "call", side: "long", qty: 2, strike: 150, expiration: "2026-09-18", entryPerShare: 2.5, mark: 3.2, delta: 0.28, gamma: 0.02, vega: 0.18, theta: 0.03, iv: 0.50, breakeven: 152.5, underlyingPrice: 128.4, underlyingChange: 2.15, underlyingClose: 126.25, underlyingLive: 128.4, dayValueChange: 28.0, bbSigma: 0.8, openedAt: "2026-05-20" },
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
        { id: "ex-ira1", kind: "csp", symbol: "TSM", optionType: "put", side: "short", qty: 1, strike: 190, expiration: "2026-08-21", entryPerShare: 5.0, mark: 3.4, delta: -0.25, gamma: 0.01, vega: 0.30, theta: 0.06, iv: 0.34, breakeven: 185, underlyingPrice: 205.3, underlyingChange: 2.2, underlyingClose: 203.1, underlyingLive: 205.3, dayValueChange: 16.0, bbSigma: -0.5, chanceOfProfitShort: 0.76, openedAt: "2026-06-04", erDate: "2026-07-17" },
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

const META = { generatedAt: "2026-06-18T20:00:00Z", source: "example" as const };

export const exampleCspFile: ClosedCSPFile = {
  meta: META,
  closed: [
    { id: "ex-c1", symbol: "SOFI", name: "SoFi Technologies", strike: 11, expiration: "2026-02-20", openedAt: "2026-01-06", closedAt: "2026-02-20", contracts: 2, creditPerShare: 0.48, creditReceived: 96, costToClose: 0, realizedPnl: 96, outcome: "expired", daysHeld: 45, collateral: 2200, returnOnCollateral: 0.0436, annualized: 0.354 },
    { id: "ex-c2", symbol: "MU", name: "Micron Technology", strike: 95, expiration: "2026-03-20", openedAt: "2026-02-02", closedAt: "2026-03-12", contracts: 1, creditPerShare: 3.0, creditReceived: 300, costToClose: 80, realizedPnl: 220, outcome: "closed_profit", daysHeld: 38, collateral: 9500, returnOnCollateral: 0.0232, annualized: 0.223 },
    { id: "ex-c3", symbol: "NVDA", name: "NVIDIA", strike: 95, expiration: "2026-04-17", openedAt: "2026-03-05", closedAt: "2026-04-17", contracts: 1, creditPerShare: 2.4, creditReceived: 240, costToClose: 0, realizedPnl: 240, outcome: "expired", daysHeld: 43, collateral: 9500, returnOnCollateral: 0.0253, annualized: 0.214 },
    { id: "ex-c4", symbol: "SOFI", name: "SoFi Technologies", strike: 12, expiration: "2026-05-15", openedAt: "2026-04-10", closedAt: "2026-05-15", contracts: 3, creditPerShare: 0.6, creditReceived: 180, costToClose: 0, realizedPnl: 180, outcome: "expired", daysHeld: 35, collateral: 3600, returnOnCollateral: 0.05, annualized: 0.521 },
    { id: "ex-c5", symbol: "CLS", name: "Celestica", strike: 120, expiration: "2026-06-19", openedAt: "2026-05-12", closedAt: "2026-06-05", contracts: 1, creditPerShare: 3.5, creditReceived: 350, costToClose: 520, realizedPnl: -170, outcome: "closed_loss", daysHeld: 24, collateral: 12000, returnOnCollateral: -0.0142, annualized: -0.215 },
  ],
};

export const exampleLeapFile: ClosedLeapFile = {
  meta: META,
  closed: [
    { id: "ex-l1", symbol: "NVDA", name: "NVIDIA", optionType: "call", strike: 70, expiration: "2026-06-18", openedAt: "2026-01-15", closedAt: "2026-05-20", contracts: 1, entryPerShare: 22, costBasis: 2200, proceeds: 5600, realizedPnl: 3400, outcome: "closed_profit", daysHeld: 125, returnPct: 1.545, annualized: 4.51 },
    { id: "ex-l2", symbol: "MU", name: "Micron Technology", optionType: "call", strike: 80, expiration: "2027-01-15", openedAt: "2026-02-20", closedAt: "2026-04-30", contracts: 1, entryPerShare: 28, costBasis: 2800, proceeds: 2100, realizedPnl: -700, outcome: "closed_loss", daysHeld: 69, returnPct: -0.25, annualized: -0.83 },
    { id: "ex-l3", symbol: "AAPL", name: "Apple", optionType: "call", strike: 160, expiration: "2026-12-18", openedAt: "2026-03-01", closedAt: "2026-06-01", contracts: 1, entryPerShare: 30, costBasis: 3000, proceeds: 4200, realizedPnl: 1200, outcome: "closed_profit", daysHeld: 92, returnPct: 0.4, annualized: 1.59 },
  ],
};

export const exampleCoveredFile: ClosedCoveredFile = {
  meta: META,
  closed: [
    { id: "ex-cc1", symbol: "AAPL", name: "Apple", strike: 200, expiration: "2026-02-20", openedAt: "2026-01-20", closedAt: "2026-02-20", contracts: 2, creditPerShare: 3.0, creditReceived: 600, costToClose: 0, realizedPnl: 600, outcome: "expired", daysHeld: 31, returnOnNotional: 0.015, annualized: 0.177 },
    { id: "ex-cc2", symbol: "CLS", name: "Celestica", strike: 130, expiration: "2026-03-20", openedAt: "2026-02-25", closedAt: "2026-03-20", contracts: 1, creditPerShare: 5.0, creditReceived: 500, costToClose: 0, realizedPnl: 500, outcome: "expired", daysHeld: 23, returnOnNotional: 0.0385, annualized: 0.611 },
    { id: "ex-cc3", symbol: "NVDA", name: "NVIDIA", strike: 130, expiration: "2026-04-17", openedAt: "2026-03-18", closedAt: "2026-04-02", contracts: 1, creditPerShare: 4.0, creditReceived: 400, costToClose: 650, realizedPnl: -250, outcome: "closed_loss", daysHeld: 15, returnOnNotional: -0.0192, annualized: -0.468 },
    { id: "ex-cc4", symbol: "INTC", name: "Intel", strike: 25, expiration: "2026-05-15", openedAt: "2026-04-20", closedAt: "2026-05-15", contracts: 2, creditPerShare: 0.5, creditReceived: 100, costToClose: 0, realizedPnl: 100, outcome: "expired", daysHeld: 25, returnOnNotional: 0.02, annualized: 0.292 },
  ],
};

export const exampleSpreadFile: ClosedSpreadFile = {
  meta: META,
  closed: [
    { id: "ex-s1", symbol: "GOOGL", name: "Alphabet", optionType: "put", shortStrike: 160, longStrike: 150, width: 10, expiration: "2026-03-20", openedAt: "2026-02-10", closedAt: "2026-03-20", contracts: 1, isCredit: true, netCreditPerShare: 3.0, netOpen: 300, netClose: 0, realizedPnl: 300, maxRisk: 700, outcome: "closed_profit", daysHeld: 38, returnOnRisk: 0.429, annualized: 4.12 },
    { id: "ex-s2", symbol: "NVDA", name: "NVIDIA", optionType: "call", shortStrike: 140, longStrike: 150, width: 10, expiration: "2026-04-17", openedAt: "2026-03-15", closedAt: "2026-04-10", contracts: 2, isCredit: true, netCreditPerShare: 2.5, netOpen: 500, netClose: 900, realizedPnl: -400, maxRisk: 1500, outcome: "closed_loss", daysHeld: 26, returnOnRisk: -0.267, annualized: -3.74 },
    { id: "ex-s3", symbol: "AAPL", name: "Apple", optionType: "put", shortStrike: 210, longStrike: 200, width: 10, expiration: "2026-05-15", openedAt: "2026-04-18", closedAt: "2026-05-15", contracts: 1, isCredit: true, netCreditPerShare: 2.2, netOpen: 220, netClose: 0, realizedPnl: 220, maxRisk: 780, outcome: "closed_profit", daysHeld: 27, returnOnRisk: 0.282, annualized: 3.81 },
  ],
};

export const exampleStockFile: ClosedStockFile = {
  meta: META,
  closed: [
    { id: "ex-st1", symbol: "NVDA", name: "NVIDIA", side: "long", shares: 100, avgOpen: 95, avgClose: 128, costBasis: 9500, proceeds: 12800, realizedPnl: 3300, outcome: "closed_profit", openedAt: "2026-01-10", closedAt: "2026-04-15", daysHeld: 95, returnPct: 0.347, annualized: 1.33 },
    { id: "ex-st2", symbol: "MU", name: "Micron Technology", side: "long", shares: 100, avgOpen: 100, avgClose: 92, costBasis: 10000, proceeds: 9200, realizedPnl: -800, outcome: "closed_loss", openedAt: "2026-02-15", closedAt: "2026-03-25", daysHeld: 38, returnPct: -0.08, annualized: -0.77 },
    { id: "ex-st3", symbol: "AAPL", name: "Apple", side: "long", shares: 50, avgOpen: 175, avgClose: 205, costBasis: 8750, proceeds: 10250, realizedPnl: 1500, outcome: "closed_profit", openedAt: "2026-01-20", closedAt: "2026-05-10", daysHeld: 110, returnPct: 0.171, annualized: 0.568 },
    { id: "ex-st4", symbol: "SOFI", name: "SoFi Technologies", side: "long", shares: 500, avgOpen: 9.5, avgClose: 13, costBasis: 4750, proceeds: 6500, realizedPnl: 1750, outcome: "closed_profit", openedAt: "2026-02-01", closedAt: "2026-06-01", daysHeld: 120, returnPct: 0.368, annualized: 1.12 },
    { id: "ex-st5", symbol: "CLS", name: "Celestica", side: "long", shares: 60, avgOpen: 115, avgClose: 108, costBasis: 6900, proceeds: 6480, realizedPnl: -420, outcome: "closed_loss", openedAt: "2026-03-10", closedAt: "2026-04-05", daysHeld: 26, returnPct: -0.0609, annualized: -0.85 },
  ],
};
