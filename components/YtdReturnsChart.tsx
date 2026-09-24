"use client";

// Plain stock return YTD for one scorecard tab's own tickers — "how has
// each name I (or the bots) traded done this year", modeled on the
// watchlist "% returns YTD" charts the account holder shared from
// Discord. Unlike PnlView's DivergingBar (centered at 50%), the zero line
// sits where the data puts it: YTD returns skew hard positive (one name
// can be +600% while the worst is −50%), and a centered axis would spend
// half the width on a side that barely gets used.
import { useMemo } from "react";
import { Card, SectionTitle } from "@/components/ui";
import type { YtdReturn, YtdReturnsFile } from "@/lib/types";

const fmtPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
};

export function YtdReturnsChart({ file, tickers, title }: { file: YtdReturnsFile; tickers: string[]; title: string }) {
  const { rows, missing } = useMemo(() => {
    const byTicker = new Map(file.returns.map((r) => [r.ticker, r]));
    const unique = [...new Set(tickers)];
    return {
      rows: unique
        .map((t) => byTicker.get(t))
        .filter((r): r is YtdReturn => r !== undefined)
        .sort((a, b) => b.returnPct - a.returnPct),
      missing: unique.filter((t) => !byTicker.has(t)).sort(),
    };
  }, [file, tickers]);

  if (rows.length === 0 && missing.length === 0) return null;

  const maxPos = Math.max(0, ...rows.map((r) => r.returnPct));
  const maxNeg = Math.max(0, ...rows.map((r) => -r.returnPct));
  const span = maxPos + maxNeg || 1;
  const zero = (maxNeg / span) * 100; // % from the left where 0% sits

  const isStale = (r: YtdReturn) => r.lastDate < file.meta.latestDate;
  const anyStale = rows.some(isStale);
  const anyListed = rows.some((r) => r.listedThisYear);

  return (
    <>
      <SectionTitle>
        {title} · % return YTD
      </SectionTitle>
      <Card className="p-4">
        {file.meta.latestDate && (
          <p className="mb-3 text-xs text-muted">
            {rows.length} tickers, {file.meta.year - 1}-12-31 close to {fmtDate(file.meta.latestDate)} close
          </p>
        )}
        <div className="space-y-1">
          {rows.map((r) => {
            const pos = r.returnPct >= 0;
            const w = (Math.abs(r.returnPct) / span) * 100;
            const stale = isStale(r);
            return (
              <div
                key={r.ticker}
                className="grid grid-cols-[3.75rem_minmax(0,1fr)_4.75rem] items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-surface-2"
                title={`${r.ticker}: $${r.baseClose.toFixed(2)} (${r.baseDate}) → $${r.lastClose.toFixed(2)} (${r.lastDate})${
                  stale ? " — no longer refreshing" : ""
                }`}
              >
                <span className="font-medium text-text">
                  {r.ticker}
                  {r.listedThisYear && <span className="text-muted">*</span>}
                </span>
                <div className="relative h-3">
                  <div className="absolute inset-y-[-2px] w-px bg-border" style={{ left: `${zero}%` }} />
                  <div
                    className={`absolute inset-y-0 ${pos ? "rounded-r bg-emerald-500/70" : "rounded-l bg-rose-500/70"} ${stale ? "opacity-40" : ""}`}
                    style={pos ? { left: `${zero}%`, width: `${w}%` } : { right: `${100 - zero}%`, width: `${w}%` }}
                  />
                </div>
                <span className={`text-right tabular-nums ${stale ? "text-muted" : "text-text"}`}>
                  {fmtPct(r.returnPct)}
                  {stale && "†"}
                </span>
              </div>
            );
          })}
        </div>
        {(anyListed || anyStale || missing.length > 0) && (
          <div className="mt-3 space-y-0.5 text-[11px] text-muted">
            {anyListed && <p>* listed in {file.meta.year}, return since first trading day</p>}
            {anyStale &&
              rows
                .filter(isStale)
                .map((r) => (
                  <p key={r.ticker}>
                    † {r.ticker} as of {fmtDate(r.lastDate)} close, price history no longer refreshing
                  </p>
                ))}
            {missing.length > 0 && <p>No price history: {missing.join(", ")}</p>}
          </div>
        )}
      </Card>
    </>
  );
}
