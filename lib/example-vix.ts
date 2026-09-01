// Example-mode VIX/volatility snapshot. Feeds the VIX tab and the home
// "Volatility & Positioning" card when there's no bridge writing data/vix.json —
// a public demo deployment, most of all.
//
// Levels are a real market reading rather than invented ones, so the posture the
// app derives from them (regime band, cash target, VRP) is a genuine example of
// the framework at work. asof is stamped at load so the demo reads as current.
import type { VixSnapshot } from "./vix";

export const exampleVix: VixSnapshot = {
  asof: new Date().toISOString(),
  source: "example",
  inputs: {
    vix: 15.13,
    vix9d: 13.9,
    vix3m: 18.5,
    vvix: 86.27,
    skew: 141,
    realizedVol20: 0.118,
    realizedVol30: 0.126,
    realizedVolBasis: "SPY 20/30-day close-to-close",
    // Share of S&P 500 names above their own 50-day SMA, with recent weekly closes
    // trailing slightly lower — the top of the "no trend" zone.
    s5fi: 58.1,
    s5fiSlopeWk: -0.35,
    s5fiWeekly: [61.4, 60.2, 62.0, 59.3, 60.1, 58.4, 59.0, 58.1],
    // Nasdaq-100 Volatility Index — a real reading (captured separately from
    // the VIX value above), for the VIX/VXN divergence read in lib/vxn.ts.
    vxn: 20.18,
  },
};
