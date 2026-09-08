// Shared plain-calendar-date helpers. Deliberately never touch the local
// Date API's own timezone for a YYYY-MM-DD string -- parsed and read back
// in UTC so it can't drift a day off in a negative-UTC-offset browser,
// the same footgun PnlView's own fmtDate avoids by not touching the Date
// API at all for a plain calendar-date string.
import { etDateString } from "@/lib/market-hours";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Short weekday label for a YYYY-MM-DD date. Used to label a value
// carried forward from an earlier session ("as of Fri") as not actually
// today's, so getting this off by a day would misrepresent which real
// trading day the number/alert is from.
export function fmtWeekdayShort(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return WEEKDAYS_SHORT[d.getUTCDay()] ?? dateISO;
}

// isStaleTradingDate reports whether a backend timestamp (SQLite's
// `datetime('now')`, e.g. "2026-09-07 17:14:15" -- space-separated, UTC,
// no zone suffix) is from an earlier America/New_York trading day than
// right now.
//
// Compares real ET calendar dates (via etDateString, the same helper
// MarketCountdown's own holiday-aware countdown uses) rather than a raw
// UTC day, on purpose: after ~8pm ET, UTC has already rolled to
// tomorrow's date while the trading day that just ended is still
// "today" in every sense that matters here -- a naive UTC compare would
// mislabel that evening's own alerts as stale.
export function isStaleTradingDate(sqliteDatetimeUTC: string, now: Date = new Date()): boolean {
  // Treat the string as UTC explicitly: browsers don't agree on how to
  // parse SQLite's space-separated, zone-less format otherwise (some
  // read it as local time).
  const evaluatedAt = new Date(sqliteDatetimeUTC.replace(" ", "T") + "Z");
  if (isNaN(evaluatedAt.getTime())) return false; // unparseable -- don't guess it's stale
  return etDateString(evaluatedAt) !== etDateString(now);
}
