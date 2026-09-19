// FOMC awareness (OptionsEvaluator) — the upcoming Fed meeting
// calendar and what CME 30-Day Fed Funds futures price into each one. The
// backend derives the per-meeting read (pre/post rate, expected change);
// this file only shapes it for display. Pure functions, no I/O — the loader
// is lib/fomc-data.ts.
//
// Informational only: an FOMC decision is a reason to look at what expires
// across it, not something any screener gates on.

export type FomcLabel = "hike" | "cut" | "hold" | "";

export interface FomcMeeting {
  start: string; // YYYY-MM-DD, first day of the two-day meeting
  decision: string; // YYYY-MM-DD, statement day (~2pm ET); a new rate applies the next day
  sep: boolean; // comes with a Summary of Economic Projections (the dot plot)
  impliedPreRate: number | null; // percent
  impliedPostRate: number | null; // percent
  changeBp: number | null; // post − pre, basis points
  prob25: number | null; // 0–1 odds of one 25bp move (|changeBp|/25, capped)
  label: FomcLabel; // "" when the futures strip couldn't anchor this month
}

export interface FomcStrip {
  symbol: string; // e.g. "/ZQV26"
  month: string; // YYYY-MM delivery month
  price: number;
  impliedRate: number; // 100 − price
}

export interface FomcFile {
  asof: string;
  source: string;
  meetings: FomcMeeting[];
  strip: FomcStrip[];
}

// daysUntil counts calendar days from `today` (a YYYY-MM-DD) to the
// decision date — 0 on the day itself, negative once it's passed (the file
// is refreshed every few hours, so a passed meeting lingers briefly).
export function daysUntil(dateISO: string, todayISO: string): number {
  const d = Date.UTC(+dateISO.slice(0, 4), +dateISO.slice(5, 7) - 1, +dateISO.slice(8, 10));
  const t = Date.UTC(+todayISO.slice(0, 4), +todayISO.slice(5, 7) - 1, +todayISO.slice(8, 10));
  return Math.round((d - t) / 86_400_000);
}

// nextMeeting is the first meeting whose decision hasn't passed.
export function nextMeeting(file: FomcFile, todayISO: string): FomcMeeting | null {
  return file.meetings.find((m) => daysUntil(m.decision, todayISO) >= 0) ?? null;
}

export const FOMC_LABEL_TEXT: Record<FomcLabel, string> = {
  hike: "Hike priced",
  cut: "Cut priced",
  hold: "Hold priced",
  "": "No read",
};

// Chip tones follow the app's existing vocabulary: amber for the hawkish
// surprise risk a hike carries for short premium, sky for a cut, slate for
// hold / unknown.
export const FOMC_LABEL_COLORS: Record<FomcLabel, { chip: string; text: string }> = {
  hike: { chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30", text: "text-amber-300" },
  cut: { chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30", text: "text-sky-300" },
  hold: { chip: "bg-slate-500/15 text-slate-300 ring-slate-500/30", text: "text-slate-300" },
  "": { chip: "bg-slate-500/10 text-muted ring-slate-500/20", text: "text-muted" },
};

// oddsText renders the futures read as a sentence fragment, e.g.
// "90% odds of a 25bp hike · 3.63% → 3.86%". Past one full move the odds
// stop meaning anything, so the expected change itself is shown instead.
export function oddsText(m: FomcMeeting): string {
  if (m.changeBp == null || m.prob25 == null || m.impliedPreRate == null || m.impliedPostRate == null) {
    return "Futures strip doesn't anchor this meeting yet";
  }
  const path = `${m.impliedPreRate.toFixed(2)}% → ${m.impliedPostRate.toFixed(2)}%`;
  const dir = m.changeBp > 0 ? "hike" : m.changeBp < 0 ? "cut" : "move";
  if (Math.abs(m.changeBp) >= 25) {
    return `${Math.abs(m.changeBp).toFixed(0)}bp of ${dir}s priced · ${path}`;
  }
  return `${Math.round(m.prob25 * 100)}% odds of a 25bp ${dir} · ${path}`;
}

// fmtMeetingDates renders "Sep 15–16" (or "Dec 31–Jan 1" across a month).
export function fmtMeetingDates(m: FomcMeeting): string {
  const md = (iso: string) =>
    new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const a = md(m.start);
  const b = md(m.decision);
  const sameMonth = m.start.slice(0, 7) === m.decision.slice(0, 7);
  return sameMonth ? `${a}–${b.split(" ")[1]}` : `${a}–${b}`;
}

// daysText is the countdown copy the card leads with — callers prefix
// "Decision " where the subject isn't already obvious.
export function daysText(days: number): string {
  if (days < 0) return "passed";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
