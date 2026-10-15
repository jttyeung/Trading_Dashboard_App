// The pace car: the bridge's pace_car.py runs a benchmark (SPY by default) beside
// each account from its first logged day, buying and selling benchmark shares with
// the account's own deposits and withdrawals, and writes data/pace-car.json. This
// reads it (every bridge's data dir, like the snapshots) and can sum the members
// of a Combined View by date. Server-only.
import { readAllJson } from "@/lib/data-dirs";

export interface PacePoint {
  date: string;
  book: number;
  pace: number;
  close: number;
}
export interface PaceFlow {
  id?: string | number | null;
  date: string;
  amount: number; // + deposit, − withdrawal
  type?: string;
  description?: string;
}
export interface PaceSummary {
  book: number;
  pace: number;
  bookGain: number;
  paceGain: number;
  bookGainPct: number;
  paceGainPct: number;
  vsPace: number;
  vsPacePct: number;
  todayBook: number;
  todayPace: number;
  todayVsPace: number;
  flowsIn: number;
  flowsOut: number;
  days: number;
}
export interface PaceAccount {
  since: string;
  startValue: number | null;
  flows: PaceFlow[];
  series: PacePoint[];
  summary: PaceSummary | Record<string, never>;
}
export interface PaceFile {
  meta: { asOf: string; benchmark: string; lastClose: string | null };
  accounts: Record<string, PaceAccount>;
}

export function readPaceCar(): PaceFile | null {
  const parts = readAllJson<PaceFile>("pace-car.json").filter((p) => p?.accounts && typeof p.accounts === "object");
  if (parts.length === 0) return null;
  const out: PaceFile = { meta: parts[0].meta, accounts: {} };
  for (const p of parts) {
    if (p.meta.asOf > out.meta.asOf) out.meta = p.meta;
    Object.assign(out.accounts, p.accounts);
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Sum several accounts' pace series by date (dates every member has), with the
 *  flows concatenated, and a summary recomputed the way the bridge does it. */
export function combinePace(members: PaceAccount[]): PaceAccount | null {
  const live = members.filter((m) => m.series.length > 0);
  if (live.length === 0) return null;
  if (live.length === 1) return live[0];
  const common = live.map((m) => new Set(m.series.map((p) => p.date))).reduce((a, b) => new Set([...a].filter((d) => b.has(d))));
  const dates = [...common].sort();
  const series: PacePoint[] = dates.map((date) => {
    let book = 0;
    let pace = 0;
    let close = 0;
    for (const m of live) {
      const p = m.series.find((x) => x.date === date)!;
      book += p.book;
      pace += p.pace;
      close = p.close;
    }
    return { date, book: r2(book), pace: r2(pace), close };
  });
  const flows = live.flatMap((m) => m.flows).sort((a, b) => a.date.localeCompare(b.date));
  return { since: dates[0] ?? "", startValue: series[0]?.book ?? null, flows, series, summary: summarize(series, flows) };
}

export function summarize(series: PacePoint[], flows: PaceFlow[]): PaceSummary | Record<string, never> {
  if (series.length === 0) return {};
  const first = series[0];
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : first;
  const net = flows.filter((f) => f.date > first.date && f.date <= last.date).reduce((s, f) => s + f.amount, 0);
  const bookGain = last.book - first.book - net;
  const paceGain = last.pace - first.pace - net;
  const base = first.book + Math.max(0, net);
  return {
    book: last.book,
    pace: last.pace,
    bookGain: r2(bookGain),
    paceGain: r2(paceGain),
    bookGainPct: base ? r2((bookGain / base) * 100) : 0,
    paceGainPct: base ? r2((paceGain / base) * 100) : 0,
    vsPace: r2(bookGain - paceGain),
    vsPacePct: base ? r2(((bookGain - paceGain) / base) * 100) : 0,
    todayBook: r2(last.book - prev.book),
    todayPace: r2(last.pace - prev.pace),
    todayVsPace: r2(last.book - prev.book - (last.pace - prev.pace)),
    flowsIn: r2(flows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0)),
    flowsOut: r2(-flows.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0)),
    days: series.length,
  };
}

/** Book and pace change over a window of the series, net of cash flows inside it. */
export function windowChange(acct: PaceAccount, start: string | null, end: string | null): { book: number; pace: number; from: string; to: string } | null {
  const s = acct.series.filter((p) => (!start || p.date >= start) && (!end || p.date <= end));
  if (s.length === 0) return null;
  // The change over the window measures from the last point BEFORE it, so the
  // first in-window day's move counts; the first logged day has no "before".
  const idx = acct.series.indexOf(s[0]);
  const from = idx > 0 ? acct.series[idx - 1] : s[0];
  const to = s[s.length - 1];
  const net = acct.flows.filter((f) => f.date > from.date && f.date <= to.date).reduce((a, f) => a + f.amount, 0);
  return { book: r2(to.book - from.book - net), pace: r2(to.pace - from.pace - net), from: from.date, to: to.date };
}
