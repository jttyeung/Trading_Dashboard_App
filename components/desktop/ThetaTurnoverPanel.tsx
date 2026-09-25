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
import { etDateString } from "@/lib/market-hours";
import { VRP_STYLE } from "@/lib/am-report-types";

const ROLL_OFF_DAYS = 10;
const TOP_N = 10;
// The account holder's own floor for a replacement entry: anything under
// 50% ARR isn't worth a slot in a theta book regardless of its VRP read
// (the engine's safe picks at 3-14% ARR were filling half the list).
// Applied before the one-per-underlying pass so a low-ARR safe pick
// never takes a ticker's slot from its higher-ARR sibling.
const MIN_ARR_PCT = 50;
// Same reasoning for delta: past 0.30 the premium is being paid for
// assignment odds, not theta, so it's out regardless of ARR.
const MAX_DELTA = 0.3;
// OTU RULE-005: IV Rank over 50 is "high" for the name -- the notes' own
// definition of high IV (a 52-week percentile, not an absolute vol
// level). A null IVR means the Brief hasn't logged ~20 samples for the
// ticker yet (see brief.CurrentIVRank); it's shown as "building" and NOT
// excluded, so the gate takes over automatically as samples fill in
// rather than emptying the list in the meantime.
const MIN_IVR = 50;
function ivrPasses(p: CspPick): boolean {
  return p.ivRank == null || p.ivRank >= MIN_IVR;
}

// VRP ordering, the account holder's own: the four combos where neither
// read is thin come first in this explicit order, then anything with one
// thin read (by RULE-022's rich 2 / fair 1 / thin 0 points across both
// reads), and thin on both is dropped -- premium that's cheap against
// six months AND against the last month isn't a replacement entry at any
// ARR. fair/fair deliberately outranks thin/rich: a name both windows
// agree is fairly priced beats one where only the last month looks good.
const VRP_COMBO_ORDER = ["rich/rich", "rich/fair", "fair/rich", "fair/fair"];
const VRP_PTS: Record<CspPick["vrp"], number> = { rich: 2, fair: 1, thin: 0, "n/a": 0 };
function vrpRank(p: CspPick): number {
  const i = VRP_COMBO_ORDER.indexOf(`${p.vrp}/${p.vrp20}`);
  if (i >= 0) return 100 - i;
  return VRP_PTS[p.vrp] + VRP_PTS[p.vrp20];
}
function thinOnBoth(p: CspPick): boolean {
  return p.vrp === "thin" && p.vrp20 === "thin";
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
  // ET calendar date at UTC midnight, so daysUntil's UTC getters count
  // from ET's today rather than the browser's.
  const today = useMemo(() => new Date(`${etDateString(new Date())}T00:00:00Z`), []);

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
      .map((p) => ({ p, dte: daysUntil(p.expiration, today), pts: vrpRank(p) }))
      .filter((r) => r.dte >= 1 && r.p.annualizedRorPct >= MIN_ARR_PCT && r.p.delta <= MAX_DELTA && !thinOnBoth(r.p) && ivrPasses(r.p))
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

      {/* 2:3 split -- the roll-off side is five short columns, the picks
          side is nine and was the one wrapping. */}
      <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:divide-x md:divide-border">
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
            title={`The suggest engine's current CSP / safe / aggressive picks at ${MIN_ARR_PCT}%+ ARR, Δ ≤ ${MAX_DELTA} and IV Rank ≥ ${MIN_IVR} (OTU RULE-005; a still-building IVR is not excluded), one per underlying, thin-on-both dropped, ordered rich/rich → rich/fair → fair/rich → fair/fair, then one-thin combos, then ARR`}
          >
            <span>On offer · engine picks ≥ {MIN_ARR_PCT}% ARR · Δ ≤ {MAX_DELTA} · IVR ≥ {MIN_IVR}, VRP first</span>
            {picks.meta.suggestedAt && <span className="normal-case tracking-normal">as of {picks.meta.suggestedAt.slice(0, 16)}</span>}
          </div>
          {onOffer.length === 0 ? (
            <div className="py-2 text-xs text-muted">No unexpired engine picks at {MIN_ARR_PCT}%+ ARR, Δ ≤ {MAX_DELTA}, IVR ≥ {MIN_IVR} in the last cycle.</div>
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
                    <td
                      className="py-1 pr-2 tabular text-muted"
                      title={p.ivRank == null ? "IV Rank still building — needs ~20 logged samples; not excluded until then" : "IV Rank: where today's IV sits in the last year's range (OTU: over 50 is high)"}
                    >
                      {p.ivRank != null ? `IVR ${p.ivRank.toFixed(0)}` : <span className="text-[9px]">IVR building</span>}
                    </td>
                    <td className="py-1 pr-2 tabular text-muted">{p.annualizedRorPct.toFixed(0)}% ARR</td>
                    <td className="py-1 pr-2 tabular" title={`6mo ${p.vrpRatio?.toFixed(2) ?? "n/a"}× · 20d ${p.vrpRatio20?.toFixed(2) ?? "n/a"}×`}>
                      <span className="text-[9px] text-muted">6mo </span>
                      <span className={VRP_STYLE[p.vrp]}>{p.vrp}</span>
                      <span className="text-[9px] text-muted"> · 20d </span>
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
