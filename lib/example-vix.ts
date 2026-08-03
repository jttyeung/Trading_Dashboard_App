// Example-mode VIX/volatility snapshot. Feeds the VIX tab and the home
// "Volatility & Positioning" card. Values agree with the Brief's regime
// (VIX ~16, contango, constructive breadth) so the demo is internally consistent.
import type { VixSnapshot } from "./vix";

export const exampleVix: VixSnapshot = {
  asof: "2026-06-18T20:00:00Z",
  source: "example",
  inputs: {
    vix: 16.2,
    vix9d: 15.1,
    vix3m: 17.6,
    vvix: 92,
    skew: 142,
    realizedVol20: 0.12,
    realizedVol30: 0.13,
    realizedVolBasis: "SPY 20/30-day close-to-close",
    s5fi: 62,
    s5fiSlopeWk: 1.4,
    s5fiWeekly: [44, 49, 53, 57, 60, 62],
  },
};
