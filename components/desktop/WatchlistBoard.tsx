"use client";

// Every active watchlist ticker (sheet-synced + manually added) with a
// small visual "lever" per ticker showing where its current mark sits on
// Bollinger Bands, RSI(14), and IV Rank -- plus the ability to add/remove
// tickers by hand. Talks to internal/watchlistapi's localhost-only API
// (see lib/watchlist-api.ts), fully live-fetched rather than backed by a
// static data/*.json export -- same "on demand, not pre-built" shape as
// the Chart tab, and the right one here specifically because this panel
// needs a real add/remove write-back path, unlike every other static
// dashboard screen.
import { useEffect, useState } from "react";
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
        <span className="tabular text-text">{value != null ? value.toFixed(0) : "—"}</span>
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

export function WatchlistBoard({ exampleMode }: { exampleMode: boolean }) {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTicker, setBusyTicker] = useState<string | null>(null);

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
          placeholder="Add a ticker (e.g. PANW)"
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
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium">Sector</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 font-medium">BB</th>
              <th className="px-3 py-2 font-medium">RSI</th>
              <th className="px-3 py-2 font-medium">IVR</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
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
                <td className="px-3 py-2 text-right tabular">
                  {r.currentPrice != null ? `$${r.currentPrice.toFixed(2)}` : "—"}
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
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">
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
