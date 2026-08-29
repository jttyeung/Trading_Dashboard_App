// Server-side loader for screened LEAPS/CC/LONG_PUT/BEAR_MKT_PUT candidates
// (data/single-leg-candidates.json), written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { SingleLegCandidatesFile } from "./types";

export const SINGLE_LEG_CANDIDATES_PATH = path.join(process.cwd(), "data", "single-leg-candidates.json");

const EMPTY: SingleLegCandidatesFile = {
  meta: { generatedAt: "", pricesAsOf: "", dteBasis: "", universe: "" },
  candidates: [],
};

export function getSingleLegCandidates(): SingleLegCandidatesFile {
  try {
    const raw = fs.readFileSync(SINGLE_LEG_CANDIDATES_PATH, "utf8");
    const parsed = JSON.parse(raw) as SingleLegCandidatesFile;
    if (parsed?.candidates && Array.isArray(parsed.candidates)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
