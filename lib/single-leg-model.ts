// ---------------------------------------------------------------------------
// Scoring for LEAPS/CC/LONG_PUT/BEAR_MKT_PUT candidates. Deliberately leaner
// than lib/csp-model.ts's 8-component rubric: these are long (bought) or
// directional plays rather than a single income-generating band, so "premium
// yield"/IV-rank framing doesn't transfer — this scores liquidity, technical
// alignment, and DTE fit only, renormalized over what's available the same
// way csp-model.ts does.
// ---------------------------------------------------------------------------
import type { SingleLegCandidate } from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);

export function premium(c: SingleLegCandidate): number {
  return c.mark * 100;
}
export function cost(c: SingleLegCandidate): number {
  return c.mark * 100; // LEAPS/LONG_PUT: what you pay to open one contract
}
export function spreadPct(c: SingleLegCandidate): number {
  const sp = Math.max(0, c.ask - c.bid);
  return c.mark > 0 ? sp / c.mark : 1;
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  detail: string;
}
export interface SingleLegScore {
  total: number;
  components: ScoreComponent[];
}

function scoreLiquidity(c: SingleLegCandidate): ScoreComponent {
  const oi = c.openInterest >= 1000 ? 100 : c.openInterest >= 200 ? lerp(c.openInterest, 200, 55, 1000, 100) : (c.openInterest / 200) * 55;
  const sp = spreadPct(c);
  const spreadScore = sp <= 0.03 ? 100 : sp <= 0.05 ? 80 : sp <= 0.08 ? 55 : sp <= 0.12 ? 35 : 15;
  return { key: "liquidity", label: "Liquidity", weight: 0.4, score: clamp(0.6 * oi + 0.4 * spreadScore), detail: `OI ${c.openInterest.toLocaleString()}, spread ${(sp * 100).toFixed(0)}%` };
}

// LEAPS/LONG_PUT want deep-ITM (delta magnitude ~0.70-0.85 is the sweet
// spot — beyond that you're mostly paying for time value on a stock move
// that's already happened); CC/BEAR_MKT_PUT don't have the same "deep-ITM"
// framing, so this component is only scored for LEAPS/LONG_PUT.
function scoreDeltaFit(c: SingleLegCandidate): ScoreComponent {
  if (c.strategy !== "LEAPS" && c.strategy !== "LONG_PUT") {
    return { key: "delta", label: "Delta fit", weight: 0.3, score: null, detail: "not applicable to this strategy" };
  }
  const d = Math.abs(c.delta);
  const score = d >= 0.7 && d <= 0.85 ? 100 : d < 0.7 ? clamp(lerp(d, 0.5, 40, 0.7, 100), 30, 100) : clamp(lerp(d, 0.85, 100, 0.98, 50), 40, 100);
  return { key: "delta", label: "Delta fit", weight: 0.3, score, detail: `Δ ${d.toFixed(2)}` };
}

function scoreTechnical(c: SingleLegCandidate): ScoreComponent {
  const t = c.technical;
  const known = t.aboveSma50 !== null || t.rsi !== null;
  let score: number | null = null;
  if (known) {
    // A directional long (LEAPS/CALL side) wants trend confirmation;
    // a bearish play (LONG_PUT/BEAR_MKT_PUT/PUT side) wants the mirror.
    const wantBullish = c.putCall === "CALL";
    let pts = 0;
    if (t.aboveSma50 === wantBullish) pts += 50;
    if (t.rsi !== null) {
      const aligned = wantBullish ? t.rsi >= 50 && t.rsi <= 70 : t.rsi <= 50 && t.rsi >= 30;
      if (aligned) pts += 50;
    }
    score = clamp(pts);
  }
  return { key: "technical", label: "Technical", weight: 0.3, score, detail: known ? "trend/RSI alignment" : "OHLCV feed not connected" };
}

export function scoreCandidate(c: SingleLegCandidate): SingleLegScore {
  const components = [scoreLiquidity(c), scoreDeltaFit(c), scoreTechnical(c)];
  const available = components.filter((x) => x.score !== null);
  const wSum = available.reduce((s, x) => s + x.weight, 0);
  const total = wSum > 0 ? available.reduce((s, x) => s + x.weight * (x.score as number), 0) / wSum : 0;
  return { total: Math.round(total), components };
}

export function scoreBand(total: number): { label: string; chip: string } {
  if (total >= 80) return { label: "Strong", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" };
  if (total >= 65) return { label: "Good", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" };
  if (total >= 50) return { label: "Fair", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" };
  return { label: "Weak", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" };
}
