"use client";

// On-demand 2-year daily chart: candles + Bollinger Bands + 200-day SMA
// overlaid on the main pane, call/put-wall + gamma-flip reference lines,
// and MACD/RSI in their own panes underneath. Talks to
// internal/chartapi's localhost-only API (see lib/chart-api.ts) --
// computed fresh per search rather than pre-built for the whole
// watchlist, since most of the ~70+ watchlist names won't be looked at in
// a given session (see CLAUDE.md's "on-demand security chart" entry).
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card } from "@/components/ui";
import { fetchChart, type ChartData } from "@/lib/chart-api";
import { exampleChartData } from "@/lib/example";

const UP_COLOR = "#34d399";
const DOWN_COLOR = "#f87171";
const BAND_COLOR = "#60a5fa";
const SMA200_COLOR = "#f59e0b";
const MACD_LINE_COLOR = "#60a5fa";
const MACD_SIGNAL_COLOR = "#f59e0b";
const RSI_COLOR = "#a78bfa";

function toTime(dateStr: string): UTCTimestamp {
  // lightweight-charts wants a UTC seconds timestamp for a daily bar --
  // parsing as UTC midnight (not local) avoids an off-by-one-day shift
  // for anyone west of UTC.
  return (Date.parse(dateStr + "T00:00:00Z") / 1000) as UTCTimestamp;
}

export function SecurityChart({ watchlist, exampleMode }: { watchlist: string[]; exampleMode: boolean }) {
  const [symbolInput, setSymbolInput] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  function search(symbol: string) {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setActiveSymbol(s);
    setSymbolInput(s);
  }

  useEffect(() => {
    if (!activeSymbol) return;
    // A demo deployment can't reach internal/chartapi's localhost API at
    // all (it's the VIEWER's own localhost, not the app author's machine)
    // -- rather than let every search fail with a fetch error, demo mode
    // renders a fake-but-internally-consistent chart instead, same
    // "complete, non-empty demo experience" convention every other
    // data/*.json-backed screen already follows (see SECURITY.md).
    if (exampleMode) {
      setLoading(false);
      setError(null);
      setData(exampleChartData(activeSymbol));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchChart(activeSymbol)
      .then((d) => {
        if (!cancelled) setData(d);
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
  }, [activeSymbol, exampleMode]);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: { borderColor: "#3f3f46", timeVisible: false },
      // Total height, not just the main pane's -- the container div has no
      // CSS height of its own, and lightweight-charts sizes off this value
      // at creation time. Sized to comfortably fit all three panes' own
      // setHeight calls below (360 + 140 + 140); leaving this unset (or
      // too small) collapses the container to zero/near-zero height, since
      // a later panes[i].setHeight() doesn't retroactively grow it.
      height: 640,
    });
    chartRef.current = chart;

    const times = data.dates.map(toTime);

    // --- Pane 0: candles + Bollinger Bands + 200-day SMA + wall lines ---
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderVisible: false,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    candleSeries.setData(
      times.map((time, i) => ({
        time,
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i],
      })),
    );

    const bandSeries: ISeriesApi<"Line">[] = [];
    (["upper", "mid", "lower"] as const).forEach((key, idx) => {
      const s = chart.addSeries(LineSeries, {
        color: BAND_COLOR,
        lineWidth: 1,
        lineStyle: idx === 1 ? 2 : 0, // mid band dashed, upper/lower solid
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      s.setData(
        times
          .map((time, i) => ({ time, value: data.bollinger[i]?.[key] }))
          .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
      );
      bandSeries.push(s);
    });

    const sma200Series = chart.addSeries(LineSeries, {
      color: SMA200_COLOR,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    sma200Series.setData(
      times
        .map((time, i) => ({ time, value: data.sma200[i] }))
        .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
    );

    for (const [price, title, color] of [
      [data.callWall, "Call Wall", DOWN_COLOR],
      [data.putWall, "Put Wall", UP_COLOR],
      [data.gammaFlip, "Gamma Flip", "#a1a1aa"],
    ] as const) {
      if (price == null) continue;
      candleSeries.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title,
      });
    }

    // --- Pane 1: MACD ---
    const histSeries = chart.addSeries(
      HistogramSeries,
      { color: "#52525b", priceLineVisible: false, lastValueVisible: false },
      1,
    );
    histSeries.setData(
      times
        .map((time, i) => {
          const v = data.macd.histogram[i];
          if (v == null) return null;
          return { time, value: v, color: v >= 0 ? UP_COLOR : DOWN_COLOR };
        })
        .filter((p): p is { time: UTCTimestamp; value: number; color: string } => p != null),
    );
    const macdLineSeries = chart.addSeries(LineSeries, { color: MACD_LINE_COLOR, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);
    macdLineSeries.setData(
      times
        .map((time, i) => ({ time, value: data.macd.line[i] }))
        .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
    );
    const macdSignalSeries = chart.addSeries(LineSeries, { color: MACD_SIGNAL_COLOR, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 1);
    macdSignalSeries.setData(
      times
        .map((time, i) => ({ time, value: data.macd.signal[i] }))
        .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
    );

    // --- Pane 2: RSI(14), with 30/70 reference lines ---
    const rsiSeries = chart.addSeries(LineSeries, { color: RSI_COLOR, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 2);
    rsiSeries.setData(
      times
        .map((time, i) => ({ time, value: data.rsi14[i] }))
        .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
    );
    rsiSeries.createPriceLine({ price: 70, color: "#52525b", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
    rsiSeries.createPriceLine({ price: 30, color: "#52525b", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });

    const panes = chart.panes();
    if (panes[0]) panes[0].setHeight(360);
    if (panes[1]) panes[1].setHeight(140);
    if (panes[2]) panes[2].setHeight(140);

    chart.timeScale().fitContent();

    const resize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-1 py-2">
        <input
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && search(symbolInput)}
          placeholder="Search any ticker (e.g. GLW)"
          list="chart-watchlist-suggestions"
          className="w-48 rounded-md bg-surface-2 px-3 py-1.5 text-sm ring-1 ring-inset ring-border placeholder:text-muted"
        />
        <datalist id="chart-watchlist-suggestions">
          {watchlist.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          onClick={() => search(symbolInput)}
          className="rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-border active:opacity-70"
        >
          Chart
        </button>
        {loading && <span className="text-xs text-muted">loading…</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>

      {data && (
        <Card className="mt-1 px-2 py-2">
          <div className="mb-1 flex items-center justify-between px-2 text-xs text-muted">
            <span className="font-medium text-text">{data.symbol}</span>
            <span className="tabular">${data.spotPrice.toFixed(2)}</span>
          </div>
          <div ref={containerRef} />
        </Card>
      )}

      {!data && !loading && !error && (
        <Card className="mt-1 px-4 py-8 text-center text-sm text-muted">
          Search a ticker above for a 2-year daily chart with Bollinger Bands, MACD, RSI, 200-day SMA, and today's
          call/put walls.
        </Card>
      )}
    </div>
  );
}
