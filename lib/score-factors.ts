// Server-side loader for the score-factor scorecard
// (data/score-factors.json) — same shape as lib/strategy-performance.ts.
import fs from "node:fs";
import path from "node:path";
import type { ScoreFactorsFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleScoreFactorsFile } from "./example";

export const SCORE_FACTORS_PATH = path.join(process.cwd(), "data", "score-factors.json");

const EMPTY: ScoreFactorsFile = {
  meta: { generatedAt: "", minSample: 10 },
  groups: [],
};

export async function getScoreFactors(): Promise<ScoreFactorsFile> {
  if (await isExampleMode()) return exampleScoreFactorsFile;
  try {
    const raw = fs.readFileSync(SCORE_FACTORS_PATH, "utf8");
    const parsed = JSON.parse(raw) as ScoreFactorsFile;
    if (Array.isArray(parsed?.groups)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
