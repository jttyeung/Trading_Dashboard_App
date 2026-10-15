// Signal alerts across the approved list: each name's two-year daily chart
// (Yahoo, like Chart-a-Ticker), run through lib/chart-signals.ts, saved to
// data/signal-alerts.json. A scan walks the list one name at a time with a short pause
// so Yahoo isn't hammered; it re-runs on its own when the file is over four
// hours old and someone opens the page, or on demand from the Refresh button.
//
// Kept separate from lib/alerts.ts (data/alerts.json), which is the data
// bridge's per-position risk/action alerts — an unrelated feature that
// happens to share the word "alerts".
//
// Server-only (filesystem + network).
import fs from "node:fs";
import path from "node:path";
import { getResearch } from "./research";
import { buildChartData } from "./chart-indicators";
import { detectSignals, type SignalEvent } from "./chart-signals";
import { exampleChartData } from "./example";
import { fetchYahooBars } from "./yahoo-bars";

// Your Google-Sheets-driven watchlist (research.json's own ticker keys) — the
// same universe Research screens, not a separate curated/approved list.
function watchlistSymbols(example = false): string[] {
  const data = getResearch(example);
  return data ? Object.keys(data.tickers) : [];
}

export const SIGNAL_ALERTS_PATH = path.join(process.cwd(), "data", "signal-alerts.json");
export const LOOKBACK_BARS = 20;
const STALE_MS = 4 * 60 * 60 * 1000;
const PAUSE_MS = 300;

export interface SignalAlertsFile {
  asOf: string; // ISO — when the scan finished
  lastBar: string; // newest bar date seen (YYYY-MM-DD)
  lookback: number;
  scanned: number;
  failed: string[];
  events: SignalEvent[]; // newest first
}

export function readSignalAlerts(): SignalAlertsFile | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(SIGNAL_ALERTS_PATH, "utf8")) as SignalAlertsFile;
    return Array.isArray(parsed.events) ? parsed : null;
  } catch {
    return null;
  }
}

export function isStale(f: SignalAlertsFile | null): boolean {
  return !f || Date.now() - Date.parse(f.asOf) > STALE_MS;
}

function sortEvents(events: SignalEvent[]): SignalEvent[] {
  return events.sort((a, b) => (a.date === b.date ? a.symbol.localeCompare(b.symbol) : a.date < b.date ? 1 : -1));
}

let running: Promise<SignalAlertsFile> | null = null;

export function signalAlertsRunning(): boolean {
  return running !== null;
}

/** Start a scan (or join the one already running). */
export function refreshSignalAlerts(): Promise<SignalAlertsFile> {
  if (running) return running;
  running = scan().finally(() => {
    running = null;
  });
  return running;
}

async function scan(): Promise<SignalAlertsFile> {
  const symbols = watchlistSymbols();
  const events: SignalEvent[] = [];
  const failed: string[] = [];
  let lastBar = "";
  for (const sym of symbols) {
    try {
      const r = await fetchYahooBars(sym);
      if ("error" in r) failed.push(sym);
      else {
        const d = buildChartData(sym, r.bars);
        const last = d.dates[d.dates.length - 1] ?? "";
        if (last > lastBar) lastBar = last;
        events.push(...detectSignals(d, LOOKBACK_BARS));
      }
    } catch {
      failed.push(sym);
    }
    await new Promise((res) => setTimeout(res, PAUSE_MS));
  }
  const file: SignalAlertsFile = {
    asOf: new Date().toISOString(),
    lastBar,
    lookback: LOOKBACK_BARS,
    scanned: symbols.length,
    failed,
    events: sortEvents(events),
  };
  fs.mkdirSync(path.dirname(SIGNAL_ALERTS_PATH), { recursive: true });
  fs.writeFileSync(SIGNAL_ALERTS_PATH, JSON.stringify(file), "utf8");
  return file;
}

/** Example mode: the same detection over the synthetic chart fixture, nothing fetched or written. */
export function exampleSignalAlerts(): SignalAlertsFile {
  const symbols = watchlistSymbols(true);
  const events: SignalEvent[] = [];
  let lastBar = "";
  for (const sym of symbols) {
    const d = exampleChartData(sym);
    const last = d.dates[d.dates.length - 1] ?? "";
    if (last > lastBar) lastBar = last;
    events.push(...detectSignals(d, LOOKBACK_BARS));
  }
  return { asOf: new Date().toISOString(), lastBar, lookback: LOOKBACK_BARS, scanned: symbols.length, failed: [], events: sortEvents(events) };
}
