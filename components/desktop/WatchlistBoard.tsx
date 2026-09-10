"use client";

// Every active watchlist ticker (sheet-synced + manually added) with a
// small visual "lever" per ticker showing where its current mark sits on
// Bollinger Bands and RSI(14), IV Rank, a MACD momentum badge, and price
// read against today's put/call gamma walls (replacing a plain Price
// column -- see PriceWallsCell) -- plus the ability to add/remove
// tickers by hand.
// Talks to internal/watchlistapi's localhost-only API (see
// lib/watchlist-api.ts), fully live-fetched rather than backed by a
// static data/*.json export -- same "on demand, not pre-built" shape as
// the Chart tab, and the right one here specifically because this panel
// needs a real add/remove write-back path, unlike every other static
// dashboard screen.
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import {
  fetchWatchlist,
  addWatchlistTicker,
  removeWatchlistTicker,
  type WatchlistRow,
} from "@/lib/watchlist-api";
import { exampleWatchlistBoard } from "@/lib/example";

function Lever({
  value,
  min,
  max,
  label,
  zones,
  buildingSamples,
}: {
  value: number | null;
  min: number;
  max: number;
  label: string;
  zones?: { from: number; to: number; className: string }[];
  buildingSamples?: number; // when set and value is null, shows "building (n/20)" instead of a plain dash
}) {
  const pct = (v: number) => Math.min(Math.max(((v - min) / (max - min)) * 100, 0), 100);

  return (
    <div className="flex w-24 flex-col gap-0.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
        <span>{label}</span>
        {/* Only shown once there's a real value -- showing both "—" here
            AND "building"/"no data" below it was a redundant double
            "no value" signal. */}
        {value != null && <span className="tabular text-text">{value.toFixed(0)}</span>}
      </div>
      {value == null ? (
        <div className="flex h-1.5 items-center">
          <span className="text-[9px] text-muted">
            {buildingSamples != null ? `building (${buildingSamples}/20)` : "no data"}
          </span>
        </div>
      ) : (
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          {zones?.map((z, i) => (
            <div
              key={i}
              className={`absolute inset-y-0 ${z.className}`}
              style={{ left: `${pct(z.from)}%`, width: `${pct(z.to) - pct(z.from)}%` }}
            />
          ))}
          <div
            className={`absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
              value < min || value > max ? "bg-rose-400" : "bg-accent"
            }`}
            style={{ left: `${pct(value)}%` }}
          />
        </div>
      )}
    </div>
  );
}

const RSI_ZONES = [
  { from: 0, to: 30, className: "bg-rose-400/20" },
  { from: 70, to: 100, className: "bg-rose-400/20" },
];

// PriceWallsCell replaces a plain Price column with price read in context
// of today's gamma walls -- put wall (downside), the actual price, and
// call wall (upside) all spelled out as numbers, with a gauge showing
// where price actually sits between them (marker turns rose if price has
// genuinely broken through either wall).
// dayPct is the underlying's own move today, as a fraction, shown beside
// the price so the wall context reads alongside the direction that got it
// there. Computed server-side from indicator_snapshots' own last_close
// (see watchlistapi.Row.DayChangePct) rather than from a second quote.
function DayPct({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const tone = pct > 0 ? "text-pos" : pct < 0 ? "text-neg" : "text-muted";
  return (
    <span className={`tabular text-[10px] ${tone}`}>
      {pct > 0 ? "+" : ""}
      {(pct * 100).toFixed(2)}%
    </span>
  );
}

function PriceWallsCell({
  price,
  putWall,
  callWall,
  dayPct,
}: {
  price: number | null;
  putWall: number | null;
  callWall: number | null;
  dayPct?: number | null;
}) {
  if (price == null) {
    return <span className="text-sm text-muted">—</span>;
  }
  if (putWall == null || callWall == null) {
    return (
      <div className="flex w-32 flex-col gap-0.5">
        <span className="tabular text-sm font-medium text-text">
          ${price.toFixed(2)} <DayPct pct={dayPct} />
        </span>
        <span className="text-[9px] text-muted">no wall data</span>
      </div>
    );
  }
  const pct = Math.min(Math.max(((price - putWall) / (callWall - putWall)) * 100, 0), 100);
  const outOfRange = price < putWall || price > callWall;
  return (
    <div className="flex w-32 flex-col gap-0.5">
      <div className="flex items-center justify-between text-[10px] tabular">
        <span className="text-neg">${putWall.toFixed(0)}</span>
        <span className="font-medium text-text">
          ${price.toFixed(2)} <DayPct pct={dayPct} />
        </span>
        <span className="text-pos">${callWall.toFixed(0)}</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={`absolute top-1/2 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            outOfRange ? "bg-rose-400" : "bg-accent"
          }`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// MacdBadge -- MACD's histogram has no natural fixed bound the way
// RSI/IVR do (0-100) or price bands do (a real range), so rather than
// force it into the same gauge shape, this reads it the way MACD is
// actually used: is the line above or below its own signal (bullish/
// bearish), with the histogram's own magnitude (line minus signal) shown
// as the number that magnitude represents.
function MacdBadge({ line, signal }: { line: number | null; signal: number | null }) {
  if (line == null || signal == null) {
    return <span className="text-[10px] text-muted">no data</span>;
  }
  const bullish = line >= signal;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium tabular ${bullish ? "text-pos" : "text-neg"}`}>
      {bullish ? "▲" : "▼"} {(line - signal).toFixed(2)}
    </span>
  );
}

// bbPosition is where currentPrice sits within [bollingerLower,
// bollingerUpper] as a 0-1 fraction (same math the BB Lever itself uses
// to place its marker) -- null when any of the three inputs is missing,
// so sorting can push those rows to the end regardless of direction.
function bbPosition(r: WatchlistRow): number | null {
  if (r.currentPrice == null || r.bollingerLower == null || r.bollingerUpper == null) return null;
  const range = r.bollingerUpper - r.bollingerLower;
  if (range === 0) return 0.5;
  return (r.currentPrice - r.bollingerLower) / range;
}

// wallsPosition mirrors bbPosition exactly, using the put/call gamma
// walls as the range instead of the Bollinger Band -- same PriceWallsCell
// math, same null-means-sort-to-the-end handling.
function wallsPosition(r: WatchlistRow): number | null {
  if (r.currentPrice == null || r.putWall == null || r.callWall == null) return null;
  const range = r.callWall - r.putWall;
  if (range === 0) return 0.5;
  return (r.currentPrice - r.putWall) / range;
}

// compareNullable sorts two possibly-missing numbers, always pushing a
// missing value to the end regardless of sort direction (matching every
// other lever's own "no data" convention on this board).
function compareNullable(av: number | null, bv: number | null, dir: 1 | -1): number {
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return (av - bv) * dir;
}

type SortKey = "ticker" | "bb" | "walls" | "rsi";

function SortHeader({
  label,
  sortKeyName,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKeyName: SortKey;
  active: SortKey;
  dir: 1 | -1;
  onClick: (key: SortKey) => void;
}) {
  return (
    <button onClick={() => onClick(sortKeyName)} className="flex items-center gap-1 hover:text-text">
      {label}
      <span className="text-[9px]">{active === sortKeyName ? (dir === 1 ? "▲" : "▼") : "↕"}</span>
    </button>
  );
}

export function WatchlistBoard({ exampleMode }: { exampleMode: boolean }) {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTicker, setBusyTicker] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      switch (sortKey) {
        case "ticker":
          return a.ticker.localeCompare(b.ticker) * sortDir;
        case "bb":
          return compareNullable(bbPosition(a), bbPosition(b), sortDir);
        case "walls":
          return compareNullable(wallsPosition(a), wallsPosition(b), sortDir);
        case "rsi":
          return compareNullable(a.rsi14, b.rsi14, sortDir);
      }
    });
    return list;
  }, [rows, sortKey, sortDir]);

  useEffect(() => {
    if (exampleMode) {
      setRows(exampleWatchlistBoard());
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchWatchlist()
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exampleMode]);

  async function handleAdd() {
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    if (exampleMode) {
      setError("Adding tickers isn't available in the demo.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const updated = await addWatchlistTicker(ticker);
      setRows(updated);
      setNewTicker("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(ticker: string) {
    if (exampleMode) return;
    setBusyTicker(ticker);
    setError(null);
    try {
      const updated = await removeWatchlistTicker(ticker);
      setRows(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyTicker(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-1 py-2">
        <input
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a ticker"
          className="w-44 rounded-md bg-surface-2 px-3 py-1.5 text-sm ring-1 ring-inset ring-border placeholder:text-muted"
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-border active:opacity-70 disabled:opacity-50"
        >
          {adding ? "Adding…" : "+ Add"}
        </button>
        {loading && <span className="text-xs text-muted">loading…</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>

      <Card className="mt-1 w-full overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">
                <SortHeader label="Ticker" sortKeyName="ticker" active={sortKey} dir={sortDir} onClick={toggleSort} />
              </th>
              <th className="px-3 py-2 font-medium">Sector</th>
              <th className="px-3 py-2 font-medium">
                <SortHeader label="Price vs Walls" sortKeyName="walls" active={sortKey} dir={sortDir} onClick={toggleSort} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortHeader label="BB" sortKeyName="bb" active={sortKey} dir={sortDir} onClick={toggleSort} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortHeader label="RSI" sortKeyName="rsi" active={sortKey} dir={sortDir} onClick={toggleSort} />
              </th>
              <th className="px-3 py-2 font-medium">MACD</th>
              <th className="px-3 py-2 font-medium">IVR</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.ticker} className="border-b border-border/60 hover:bg-surface-2/40">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-text">
                  {r.ticker}
                  {r.source === "manual" && (
                    <sup
                      title="Added manually — not synced from the sheet"
                      className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent"
                    >
                      M
                    </sup>
                  )}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted">{r.sector || "—"}</td>
                <td className="px-3 py-2">
                  <PriceWallsCell price={r.currentPrice} putWall={r.putWall} callWall={r.callWall} dayPct={r.dayChangePct} />
                </td>
                <td className="px-3 py-2">
                  {r.currentPrice != null && r.bollingerLower != null && r.bollingerUpper != null ? (
                    <Lever value={r.currentPrice} min={r.bollingerLower} max={r.bollingerUpper} label="BB" />
                  ) : (
                    <Lever value={null} min={0} max={1} label="BB" />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Lever value={r.rsi14} min={0} max={100} label="RSI" zones={RSI_ZONES} />
                </td>
                <td className="px-3 py-2">
                  <MacdBadge line={r.macdLine} signal={r.macdSignal} />
                </td>
                <td className="px-3 py-2">
                  <Lever value={r.ivRank} min={0} max={100} label="IVR" buildingSamples={r.ivRankSamples} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleRemove(r.ticker)}
                    disabled={busyTicker === r.ticker}
                    title={`Remove ${r.ticker}`}
                    className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-rose-400 disabled:opacity-50"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted">
                  No active watchlist tickers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
