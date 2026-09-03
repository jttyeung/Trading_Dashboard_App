// Server-side loader for the unified real+paper performance comparison
// (data/strategy-performance.json), written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { StrategyPerformanceFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleStrategyPerformanceFile } from "./example";

export const STRATEGY_PERFORMANCE_PATH = path.join(process.cwd(), "data", "strategy-performance.json");

const EMPTY: StrategyPerformanceFile = {
  meta: { generatedAt: "" },
  rows: [],
};

export async function getStrategyPerformance(): Promise<StrategyPerformanceFile> {
  if (await isExampleMode()) return exampleStrategyPerformanceFile;
  try {
    const raw = fs.readFileSync(STRATEGY_PERFORMANCE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StrategyPerformanceFile;
    if (Array.isArray(parsed?.rows)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
