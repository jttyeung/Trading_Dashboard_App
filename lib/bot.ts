// Server-side loader for the three paper-trading review tables
// (data/bot/general.json, data/bot/20-delta-safe.json,
// data/bot/aggressive.json), written by OptionsEvaluator's
// internal/export/paperbot.go.
//
// Example mode returns a small, frozen, hand-written sample (lib/example.ts)
// instead of the real file — a real gap caught live: these three tables
// used to have no example-mode data at all, so toggling "Example mode"
// showed the account holder's own real watchlist tickers, real
// strikes/premiums, AND their real approve/reject judgments and "Mine"
// picks regardless of the toggle. The example data below deliberately
// omits both: every trade is frozen at status="pending_approval" and
// personallySelected=false, never real decision state.
import fs from "node:fs";
import path from "node:path";
import type { BotSnapshot } from "./types";
import { isExampleMode } from "./example-mode";
import { exampleGeneralBot, example20DeltaSafeBot, exampleAggressiveBot } from "./example";

const EMPTY: BotSnapshot = {
  generatedAt: "",
  bot: "",
  trades: [],
  myGrade: { goodCalls: 0, riskRealized: 0, missedWins: 0, goodPasses: 0, ungraded: 0 },
};

function loadBotFile(filename: string): BotSnapshot {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "bot", filename), "utf8");
    const parsed = JSON.parse(raw) as BotSnapshot;
    if (parsed?.trades && Array.isArray(parsed.trades)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}

export async function getGeneralBot(): Promise<BotSnapshot> {
  if (await isExampleMode()) return exampleGeneralBot();
  return loadBotFile("general.json");
}

export async function get20DeltaSafeBot(): Promise<BotSnapshot> {
  if (await isExampleMode()) return example20DeltaSafeBot();
  return loadBotFile("20-delta-safe.json");
}

export async function getAggressiveBot(): Promise<BotSnapshot> {
  if (await isExampleMode()) return exampleAggressiveBot();
  return loadBotFile("aggressive.json");
}
