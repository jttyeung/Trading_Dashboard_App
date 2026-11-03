// Server-side loader for the SPX P/L calendar (data/spx-pnl.json, written by
// OptionsEvaluator's export/spx_pnl.go). Real trades, so example mode gets an
// empty calendar rather than anyone's actual days.
import fs from "node:fs";
import path from "node:path";
import { isExampleMode } from "./example-mode";

export interface SpxPnlDay {
  date: string; // YYYY-MM-DD
  net: number; // after fees
  gross: number;
  fees: number;
  trades: number;
  winners: number;
}
export interface SpxPnlFile {
  meta: { generatedAt: string; source: string };
  days: SpxPnlDay[];
}

export const EMPTY_SPX_PNL: SpxPnlFile = { meta: { generatedAt: "", source: "" }, days: [] };

export async function getSpxPnl(): Promise<SpxPnlFile> {
  if (await isExampleMode()) return EMPTY_SPX_PNL;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "spx-pnl.json"), "utf8")) as SpxPnlFile;
    if (Array.isArray(parsed?.days)) return parsed;
  } catch {
    // file missing or malformed — empty calendar
  }
  return EMPTY_SPX_PNL;
}
