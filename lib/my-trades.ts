// Server-side loader for the My Trades scorecard (data/my-trades.json) —
// same shape as lib/score-factors.ts.
import fs from "node:fs";
import path from "node:path";
import type { MyTradesFile } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleMyTradesFile } from "./example";

export const MY_TRADES_PATH = path.join(process.cwd(), "data", "my-trades.json");

export const EMPTY_MY_TRADES: MyTradesFile = {
  meta: { generatedAt: "", minSample: 10, tradeCount: 0, matchedCount: 0, capturedSince: "" },
  trades: [],
  factors: [],
  ivrBuckets: [],
  vrpBuckets: [],
  guidelines: [],
  management: { closeReason: [], profitCaptured: [], holdFraction: [], alertResponse: [] },
  regime: [],
  earnings: [],
  concurrency: [],
  sizing: [],
  rollChains: [],
  leaps: {
    trades: [], guidelines: [], regime: [], ivrBuckets: [], hold: [],
    pccAtOpenBuckets: [], pccAtCloseBuckets: [], pccAtOpenCorrelation: null, pccAtCloseCorrelation: null,
    pccAlertResponseBuckets: [],
  },
};

export async function getMyTrades(): Promise<MyTradesFile> {
  if (await isExampleMode()) return exampleMyTradesFile;
  try {
    const raw = fs.readFileSync(MY_TRADES_PATH, "utf8");
    const parsed = JSON.parse(raw) as MyTradesFile;
    if (Array.isArray(parsed?.trades) && parsed.management) {
      return { ...parsed, leaps: parsed.leaps ?? EMPTY_MY_TRADES.leaps };
    }
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY_MY_TRADES;
}
