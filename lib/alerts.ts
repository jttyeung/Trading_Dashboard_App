// Server-side loader for active position alerts (data/alerts.json),
// written by the data bridge.
import fs from "node:fs";
import path from "node:path";
import type { AlertsFile } from "./types";

export const ALERTS_PATH = path.join(process.cwd(), "data", "alerts.json");

const EMPTY: AlertsFile = {
  meta: { generatedAt: "" },
  alerts: [],
};

export function getAlerts(): AlertsFile {
  try {
    const raw = fs.readFileSync(ALERTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as AlertsFile;
    if (parsed?.alerts && Array.isArray(parsed.alerts)) return parsed;
  } catch {
    // file missing or malformed — return empty
  }
  return EMPTY;
}
