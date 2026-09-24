// Server-side loader for data/ytd-returns.json — same shape as
// lib/score-factors.ts.
import fs from "node:fs";
import path from "node:path";
import type { YtdReturnsFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleYtdReturnsFile } from "./example";

export const YTD_RETURNS_PATH = path.join(process.cwd(), "data", "ytd-returns.json");

const EMPTY: YtdReturnsFile = {
  meta: { generatedAt: "", year: 0, latestDate: "" },
  returns: [],
};

export async function getYtdReturns(): Promise<YtdReturnsFile> {
  if (await isExampleMode()) return exampleYtdReturnsFile;
  try {
    const raw = fs.readFileSync(YTD_RETURNS_PATH, "utf8");
    const parsed = JSON.parse(raw) as YtdReturnsFile;
    if (Array.isArray(parsed?.returns)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
