// ---------------------------------------------------------------------------
// Scoring for spread/PMCC candidates. Leaner still than single-leg-model.ts:
// spread_evaluations carries no per-leg greeks, IV, or open interest at all
// (only strikes/premium/width/max profit-loss/ROR%/breakeven), so there's
// nothing to build a liquidity or technical component from — this scores
// DTE fit and return quality only.
// ---------------------------------------------------------------------------
import type { SpreadCandidate } from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) => y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  detail: string;
}
export interface SpreadScore {
  total: number;
  components: ScoreComponent[];
}

// Credit spreads (BULL_PUT/BEAR_CALL/IRON_CONDOR) want 21-45 DTE (STRAT-004's
// own entry window); debit spreads and PMCC's near-dated short leg run on a
// looser band since they're not primarily managed by time decay the same way.
function scoreDte(c: SpreadCandidate): ScoreComponent {
  const d = c.dte;
  let score: number;
  if (c.isCredit) {
    score = d >= 21 && d <= 45 ? 100 : d < 21 ? clamp(lerp(d, 7, 40, 21, 100), 20, 100) : clamp(lerp(d, 45, 100, 75, 50), 40, 100);
  } else {
    score = d >= 14 && d <= 60 ? 100 : clamp(lerp(d, 7, 50, 14, 100), 30, 100);
  }
  return { key: "dte", label: "DTE fit", weight: 0.5, score, detail: `${d} DTE${c.longDte !== null ? ` (LEAPS leg ${c.longDte}d)` : ""}` };
}

// A credit spread's ROR% is return on capital at risk (max loss) — richer is
// better, up to a point (very high ROR on a credit spread usually means the
// market is pricing in real tail risk, not free money). A debit spread's
// ROR% is return on the debit paid if it reaches max profit — same "richer
// is better" direction, no need for a different curve.
function scoreReturn(c: SpreadCandidate): ScoreComponent {
  if (c.rorPercent === null) {
    return { key: "return", label: "Return quality", weight: 0.5, score: null, detail: "ROR% not available" };
  }
  const r = c.rorPercent;
  const score = r <= 15 ? clamp((r / 15) * 55) : r <= 40 ? clamp(lerp(r, 15, 55, 40, 100)) : 100;
  return { key: "return", label: "Return quality", weight: 0.5, score, detail: `${r.toFixed(1)}% ROR` };
}

export function scoreCandidate(c: SpreadCandidate): SpreadScore {
  const components = [scoreDte(c), scoreReturn(c)];
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

// Display strikes as a "short/long" pair for whichever side a strategy uses,
// falling back to the other side for a pure single-sided call/put spread.
export function strikePair(c: SpreadCandidate): { short: number | null; long: number | null; side: "PUT" | "CALL" } {
  if (c.putShortStrike !== null || c.putLongStrike !== null) {
    return { short: c.putShortStrike, long: c.putLongStrike, side: "PUT" };
  }
  return { short: c.callShortStrike, long: c.callLongStrike, side: "CALL" };
}
