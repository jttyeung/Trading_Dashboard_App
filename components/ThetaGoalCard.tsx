// Brief section: how far blended theta is from the $/day goal and what would close the
// gap. Server component — the plan is built in lib/theta-goal.ts from data the page
// already loads, so this only lays it out.
import { Card } from "@/components/ui";
import { fmtMoney } from "@/lib/calc";
import type { ThetaGoalPlan } from "@/lib/theta-goal";

const perDay = (v: number) => `${fmtMoney(Math.round(v))}/day`;

export function ThetaGoalCard({ plan }: { plan: ThetaGoalPlan }) {
  const pct = plan.goal > 0 ? Math.min(100, (plan.current / plan.goal) * 100) : 0;
  const met = plan.gap === 0;
  return (
    <Card className="mt-3 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Theta goal</div>
        <div className="text-[11px] text-muted">all accounts</div>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold tabular-nums">{perDay(plan.current)}</span>
        <span className="text-[12px] text-muted">of {perDay(plan.goal)}</span>
        <span className={`text-[12px] font-medium ${met ? "text-emerald-300" : "text-amber-300"}`}>
          {met ? "goal met" : `${perDay(plan.gap)} to go`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${met ? "bg-emerald-400" : "bg-amber-300"}`} style={{ width: `${pct}%` }} />
      </div>

      {!met && (
        <>
          <div className="mt-3 text-[12px] font-medium">Shares with no call against them</div>
          {plan.uncovered.length === 0 ? (
            <div className="mt-1 text-[12px] text-muted">Every 100-share lot already has a call written.</div>
          ) : (
            <ul className="mt-1 divide-y divide-white/5">
              {plan.uncovered.map((l) => (
                <li key={`${l.accountId}-${l.symbol}`} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-[12px]">
                  <span>
                    <span className="font-medium">{l.symbol}</span>{" "}
                    <span className="text-muted">
                      {l.mode === "keep" ? `${l.contracts} of ${l.lotsOpen}` : `×${l.contracts}`} · {l.accountLabel}
                      {l.call && (
                        <>
                          {" "}
                          · {l.call.dte}d ${l.call.strike} call, {Math.round(l.call.delta * 100)}Δ
                        </>
                      )}
                    </span>
                    {l.mode === "keep" && (
                      <span className="block text-[11px] text-sky-300">
                        Taxable gain: far out of the money, a few lots at a time
                      </span>
                    )}
                    {l.waitUntil && (
                      <span className="block text-[11px] text-amber-300">Every expiration spans earnings {l.waitUntil}: write after the report</span>
                    )}
                    {l.callAwayGain != null && (
                      <span className={`block text-[11px] ${l.callAwayGain < 0 ? "text-rose-300" : "text-muted"}`}>
                        {l.callAwayGain < 0
                          ? `strike is ${fmtMoney(Math.round(-l.callAwayGain))} below cost basis`
                          : `if called away, realizes ~${fmtMoney(Math.round(l.callAwayGain))} of taxable gain`}
                      </span>
                    )}
                  </span>
                  {l.call ? <span className="tabular-nums text-emerald-300">+≈{perDay(l.estThetaPerDay)}</span> : <span className="text-muted">—</span>}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 text-[12px] font-medium">Cash</div>
          {plan.picks.length > 0 ? (
            <ul className="mt-1 divide-y divide-white/5">
              {plan.picks.map((c) => (
                <li key={c.pick.contractSymbol} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-[12px]">
                  <span>
                    <span className="font-medium">{c.pick.ticker}</span>{" "}
                    <span className="text-muted">
                      {c.dte}d ${c.pick.strike} put · {fmtMoney(c.collateral)} collateral · {c.thetaPer1kCollateral.toFixed(2)} per $1k
                    </span>
                  </span>
                  <span className="tabular-nums text-emerald-300">+{perDay(c.thetaPerDay)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-[12px] text-muted">
              {fmtMoney(Math.round(plan.freeCash))} free
              {plan.reserve != null ? ` against a ${fmtMoney(Math.round(plan.reserve))} cash reserve for this VIX band` : ""}
              {plan.room > 0 ? ", but no pick fits." : ": no room to add puts without dipping below the band."}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-white/10 pt-2 text-[12px]">
            <span className="text-muted">If all of the above is done</span>
            <span className={`tabular-nums font-medium ${plan.reachesGoal ? "text-emerald-300" : "text-amber-300"}`}>
              ≈{perDay(plan.projected)} {plan.reachesGoal ? "· reaches the goal" : "· still short"}
            </span>
          </div>
          <div className="mt-1 text-[11px] leading-snug text-muted">
            Covered-call figures are premium ÷ days, an average — real theta starts lower and rises toward expiry. Put figures
            are the contract&apos;s own theta today.
          </div>
        </>
      )}
    </Card>
  );
}
