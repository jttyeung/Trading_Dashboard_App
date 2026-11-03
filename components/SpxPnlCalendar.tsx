"use client";

import { useMemo, useState } from "react";
import type { SpxPnlDay } from "@/lib/spx-pnl";

const DOW = ["MON", "TUE", "WED", "THU", "FRI"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const tone = (n: number) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-text");
const pad = (n: number) => String(n).padStart(2, "0");

// Fill deepens with the day's size relative to the month's best/worst day.
function cellBg(net: number, max: number): string {
  const a = max > 0 ? 0.12 + 0.28 * Math.min(1, Math.abs(net) / max) : 0.12;
  return net >= 0 ? `rgba(52,211,153,${a})` : `rgba(251,113,133,${a})`;
}

export function SpxPnlCalendar({ days }: { days: SpxPnlDay[] }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const latest = days.length ? days[days.length - 1].date : null;
  const first = days.length ? days[0].date : null;
  const [ym, setYm] = useState<[number, number]>(() => {
    const src = latest ?? new Date().toISOString().slice(0, 10);
    return [Number(src.slice(0, 4)), Number(src.slice(5, 7)) - 1];
  });
  const [year, month] = ym;
  const prefix = `${year}-${pad(month + 1)}`;
  const shift = (delta: number) => setYm(([y, m]) => {
    const t = y * 12 + m + delta;
    return [Math.floor(t / 12), t % 12];
  });
  const canNext = !latest || prefix < latest.slice(0, 7);
  const canPrev = !first || prefix > first.slice(0, 7);

  // Mon-first weeks of the month; weekends are dropped (SPX has no weekend session).
  const weeks = useMemo(() => {
    const out: (number | null)[][] = [];
    const count = new Date(year, month + 1, 0).getDate();
    let row: (number | null)[] = [];
    for (let d = 1; d <= count; d++) {
      const dow = (new Date(year, month, d).getDay() + 6) % 7; // Mon=0
      if (dow > 4) continue;
      if (dow === 0 && row.length) { out.push(row); row = []; }
      while (row.length < dow) row.push(null);
      row.push(d);
    }
    if (row.length) out.push(row);
    return out.map((r) => [...r, ...Array(5 - r.length).fill(null)]);
  }, [year, month]);

  const monthDays = days.filter((d) => d.date.startsWith(prefix));
  const net = monthDays.reduce((s, d) => s + d.net, 0);
  const gross = monthDays.reduce((s, d) => s + d.gross, 0);
  const fees = monthDays.reduce((s, d) => s + d.fees, 0);
  // Year-to-date for the viewed month's year (the current year reads as YTD).
  const yearDays = days.filter((d) => d.date.startsWith(`${year}-`));
  const ytdNet = yearDays.reduce((s, d) => s + d.net, 0);
  const ytdGross = yearDays.reduce((s, d) => s + d.gross, 0);
  const ytdFees = yearDays.reduce((s, d) => s + d.fees, 0);
  const green = monthDays.filter((d) => d.net > 0).length;
  const red = monthDays.filter((d) => d.net < 0).length;
  const maxAbs = Math.max(0, ...monthDays.map((d) => Math.abs(d.net)));
  const today = new Date().toISOString().slice(0, 10);

  const stat = (label: string, value: string, cls = "text-text", big = false) => (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`tabular font-semibold ${big ? "text-2xl" : "text-sm"} ${cls}`}>{value}</div>
    </div>
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
          <button onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month" className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30">◀</button>
          <button onClick={() => shift(1)} disabled={!canNext} aria-label="Next month" className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30">▶</button>
        </div>
        <div className="flex items-end gap-6">
          {stat("Net this month", usd(net), tone(net), true)}
          {stat("Per day traded", monthDays.length ? usd(net / monthDays.length) : "—", tone(net), true)}
          {stat("Gross", usd(gross))}
          {stat("Fees", fees ? `-${usd(fees)}` : "$0")}
          {stat("Green / red days", `${green} / ${red}`)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-md border border-border bg-surface-2/40 px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          {year === new Date().getFullYear() ? "YTD" : year}
        </span>
        {[
          ["Net", usd(ytdNet), tone(ytdNet)],
          ["Gross", usd(ytdGross), tone(ytdGross)],
          ["Fees", ytdFees ? `-${usd(ytdFees)}` : "$0", "text-text"],
        ].map(([label, value, cls]) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
            <span className={`tabular text-sm font-semibold ${cls}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.65fr)] gap-1.5">
        {[...DOW, "WEEK"].map((h) => (
          <div key={h} className={`py-1 text-center text-[10px] tracking-wider ${h === "WEEK" ? "text-accent" : "text-muted"}`}>{h}</div>
        ))}
        {weeks.map((week, wi) => {
          const wd = week.map((d) => (d ? byDate.get(`${prefix}-${pad(d)}`) : undefined)).filter((x): x is SpxPnlDay => !!x);
          const wNet = wd.reduce((s, d) => s + d.net, 0);
          return [
            ...week.map((d, i) => {
              if (!d) return <div key={`${wi}-${i}`} />;
              const date = `${prefix}-${pad(d)}`;
              const row = byDate.get(date);
              return (
                <div
                  key={date}
                  style={row ? { background: cellBg(row.net, maxAbs) } : undefined}
                  className={`h-16 rounded-md border px-2 py-1.5 ${row ? "border-transparent" : "border-border bg-surface-2/40"} ${date === today ? "ring-1 ring-accent" : ""}`}
                >
                  <div className="text-[10px] text-muted">{d}</div>
                  {row && (
                    <>
                      <div className="tabular text-sm font-semibold">{usd(row.net)}</div>
                      <div className="tabular text-[10px] text-muted">{row.winners}/{row.trades}</div>
                    </>
                  )}
                </div>
              );
            }),
            <div key={`w${wi}`} className="flex h-16 flex-col items-center justify-center rounded-md border border-border bg-surface-2/40 px-2 py-1.5 text-center">
              {wd.length > 0 && (
                <>
                  <div className={`tabular text-sm font-semibold ${tone(wNet)}`}>{usd(wNet)}</div>
                  <div className="text-[10px] text-muted">{wd.length} day{wd.length === 1 ? "" : "s"}</div>
                </>
              )}
            </div>,
          ];
        })}
      </div>
      {!days.length && <p className="mt-4 text-xs text-muted">No SPX trades exported yet. Run an export to populate this.</p>}
    </section>
  );
}
