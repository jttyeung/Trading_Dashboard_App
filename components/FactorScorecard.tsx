"use client";

// Score-factor scorecard: for each term in the paper bots' own score
// breakdown, did the trades that EARNED it do better than the ones that
// didn't — and how has that read moved as the sample grew? Given
// directly by the account holder when RULE-022 (VRP / IV-rank points)
// was added: "I would like for us to be able to see the scorecards and
// how the bot picks are correlated with the final outcomes ... display
// the correlation as time passes." All numbers arrive precomputed from
// data/score-factors.json (see lib/types.ts ScoreFactorsFile for why the
// math lives server-side); this file only lays them out. A mirror, not a
// feedback loop — nothing here changes what the bots score on.
import { useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import type { BucketStat, CorrelationPoint, FactorGroup, FactorStat, ScoreFactorsFile } from "@/lib/types";

const BOT_LABEL: Record<FactorGroup["bot"], string> = {
  all: "All bots",
  general: "Wheel",
  "20_delta_safe": "20Δ Safe",
  aggressive: "Aggressive",
};

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
const ret = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);

// rTone: a correlation's sign says whether earning the term went with a
// better return; below ±0.2 it's called flat rather than colored, since a
// tiny r on a small sample is the most over-read number in this whole
// app. The label always sits beside the color (never color alone).
function rTone(r: number | null): { className: string; word: string } {
  if (r == null) return { className: "text-muted", word: "building" };
  if (r >= 0.2) return { className: "text-pos", word: "helps" };
  if (r <= -0.2) return { className: "text-neg", word: "hurts" };
  return { className: "text-muted", word: "flat" };
}

// CorrelationSparkline — r (−1..1) over the cumulative sample, one line
// per factor so no legend is needed (the row names it). Zero line is the
// only reference; 2px stroke in the accent; hover shows the date, n and r
// for the nearest point. Recessive on purpose: the number at the right
// is the read, the line is how it got there.
function CorrelationSparkline({ series }: { series: CorrelationPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // viewBox units; rendered at the row's full width (preserveAspectRatio
  // none keeps the zero line and hover math in these units regardless).
  const W = 320;
  const H = 36;
  const PAD = 3;
  const pts = useMemo(() => {
    if (series.length === 0) return [];
    const n = series.length;
    return series.map((p, i) => ({
      x: n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - 2 * PAD),
      y: PAD + ((1 - p.r) / 2) * (H - 2 * PAD),
      p,
    }));
  }, [series]);

  if (pts.length === 0) {
    return <div className="h-9 text-[10px] leading-9 text-muted">correlation series appears from n=10</div>;
  }
  const path = pts.map((q, i) => `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const zeroY = PAD + 0.5 * (H - 2 * PAD);
  const active = hover != null ? pts[hover] : null;

  return (
    <div className="relative mt-1.5 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-9 w-full overflow-visible"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
          setHover(best);
        }}
      >
        <line x1={PAD} x2={W - PAD} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeWidth={1} />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {active && (
          <>
            <line x1={active.x} x2={active.x} y1={PAD} y2={H - PAD} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
            <circle cx={active.x} cy={active.y} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute -top-6 right-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] tabular text-text ring-1 ring-border">
          n={active.p.n} · r={active.p.r.toFixed(2)} · {active.p.date.slice(0, 10)}
        </div>
      )}
    </div>
  );
}

function FactorRow({ f, minSample }: { f: FactorStat; minSample: number }) {
  const tone = rTone(f.correlation);
  const splitWord = f.split === "median" ? "above median" : "earned";
  return (
    <div className="px-3 py-2 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-text">{f.label}</span>
          <span className="ml-1.5 text-[10px] text-muted">
            {f.nWith}/{f.n} {splitWord}
          </span>
        </div>
        <div className={`shrink-0 tabular ${tone.className}`}>
          <span className="text-sm font-semibold">{f.correlation == null ? "—" : `r ${f.correlation.toFixed(2)}`}</span>
          <span className="ml-1 text-[10px]">
            {f.correlation != null
              ? tone.word
              : f.n < minSample
                ? `building (${f.n}/${minSample})`
                : f.nWith === 0
                  ? "never earned"
                  : "no variance"}
          </span>
        </div>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 tabular text-[11px] text-muted">
        <span>
          win <span className="text-text">{pct(f.winRateWith)}</span> vs {pct(f.winRateWithout)}
        </span>
        <span>
          return <span className="text-text">{ret(f.avgReturnWith)}</span> vs {ret(f.avgReturnWithout)}
        </span>
      </div>
      <CorrelationSparkline series={f.series} />
    </div>
  );
}

// FactorTableRow — the same numbers as FactorRow, one row per factor for
// the desktop Scorecard tab, where there's width for the sparkline to sit
// beside the numbers instead of under them.
function FactorTableRow({ f, minSample }: { f: FactorStat; minSample: number }) {
  const tone = rTone(f.correlation);
  const splitWord = f.split === "median" ? "above median" : "earned";
  const verdict =
    f.correlation != null ? tone.word : f.n < minSample ? `building (${f.n}/${minSample})` : f.nWith === 0 ? "never earned" : "no variance";
  return (
    <tr className="border-b border-border/60">
      <td className="whitespace-nowrap px-3 py-2">
        <div className="font-medium text-text">{f.label}</div>
        <div className="text-[10px] text-muted">
          {f.nWith}/{f.n} {splitWord}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        <span className="text-text">{pct(f.winRateWith)}</span> <span className="text-muted">vs {pct(f.winRateWithout)}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        <span className="text-text">{ret(f.avgReturnWith)}</span> <span className="text-muted">vs {ret(f.avgReturnWithout)}</span>
      </td>
      <td className="w-56 px-3 py-1">
        <CorrelationSparkline series={f.series} />
      </td>
      <td className={`whitespace-nowrap px-3 py-2 text-right tabular ${tone.className}`}>
        <span className="text-sm font-semibold">{f.correlation == null ? "—" : f.correlation.toFixed(2)}</span>
        <span className="ml-1.5 text-[10px]">{verdict}</span>
      </td>
    </tr>
  );
}

// BucketBars — win rate per raw-input bucket (VRP flag / IV-rank band),
// each bar 0-100% in the shared accent with n and mean return spelled
// out. One measure, one hue; magnitude is the bar, identity is the label.
function BucketBars({ title, buckets, empty }: { title: string; buckets: BucketStat[]; empty: string }) {
  return (
    <Card className="px-3 py-2">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      {buckets.length === 0 ? (
        <div className="py-2 text-xs text-muted">{empty}</div>
      ) : (
        <div className="space-y-1.5">
          {buckets.map((b) => (
            <div key={b.bucket} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-xs">
              <div className="font-medium text-text">{b.bucket}</div>
              <div className="relative h-2 overflow-hidden rounded-full bg-surface-2" title={`${b.wins} of ${b.n} won`}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, b.winRate))}%` }} />
              </div>
              <div className="tabular text-[10px] text-muted">
                {Math.round(b.winRate)}% · n={b.n} · {ret(b.avgReturnPct)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// variant: "phone" stacks each factor (the /scorecard page inside the
// phone frame); "desktop" lays them out as a table for the /overview
// Scorecard tab. Same data, same verdict logic, just the geometry.
export function FactorScorecard({ file, variant = "phone" }: { file: ScoreFactorsFile; variant?: "phone" | "desktop" }) {
  const [bot, setBot] = useState<FactorGroup["bot"]>("all");
  const group = file.groups.find((g) => g.bot === bot) ?? file.groups[0];

  if (!group || file.groups.every((g) => g.resolved === 0)) {
    return (
      <>
        <SectionTitle>Score factors</SectionTitle>
        <Card className="px-4 py-6 text-center text-sm text-muted">
          No resolved paper trades with a score breakdown yet. Each bot pick freezes the points it earned (VRP, IV rank,
          signals, walls, gamma, timing); once picks resolve, this shows which of those points actually went with a
          better outcome.
        </Card>
      </>
    );
  }

  const shown = group.factors.filter((f) => f.n > 0);

  return (
    <>
      <SectionTitle
        action={
          <div className="flex overflow-hidden rounded-lg border border-border">
            {file.groups.map((g) => (
              <button
                key={g.bot}
                onClick={() => setBot(g.bot)}
                className={`px-2 py-0.5 text-[11px] font-medium ${bot === g.bot ? "bg-surface-2 text-text" : "bg-transparent text-muted"}`}
              >
                {BOT_LABEL[g.bot]}
              </button>
            ))}
          </div>
        }
      >
        Score factors
      </SectionTitle>
      <Card className="divide-y divide-border">
        <div className="px-3 py-1.5 text-[10px] text-muted">
          {`${group.resolved} resolved ${BOT_LABEL[group.bot].toLowerCase()} pick${group.resolved === 1 ? "" : "s"} with a breakdown · ${group.tracked} with IV rank / VRP frozen at post time · r is the correlation between a factor's points and the trade's return on collateral, shown from n=${file.meta.minSample}`}
        </div>
        {shown.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted">No resolved picks for this bot yet.</div>
        ) : variant === "desktop" ? (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-1.5 font-medium">Factor</th>
                <th className="px-3 py-1.5 font-medium">Win rate with vs without</th>
                <th className="px-3 py-1.5 font-medium">Avg return with vs without</th>
                <th className="px-3 py-1.5 font-medium">r over the sample</th>
                <th className="px-3 py-1.5 text-right font-medium">r</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <FactorTableRow key={f.key} f={f} minSample={file.meta.minSample} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((f) => (
              <FactorRow key={f.key} f={f} minSample={file.meta.minSample} />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <BucketBars
          title="Win rate by VRP at post"
          buckets={group.vrpBuckets}
          empty="Fills in as picks logged after VRP tracking began resolve."
        />
        <BucketBars
          title="Win rate by IV rank at post"
          buckets={group.ivrBuckets}
          empty="Fills in as picks logged after IV-rank tracking began resolve."
        />
      </div>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        &ldquo;With vs without&rdquo; splits each factor by whether a pick earned it (or, for the always-present terms,
        sat above the median). The sparkline replays r over the first 10, 11, … n resolved picks, so a read that only
        settles after dozens of trades looks like one. Nothing here re-weights the bots — it&apos;s for you to decide
        whether a factor is earning its place.
      </p>
    </>
  );
}
