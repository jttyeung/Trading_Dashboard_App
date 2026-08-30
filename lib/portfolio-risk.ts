// Server-side loader for RULE-006/011 portfolio risk (data/portfolio-risk.json),
// written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { PortfolioRiskFile } from "./types";
import { isExampleMode } from "./example-mode";
import { examplePortfolioRiskFile } from "./example";

export const PORTFOLIO_RISK_PATH = path.join(process.cwd(), "data", "portfolio-risk.json");

const EMPTY: PortfolioRiskFile = {
  meta: { generatedAt: "" },
  overall: {
    thetaToday: 0,
    thetaPct: 0,
    thetaStatus: "unknown",
    thetaMinPct: 0,
    thetaTargetMaxPct: 0,
    thetaMaxPct: 0,
    sectorValues: {},
    maxSectorAllocationPct: 0,
    portfolioValue: 0,
  },
  perAccount: [],
};

export async function getPortfolioRisk(): Promise<PortfolioRiskFile> {
  if (await isExampleMode()) return examplePortfolioRiskFile;
  try {
    const raw = fs.readFileSync(PORTFOLIO_RISK_PATH, "utf8");
    const parsed = JSON.parse(raw) as PortfolioRiskFile;
    if (parsed?.overall) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
