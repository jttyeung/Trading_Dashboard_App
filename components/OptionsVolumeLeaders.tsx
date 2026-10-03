"use client";

// Options volume leaders: the watchlist's most active names in the latest
// session, puts growing left and calls right from a shared center so the call /
// put balance reads at a glance. Built from the chains the daemon's options
// agent already pulls every 15 minutes. It's activity, not "institutional
// buying": a chain carries no trade direction or participant type, so a call
// bought and a call sold both count. Tap a row for its biggest contracts and a
// link to chart it.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { AQUA, ORANGE, Legend, fmtMoney } from "@/components/mini-charts";
import { fetchOptionsVolume, type OptionsVolume, type OptionsVolumeRow, type TopContract } from "@/lib/options-volume";

type Metric = "premium" | "contracts";
const SHOW = 20;
// Relative volume at or above this reads as unusual for the name.
const UNUSUAL_REL = 2;

function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function fmtExp(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function sessionLabel(v: OptionsVolume): string {
  const d = new Date(`${v.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const t = v.updatedAt
    ? new Date(`${v.updatedAt.replace(" ", "T")}Z`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
    : "";
  return t ? `${d} session · updated ${t} ET` : `${d} session`;
}

function ContractLine({ label, c, color }: { label: string; c: TopContract | null; color: string }) {
  if (!c) return null;
  // Volume above open interest: more contracts traded today than were open
  // coming in, so a good share is new positioning rather than closing.
  const opening = c.oi > 0 && c.volume > c.oi;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1 text-muted">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">
          {label} ${c.strike} {fmtExp(c.expiration)}
        </span>
      </span>
      <span className="tabular shrink-0 text-text">
        {fmtCount(c.volume)} vs {fmtCount(c.oi)} OI · {fmtMoney(c.premium)}
        {opening && <span className="text-amber-300"> · vol &gt; OI</span>}
      </span>
    </div>
  );
}

function LeaderRow({ row, metric, max, open, onToggle }: { row: OptionsVolumeRow; metric: Metric; max: number; open: boolean; onToggle: () => void }) {
  const call = metric === "premium" ? row.callPremium : row.callVolume;
  const put = metric === "premium" ? row.putPremium : row.putVolume;
  const fmt = metric === "premium" ? fmtMoney : fmtCount;
  // 80% of the column at most: the value label shares it.
  const pct = (v: number) => `${Math.max((v / max) * 80, v > 0 ? 1.5 : 0)}%`;
  const unusual = row.relVolume != null && row.relVolume >= UNUSUAL_REL;
  return (
    <li>
      <button onClick={onToggle} className="grid w-full grid-cols-[3.25rem_1fr_1fr] items-center gap-x-1 py-1 text-left active:opacity-70" aria-expanded={open}>
        <span className="flex items-center gap-1 text-xs font-medium text-text">
          {row.ticker}
          {unusual && <span className="rounded bg-amber-400/15 px-1 text-[9px] font-normal text-amber-300">{row.relVolume!.toFixed(1)}×</span>}
        </span>
        {/* Puts: right-aligned, growing left toward the ticker. */}
        <span className="flex items-center justify-end gap-1">
          <span className="tabular text-[10px] text-muted">{fmt(put)}</span>
          <span className="h-3 rounded-l" style={{ width: pct(put), backgroundColor: ORANGE }} />
        </span>
        <span className="flex items-center gap-1 border-l border-border">
          <span className="h-3 rounded-r" style={{ width: pct(call), backgroundColor: AQUA }} />
          <span className="tabular text-[10px] text-muted">{fmt(call)}</span>
        </span>
      </button>
      {open && (
        <div className="mb-1.5 ml-[3.25rem] space-y-0.5 rounded-lg bg-surface-2 px-2 py-1.5 text-[11px]">
          <ContractLine label="Top call" c={row.topCall} color={AQUA} />
          <ContractLine label="Top put" c={row.topPut} color={ORANGE} />
          <div className="flex items-center justify-between gap-2 pt-0.5 text-muted">
            <span>
              P/C {row.putCallRatio != null ? row.putCallRatio.toFixed(2) : "—"}
              {row.relVolume != null && ` · ${row.relVolume.toFixed(1)}× its usual volume`}
            </span>
            <Link href={`/chart?symbol=${encodeURIComponent(row.ticker)}`} className="shrink-0 text-violet-300">
              Chart {row.ticker} →
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

export function OptionsVolumeLeaders() {
  const [data, setData] = useState<OptionsVolume | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("premium");
  const [openTicker, setOpenTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOptionsVolume()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const total = (r: OptionsVolumeRow) => (metric === "premium" ? r.callPremium + r.putPremium : r.callVolume + r.putVolume);
    return [...data.rows].sort((a, b) => total(b) - total(a)).slice(0, SHOW);
  }, [data, metric]);
  // One scale across both sides, so a bar's length compares across rows and sides.
  const max = Math.max(1, ...rows.flatMap((r) => (metric === "premium" ? [r.callPremium, r.putPremium] : [r.callVolume, r.putVolume])));

  return (
    <Card className="mb-3 px-3 py-3">
      <div className="mb-1 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Options volume leaders</h2>
          <div className="text-[10px] text-muted">{data?.date ? sessionLabel(data) : "Watchlist names, latest session"}</div>
        </div>
        <div className="flex shrink-0 rounded-md bg-surface-2 p-0.5 text-[10px] ring-1 ring-inset ring-border">
          {(["premium", "contracts"] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`rounded px-2 py-0.5 capitalize ${metric === m ? "bg-surface text-text" : "text-muted"}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-1 py-3 text-xs text-muted">Options volume: {error}</p>}
      {!data && !error && <p className="px-1 py-6 text-center text-xs text-muted">Loading…</p>}
      {data && rows.length === 0 && (
        <p className="px-1 py-4 text-center text-xs text-muted">No volume recorded yet; it fills in from the options agent&apos;s next market-hours cycle.</p>
      )}
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-[3.25rem_1fr_1fr] gap-x-1 px-0 pb-0.5 text-[10px] text-muted">
            <span />
            <span className="pr-1 text-right">Puts</span>
            <span className="pl-1">Calls</span>
          </div>
          <ul>
            {rows.map((r) => (
              <LeaderRow key={r.ticker} row={r} metric={metric} max={max} open={openTicker === r.ticker} onToggle={() => setOpenTicker((t) => (t === r.ticker ? null : r.ticker))} />
            ))}
          </ul>
          <Legend items={[{ label: "Puts", color: ORANGE }, { label: "Calls", color: AQUA }]} />
          <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted">
            Contracts traded on both sides of each trade; option chains don&apos;t say who bought or sold, so this is activity, not
            institutional buying. Premium ≈ volume × the mark at snapshot.
            {data && data.historyDays < 5
              ? " The ×-usual tag starts once five sessions are on file."
              : ` Tagged ×: at least ${UNUSUAL_REL}× the name's own recent volume.`}
          </p>
        </>
      )}
    </Card>
  );
}
