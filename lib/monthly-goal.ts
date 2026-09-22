// Server-side loader for the Monthly Goal card (data/monthly-goal.json),
// written by the data bridge — same pattern as lib/portfolio-risk.ts.
import fs from "node:fs";
import path from "node:path";
import type { MonthlyGoalFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleMonthlyGoalFile } from "./example";

export const MONTHLY_GOAL_PATH = path.join(process.cwd(), "data", "monthly-goal.json");

const EMPTY: MonthlyGoalFile = {
  meta: { generatedAt: "" },
  realizedThisMonth: 0,
  targetPercent: 3,
  floorPercent: 2,
  asOfDate: "",
  daysInMonth: 30,
  portfolioValueBaseline: 0,
  collateralAtWork: 0,
  history: [],
};

export async function getMonthlyGoal(): Promise<MonthlyGoalFile> {
  if (await isExampleMode()) return exampleMonthlyGoalFile;
  try {
    const raw = fs.readFileSync(MONTHLY_GOAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as MonthlyGoalFile;
    // history arrived after the rest of this file's fields, so a daemon
    // that predates it writes no key at all -- and an account with no
    // recorded month writes null. MonthlyGoalCard reads history.length,
    // so either one 500s the whole page from one missing array.
    if (parsed?.asOfDate) return { ...parsed, history: parsed.history ?? [] };
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
