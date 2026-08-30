// Server-side loader for the frozen-portfolio-vs-S&P-500 comparison
// (data/benchmark.json), written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { BenchmarkFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleBenchmarkFile } from "./example";

export const BENCHMARK_PATH = path.join(process.cwd(), "data", "benchmark.json");

const EMPTY: BenchmarkFile = {
  meta: { generatedAt: "", cutoffDate: "", frozenHoldings: {}, frozenCash: 0, note: "" },
  frozen: [],
  spy: [],
  actualToday: 0,
  actualGrowing: [],
};

export async function getBenchmark(): Promise<BenchmarkFile> {
  if (await isExampleMode()) return exampleBenchmarkFile;
  try {
    const raw = fs.readFileSync(BENCHMARK_PATH, "utf8");
    const parsed = JSON.parse(raw) as BenchmarkFile;
    if (parsed?.meta && Array.isArray(parsed.frozen)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
