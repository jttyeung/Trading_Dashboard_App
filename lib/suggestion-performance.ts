// Server-side loader for the suggestion-vs-actual-performance scorecard
// (data/suggestion-performance.json), written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { SuggestionPerformanceFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleSuggestionPerformanceFile } from "./example";

export const SUGGESTION_PERFORMANCE_PATH = path.join(process.cwd(), "data", "suggestion-performance.json");

const EMPTY: SuggestionPerformanceFile = {
  meta: { generatedAt: "", totalSuggestions: 0 },
  matched: [],
};

export async function getSuggestionPerformance(): Promise<SuggestionPerformanceFile> {
  if (await isExampleMode()) return exampleSuggestionPerformanceFile;
  try {
    const raw = fs.readFileSync(SUGGESTION_PERFORMANCE_PATH, "utf8");
    const parsed = JSON.parse(raw) as SuggestionPerformanceFile;
    if (Array.isArray(parsed?.matched)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
