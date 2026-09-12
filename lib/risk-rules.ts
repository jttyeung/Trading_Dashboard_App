// Portfolio-risk thresholds. Kept in one place and copied INTO the computed
// PortfolioRisk result (see lib/portfolio-risk.ts) so every gauge reads its
// bands from the same object as the value it judges — the UI never hardcodes
// a threshold of its own.
//
// Theta bands are a share of total portfolio value per day: below 0.05% the
// book isn't earning enough time decay to matter, 0.05–0.10% is the target,
// up to 0.20% is running hot, and past 0.20% is the hard ceiling. The sector
// cap is the maximum share of capital (stock value + CSP collateral + LEAP /
// spread capital) in any one sector. The open-P&L floor is the unrealized
// drawdown, as a share of portfolio value, past which the book needs a look.
import type { RiskRules } from "./types";

export const RISK_RULES: RiskRules = {
  theta: { minPct: 0.0005, targetMaxPct: 0.001, maxPct: 0.002 },
  sector: { maxAllocationPct: 0.3 },
  openPnl: { minPct: -0.1 },
};

// Label the dashboard shows for capital whose ticker has no sector yet — either
// Yahoo returned none, or the bridge hasn't looked it up. Add the ticker to
// `overrides` in data/sectors.json to classify it by hand.
export const UNCLASSIFIED = "Unclassified";
