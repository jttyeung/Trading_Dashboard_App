// The Auto Trader comparison page's data: data/autotrader/report.json,
// written by OptionsEvaluator's export each cycle (internal/export/
// autotrader_report.go mirrors these types). Four paper accounts, one per
// put strategy, each trading its own rules from $250k with no human step;
// their positions and closed trades are ordinary accounts in the switcher
// (data/autotrader/snapshot.json), typed "paper" so All Accounts never
// counts them. Server-only (touches the filesystem).
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./data-dirs";

export const AUTOTRADER_REPORT_PATH = path.join(DATA_DIR, "autotrader", "report.json");

export interface PctPoint {
  date: string; // YYYY-MM-DD
  pct: number; // fraction: 0.012 = +1.2%
}

export interface AutotraderLogEntry {
  at: string; // ISO
  kind: string; // sell_put | buy_to_close | assigned | expired | called_away | sell_call | buy_call | ...
  symbol: string;
  text: string;
  amount: number | null; // realized P&L on a closing event, else the cash it moved
  rule: string;
}

export interface AutotraderAccount {
  id: string; // the account id in the switcher
  key: string; // general | safe | aggressive | quant
  label: string;
  strategy: string;
  rules: string;
  startedAt: string;
  days: number;
  startingCash: number;
  value: number;
  cash: number;
  pnl: number;
  returnPct: number;
  annualizedPct: number | null; // null until 30 days in
  spyReturnPct: number | null;
  vsSpyPct: number | null;
  realized: number;
  unrealized: number;
  maxDrawdownPct: number; // <= 0
  closedTrades: number;
  winRatePct: number | null;
  avgDaysHeld: number | null;
  deployedPct: number;
  open: { puts: number; calls: number; shareLots: number; leaps: number };
  series: PctPoint[];
  log: AutotraderLogEntry[]; // newest first
}

export interface AutotraderReport {
  meta: { generatedAt: string; spyAsOf?: string };
  accounts: AutotraderAccount[];
  spy: PctPoint[];
}

export function readAutotraderReport(): AutotraderReport | null {
  try {
    const doc = JSON.parse(fs.readFileSync(AUTOTRADER_REPORT_PATH, "utf8")) as AutotraderReport;
    return Array.isArray(doc?.accounts) && doc.accounts.length > 0 ? doc : null;
  } catch {
    return null;
  }
}
