// Server-side loader for the FOMC snapshot (data/fomc.json), written by
// OptionsEvaluator's FOMC agent every few hours from the fed funds futures
// strip. Missing or malformed reads as null and the card simply doesn't
// render — same graceful fallback vix.json gets.
import fs from "node:fs";
import path from "node:path";
import type { FomcFile } from "./fomc";
import { exampleFomc } from "./example-fomc";

export const FOMC_PATH = path.join(process.cwd(), "data", "fomc.json");

export function getFomc(example = false): FomcFile | null {
  if (example) return exampleFomc();
  try {
    const raw = fs.readFileSync(FOMC_PATH, "utf8");
    const parsed = JSON.parse(raw) as FomcFile;
    if (Array.isArray(parsed?.meetings) && Array.isArray(parsed?.strip)) return parsed;
  } catch {
    /* missing/malformed */
  }
  return null;
}
