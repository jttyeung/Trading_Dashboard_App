"use client";

// On-demand 2-year daily chart: candles + Bollinger Bands + 50/200-day SMA
// overlaid on the main pane (with golden/death cross markers where the two
// SMAs cross), call/put-wall + gamma-flip reference lines, MACD/RSI in
// their own panes underneath, and a draggable price/date ruler (see "+
// Price line" below). Talks to internal/chartapi's localhost-only API
// (see lib/chart-api.ts) -- computed fresh per search rather than
// pre-built for the whole watchlist, since most of the ~70+ watchlist
// names won't be looked at in a given session (see CLAUDE.md's
// "on-demand security chart" entry).
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card } from "@/components/ui";
import { fetchChart, type ChartData } from "@/lib/chart-api";
import { exampleChartData } from "@/lib/example";

const UP_COLOR = "#34d399";
const DOWN_COLOR = "#f87171";
const BAND_COLOR = "#60a5fa";
const SMA50_COLOR = "#c084fc";
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

function formatUTCDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Pin {
  top: number; // px within the chart container, clamped to the main pane
  left: number; // px within the chart container
  price: number;
  date: string | null; // null when dragged over an area with no plotted bar
}

export function SecurityChart({ watchlist, exampleMode }: { watchlist: string[]; exampleMode: boolean }) {
  const [symbolInput, setSymbolInput] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const draggingRef = useRef(false);

  // A draggable horizontal ruler pinned over the candles -- drag it to any
  // (x, y) and it reports the price at that height plus the date under the
  // cursor at drop time, so you can read off "what price/date am I at"
  // without needing to hold the mouse in place (unlike the library's own
  // hover-only crosshair, this stays put after you let go).
  const [pin, setPin] = useState<Pin | null>(null);

  const computePin = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!container || !chart || !series) return;
    const rect = container.getBoundingClientRect();
    const mainPaneHeight = chart.panes()[0]?.getHeight() ?? rect.height;
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), mainPaneHeight);
    const price = series.coordinateToPrice(y);
    if (price == null) return;
    const time = chart.timeScale().coordinateToTime(x);
    setPin({ top: y, left: x, price, date: time != null ? formatUTCDate(time as number) : null });
  }, []);

  const startDrag = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      draggingRef.current = true;
      computePin(e.clientX, e.clientY);
      const onMove = (ev: MouseEvent) => {
        if (draggingRef.current) computePin(ev.clientX, ev.clientY);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [computePin],
  );

  function addPriceLine() {
    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) return;
    const rect = container.getBoundingClientRect();
    const mainPaneHeight = chart.panes()[0]?.getHeight() ?? rect.height;
    computePin(rect.left + rect.width / 2, rect.top + mainPaneHeight / 2);
  }

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
    setPin(null); // stale pixel coordinates from the previous chart instance

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: { borderColor: "#3f3f46", timeVisible: false },
      // Total height across all three panes combined -- the container div
      // has no CSS height of its own, and lightweight-charts sizes off this
      // value at creation time; leaving it unset (or too small) collapses
      // the container to zero/near-zero height. The panes' own relative
      // split below (setStretchFactor) divides this total, so it's this
      // number alone that controls how tall the whole chart actually is.
      height: 720,
    });
    chartRef.current = chart;
    candleSeriesRef.current = null;

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
    candleSeriesRef.current = candleSeries;

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

    const sma50Series = chart.addSeries(LineSeries, {
      color: SMA50_COLOR,
      lineWidth: 1,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    sma50Series.setData(
      times
        .map((time, i) => ({ time, value: data.sma50[i] }))
        .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null),
    );

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

    // Golden cross (50-day SMA crossing above the 200-day) / death cross
    // (crossing below) -- every occurrence in the 2-year window, not just
    // the latest, mirroring quant/indicators.py's detect_all_crosses.
    // Placed on the candle series (not either SMA line) so the marker sits
    // relative to real price action, which is what the crossover is meant
    // to say something about.
    const crossMarkers: SeriesMarker<UTCTimestamp>[] = data.crosses.map((c) => ({
      time: toTime(c.date),
      position: c.type === "golden" ? "belowBar" : "aboveBar",
      color: c.type === "golden" ? UP_COLOR : DOWN_COLOR,
      shape: c.type === "golden" ? "arrowUp" : "arrowDown",
      text: c.type === "golden" ? "✨ Golden Cross" : "💀 Death Cross",
    }));
    createSeriesMarkers(candleSeries, crossMarkers);

    for (const [price, title, color] of [
      [data.callWall, "Call Wall", UP_COLOR],
      [data.putWall, "Put Wall", DOWN_COLOR],
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

    // lightweight-charts v5 sizes panes by RELATIVE stretch factor, not a
    // persistent pixel height -- setHeight() exists but only converts to an
    // equivalent stretch factor at that exact moment, which then gets
    // recomputed (and effectively discarded) as later series/panes are
    // still being added, confirmed live: calling setHeight() here, even
    // repeatedly across animation frames, never stuck, while
    // setStretchFactor() does. 5:3:2 (main:MACD:RSI) makes MACD noticeably
    // taller than RSI, per the account holder's own ask (MACD was hard to
    // read at the original, roughly-equal 360:140:140 mix).
    const panes = chart.panes();
    if (panes[0]) panes[0].setStretchFactor(5);
    if (panes[1]) panes[1].setStretchFactor(3);
    if (panes[2]) panes[2].setStretchFactor(2);

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
      candleSeriesRef.current = null;
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
        {data && (
          <button
            onClick={() => (pin ? setPin(null) : addPriceLine())}
            className="rounded-md bg-surface-2 px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-border active:opacity-70"
          >
            {pin ? "Remove line" : "+ Price line"}
          </button>
        )}
        {loading && <span className="text-xs text-muted">loading…</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>

      {data && (
        <Card className="mt-1 px-2 py-2">
          <div className="mb-1 flex items-center justify-between px-2 text-xs text-muted">
            <span className="font-medium text-text">{data.symbol}</span>
            <span className="tabular">${data.spotPrice.toFixed(2)}</span>
          </div>
          <div className="relative">
            <div ref={containerRef} />
            {pin && (
              <>
                {/* Visible dashed ruler line -- z-10 is required: lightweight-charts'
                    own canvas elements are inline-styled to z-index: 2, which sits
                    above an unstyled (z-index: auto) sibling regardless of DOM order. */}
                <div
                  className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-text/50"
                  style={{ top: pin.top }}
                />
                {/* Wider invisible strip for an easy drag target */}
                <div
                  onMouseDown={startDrag}
                  className="absolute left-0 right-0 z-10 cursor-ns-resize"
                  style={{ top: pin.top - 5, height: 10 }}
                  title="Drag to read off price and date"
                />
                {/* Price + date readout, follows the last drag position */}
                <div
                  className="pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs font-medium tabular text-text shadow-sm ring-1 ring-inset ring-border"
                  style={{
                    top: pin.top,
                    left: Math.min(Math.max(pin.left, 60), (containerRef.current?.clientWidth ?? 200) - 60),
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  ${pin.price.toFixed(2)}
                  {pin.date && <span className="text-muted">· {pin.date}</span>}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {!data && !loading && !error && (
        <Card className="mt-1 px-4 py-8 text-center text-sm text-muted">
          Search a ticker above for a 2-year daily chart with Bollinger Bands, MACD, RSI, 50/200-day SMA with
          golden/death cross markers, and today's call/put walls.
        </Card>
      )}
    </div>
  );
}
