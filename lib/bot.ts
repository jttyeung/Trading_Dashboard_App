// Server-side loader for the three paper-trading review tables
// (data/bot/general.json, data/bot/20-delta-safe.json,
// data/bot/aggressive.json), written by OptionsEvaluator's
// internal/export/paperbot.go. No example-mode data yet — an empty
// table is an honest state for a feature this new either way.
import fs from "node:fs";
import path from "node:path";
import type { BotSnapshot } from "./types";

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
  return loadBotFile("general.json");
}

export async function get20DeltaSafeBot(): Promise<BotSnapshot> {
  return loadBotFile("20-delta-safe.json");
}

export async function getAggressiveBot(): Promise<BotSnapshot> {
  return loadBotFile("aggressive.json");
}
