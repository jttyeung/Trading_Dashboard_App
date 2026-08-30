// Server-side loader for screened credit/debit spread + PMCC candidates
// (data/spread-candidates.json), written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { SpreadCandidatesFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleSpreadCandidatesFile } from "./example";

export const SPREAD_CANDIDATES_PATH = path.join(process.cwd(), "data", "spread-candidates.json");

const EMPTY: SpreadCandidatesFile = {
  meta: { generatedAt: "", pricesAsOf: "", dteBasis: "", universe: "" },
  candidates: [],
};

export async function getSpreadCandidates(): Promise<SpreadCandidatesFile> {
  if (await isExampleMode()) return exampleSpreadCandidatesFile;
  try {
    const raw = fs.readFileSync(SPREAD_CANDIDATES_PATH, "utf8");
    const parsed = JSON.parse(raw) as SpreadCandidatesFile;
    if (parsed?.candidates && Array.isArray(parsed.candidates)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
