// Server-side loader for the suggest engine's current short-put picks
// (data/csp-picks.json), written by the data bridge -- same shape and
// example-mode gating as lib/csp-candidates.ts.
import fs from "node:fs";
import path from "node:path";
import type { CspPicksFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleCspPicksFile } from "./example";

export const CSP_PICKS_PATH = path.join(process.cwd(), "data", "csp-picks.json");

const EMPTY: CspPicksFile = { meta: { generatedAt: "", suggestedAt: "" }, picks: [] };

export async function getCspPicks(): Promise<CspPicksFile> {
  if (await isExampleMode()) return exampleCspPicksFile;
  try {
    const raw = fs.readFileSync(CSP_PICKS_PATH, "utf8");
    const parsed = JSON.parse(raw) as CspPicksFile;
    if (parsed?.picks && Array.isArray(parsed.picks)) return parsed;
  } catch {
    // file missing or malformed -- return empty
  }
  return EMPTY;
}
