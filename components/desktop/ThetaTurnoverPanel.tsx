"use client";

// ThetaTurnoverPanel -- the weekly "what's rolling off, what's on offer"
// read for a theta book. The account holder keeps theta up by replacing
// CSPs as they expire, trading a couple of times a week, so the question
// every week is not "is there edge" but "how much theta leaves in the
// next ~10 days, and what's the best available to backfill it." Left:
// every short premium position expiring inside the window with the
// daily theta it currently earns (positionDailyTheta -- the same number
// the positions table sums, never a second derivation). Right: the
// suggest engine's own current short-put picks (data/csp-picks.json --
// CSP / CSP_SAFE / CSP_AGGRESSIVE, so the 3-14 DTE band is in), each
// with its contract theta so the two columns share a unit.
//
// The first version ranked data/csp-candidates.json by lib/csp-model's
// score instead. The account holder asked what the picks were based on;
// that model has no VRP term and the screener file never contains
// anything under 20 DTE, so it was replaced with the engine's picks and
// an explicit VRP-first ordering: RULE-022's own 2/1/0 points for the
// blend read plus the same for the 20-day read (0-4), then ARR. That
// ordering is the panel's, not the engine's -- the engine's rank is
// within one strategy and its score already carries VRP as a bonus; this
// puts VRP in front because the account holder asked for it "baked in".
import { useMemo } from "react";
import { Card } from "@/components/ui";
import type { CspPick, CspPicksFile, PortfolioRiskFile } from "@/lib/types";
import type { SourcedOption } from "@/components/desktop/PositionsTable";
import { positionDailyTheta } from "@/lib/theta";
import { fmtMoney } from "@/lib/calc";
import { VRP_STYLE } from "@/lib/am-report-types";

const ROLL_OFF_DAYS = 10;
const TOP_N = 10;

// RULE-022's VRP points (rich 2 / fair 1 / thin 0), applied to both the
// blend and the 20-day read so "fair on the blend, rich on 20d" outranks
// "fair on both" -- the old-vol-vs-genuinely-cheap distinction the
// Watchlist Board's third VRP line exists for.
const VRP_PTS: Record<CspPick["vrp"], number> = { rich: 2, fair: 1, thin: 0, "n/a": 0 };
function vrpPoints(p: CspPick): number {
  return VRP_PTS[p.vrp] + VRP_PTS[p.vrp20];
}

const STRATEGY_CHIP: Record<CspPick["strategy"], { label: string; className: string }> = {
  CSP: { label: "CSP", className: "bg-surface-2 text-muted ring-border" },
  CSP_SAFE: { label: "safe", className: "bg-info/15 text-info ring-info/40" },
  CSP_AGGRESSIVE: { label: "aggr", className: "bg-warn/15 text-warn ring-warn/40" },
};

const TIER_CHIP: Record<"S" | "A" | "B", string> = {
  S: "bg-pos/15 text-pos ring-pos/40",
  A: "bg-info/15 text-info ring-info/40",
  B: "bg-surface-2 text-muted ring-border",
};

function daysUntil(iso: string, today: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  const exp = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((exp - now) / 86_400_000);
}

export function ThetaTurnoverPanel({
  options,
  picks,
  risk,
}: {
  options: SourcedOption[];
  picks: CspPicksFile;
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
    return picks.picks
      // DTE from the expiration, not the stored dte: on a weekend the
      // file is Friday's last cycle and a 3-DTE aggressive pick may
      // already be gone.
      .map((p) => ({ p, dte: daysUntil(p.expiration, today), pts: vrpPoints(p) }))
      .filter((r) => r.dte >= 1)
      .sort((a, b) => b.pts - a.pts || b.p.annualizedRorPct - a.p.annualizedRorPct)
      // One contract per underlying: the engine lists the same name under
      // up to three strategies, and three AXTI puts is not three ideas.
      .filter(({ p }) => (seen.has(p.ticker) ? false : (seen.add(p.ticker), true)))
      .slice(0, TOP_N);
  }, [picks, today]);

  const thetaOnOffer = onOffer.reduce((s, r) => s + (r.p.thetaPerDay ?? 0), 0);
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
          <div
            className="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-muted"
            title="The suggest engine's current CSP / safe / aggressive picks, one per underlying, ordered by VRP (blend + 20-day, rich 2 / fair 1 / thin 0) then ARR"
          >
            <span>On offer · engine picks, VRP first</span>
            {picks.meta.suggestedAt && <span className="normal-case tracking-normal">as of {picks.meta.suggestedAt.slice(0, 16)}</span>}
          </div>
          {onOffer.length === 0 ? (
            <div className="py-2 text-xs text-muted">No unexpired engine picks in the last cycle.</div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {onOffer.map(({ p, dte }) => (
                  <tr key={p.contractSymbol + p.strategy} className="border-b border-border/40 last:border-0" title={p.rationale}>
                    <td className="py-1 pr-2 font-medium text-text">
                      {p.tier !== "" && (
                        <span className={`mr-1.5 inline-block w-4 rounded px-0.5 text-center text-[9px] font-bold ring-1 ring-inset ${TIER_CHIP[p.tier]}`}>
                          {p.tier}
                        </span>
                      )}
                      {p.ticker}
                      {heldShortPuts.has(p.ticker) && (
                        <span className="ml-1 text-[9px] font-normal text-muted" title="You already hold a short put on this name">
                          held
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      <span className={`rounded px-1 py-px text-[9px] font-semibold ring-1 ring-inset ${STRATEGY_CHIP[p.strategy].className}`}>
                        {STRATEGY_CHIP[p.strategy].label}
                      </span>
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">
                      ${p.strike} P · {dte}d
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">Δ{p.delta.toFixed(2)}</td>
                    <td className="py-1 pr-2 tabular text-muted">{p.annualizedRorPct.toFixed(0)}% ARR</td>
                    <td className="py-1 pr-2 tabular" title={`6mo ${p.vrpRatio?.toFixed(2) ?? "n/a"}× · 20d ${p.vrpRatio20?.toFixed(2) ?? "n/a"}×`}>
                      <span className={VRP_STYLE[p.vrp]}>{p.vrp}</span>
                      <span className="text-muted"> / </span>
                      <span className={VRP_STYLE[p.vrp20]}>{p.vrp20}</span>
                    </td>
                    <td className="py-1 text-right tabular text-pos">{p.thetaPerDay != null ? `+${fmtMoney(p.thetaPerDay)}/d` : "—"}</td>
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
