"use client";

// ThetaTurnoverPanel -- the weekly "what's rolling off, what's on offer"
// read for a theta book. The account holder keeps theta up by replacing
// CSPs as they expire, trading a couple of times a week, so the question
// every week is not "is there edge" but "how much theta leaves in the
// next ~10 days, and what's the best available to backfill it." Left:
// every short premium position expiring inside the window with the
// daily theta it currently earns (positionDailyTheta -- the same number
// the positions table sums, never a second derivation). Right: the CSP
// screener's raw candidate universe, gated to a balanced-wheel band
// (21-45 DTE, 0.15-0.30 delta, no earnings inside the window), ranked by
// the same lib/csp-model score the CSP tab shows, with each contract's
// theta so the two columns are in the same unit. Reads only files the
// Overview already loads plus csp-candidates.json and portfolio-risk.json
// -- nothing new on the daemon side.
import { useMemo } from "react";
import { Card } from "@/components/ui";
import type { CSPCandidate, PortfolioRiskFile } from "@/lib/types";
import type { SourcedOption } from "@/components/desktop/PositionsTable";
import { positionDailyTheta } from "@/lib/theta";
import { annualizedReturn, scoreCandidate } from "@/lib/csp-model";
import { fmtMoney } from "@/lib/calc";

const ROLL_OFF_DAYS = 10;
const TOP_N = 8;
// Balanced Wheel band from csp-model's DEFAULT_SCREENERS, minus its IVR
// gate (ivRank is still null in this feed) -- the band the account
// holder's own CSPs actually sit in.
const DTE_MIN = 21;
const DTE_MAX = 45;
const DELTA_MIN = 0.15;
const DELTA_MAX = 0.3;

function daysUntil(iso: string, today: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  const exp = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((exp - now) / 86_400_000);
}

// Per-contract daily theta for a candidate, as the credit the seller
// would earn -- the feed stores the raw (negative) per-share theta.
function candidateDailyTheta(c: CSPCandidate): number {
  return Math.abs(c.theta) * 100;
}

export function ThetaTurnoverPanel({
  options,
  candidates,
  risk,
}: {
  options: SourcedOption[];
  candidates: CSPCandidate[];
  risk: PortfolioRiskFile;
}) {
  const today = useMemo(() => new Date(), []);

  const rollingOff = useMemo(() => {
    return options
      .filter((o) => o.side === "short" && (o.kind === "csp" || o.kind === "covered-call"))
      .map((o) => ({ o, dte: daysUntil(o.expiration, today), theta: positionDailyTheta(o) }))
      .filter((r) => r.dte >= 0 && r.dte <= ROLL_OFF_DAYS)
      .sort((a, b) => a.dte - b.dte || b.theta - a.theta);
  }, [options, today]);

  const thetaLeaving = rollingOff.reduce((s, r) => s + r.theta, 0);
  const heldShortPuts = useMemo(
    () => new Set(options.filter((o) => o.side === "short" && o.kind === "csp").map((o) => o.symbol)),
    [options],
  );

  const onOffer = useMemo(() => {
    const seen = new Set<string>();
    return candidates
      .filter(
        (c) =>
          c.dte >= DTE_MIN &&
          c.dte <= DTE_MAX &&
          c.delta >= DELTA_MIN &&
          c.delta <= DELTA_MAX &&
          c.flags.earningsBeforeExp !== true,
      )
      .map((c) => ({ c, score: scoreCandidate(c).total, arr: annualizedReturn(c), theta: candidateDailyTheta(c) }))
      .sort((a, b) => b.score - a.score || b.arr - a.arr)
      // One contract per underlying: the screener lists every qualifying
      // strike/expiry, and a list of eight AMD puts is not eight ideas.
      .filter(({ c }) => (seen.has(c.symbol) ? false : (seen.add(c.symbol), true)))
      .slice(0, TOP_N);
  }, [candidates]);

  const thetaOnOffer = onOffer.reduce((s, r) => s + r.theta, 0);
  // "now" is the blended theta the theta-floor rule actually judges
  // (portfolio-risk.json), not a re-sum of the positions list -- the
  // floor is defined against that number, so "after" has to be too.
  // "leaving" can only come from the positions (per-position theta lives
  // nowhere else); both files come out of the same export cycle.
  const blended = risk.blended;
  const thetaNow = blended.thetaToday;
  const afterRollOff = thetaNow - thetaLeaving;
  const floor = blended.portfolioValue * blended.thetaMinPct;
  const hasTarget = blended.thetaStatus !== "unknown" && blended.portfolioValue > 0;

  return (
    <Card className="mb-3 w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
        <div className="text-sm font-semibold text-text">
          Theta turnover
          <span className="ml-2 text-[11px] font-normal text-muted">next {ROLL_OFF_DAYS} days</span>
        </div>
        <div className="flex flex-wrap gap-x-4 text-[11px] tabular text-muted">
          <span>
            now <b className="text-text">{fmtMoney(thetaNow)}/d</b>
          </span>
          <span>
            leaving <b className="text-neg">−{fmtMoney(thetaLeaving)}/d</b>
          </span>
          <span>
            after <b className={hasTarget && afterRollOff < floor ? "text-warn" : "text-text"}>{fmtMoney(afterRollOff)}/d</b>
          </span>
          {hasTarget && (
            <span title={`${(blended.thetaMinPct * 100).toFixed(2)}% of ${fmtMoney(blended.portfolioValue)} blended`}>
              floor <b className="text-text">{fmtMoney(floor)}/d</b>
            </span>
          )}
          <span>
            top {onOffer.length} on offer <b className="text-pos">+{fmtMoney(thetaOnOffer)}/d</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:divide-x md:divide-border">
        <div className="px-4 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">Rolling off</div>
          {rollingOff.length === 0 ? (
            <div className="py-2 text-xs text-muted">Nothing expiring in the next {ROLL_OFF_DAYS} days.</div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {rollingOff.map(({ o, dte, theta }) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2 font-medium text-text">{o.symbol}</td>
                    <td className="py-1 pr-2 tabular text-muted">
                      ${o.strike} {o.optionType === "put" ? "P" : "C"} ×{o.qty}
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">{dte === 0 ? "today" : `${dte}d`}</td>
                    <td className="py-1 pr-2 text-[10px] text-muted">{o.sourceLabel}</td>
                    <td className="py-1 text-right tabular text-neg">−{fmtMoney(theta)}/d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted" title={`${DTE_MIN}–${DTE_MAX} DTE, ${DELTA_MIN}–${DELTA_MAX} Δ, no earnings before expiry, one contract per underlying, ranked by the CSP tab's score`}>
            On offer · best per underlying
          </div>
          {onOffer.length === 0 ? (
            <div className="py-2 text-xs text-muted">No candidates in the {DTE_MIN}–{DTE_MAX} DTE / {DELTA_MIN}–{DELTA_MAX} Δ band.</div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {onOffer.map(({ c, score, arr, theta }) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2 font-medium text-text">
                      {c.symbol}
                      {heldShortPuts.has(c.symbol) && (
                        <span className="ml-1 text-[9px] font-normal text-muted" title="You already hold a short put on this name">
                          held
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">
                      ${c.strike} P · {c.dte}d
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">Δ{c.delta.toFixed(2)}</td>
                    <td className="py-1 pr-2 tabular text-muted">{(arr * 100).toFixed(0)}% ARR</td>
                    <td className="py-1 pr-2 tabular text-muted" title="CSP tab composite score">{score}</td>
                    <td className="py-1 text-right tabular text-pos">+{fmtMoney(theta)}/d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Card>
  );
}
