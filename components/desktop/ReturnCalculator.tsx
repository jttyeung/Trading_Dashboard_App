"use client";

// A standalone premium-return calculator for a short put or covered call,
// built around the question the account holder actually asks of a short-DTE
// trade: "is this premium pulling its weight compared to a longer-dated one?"
//
// Everything here uses the SAME 360-day annualization the positions table and
// the tracker's own alerts use (see lib/calc.ts's cspAnnualizedReturn and
// internal/rules.AnnualizedReturn, both validated against the account
// holder's own spreadsheet). A calculator that quietly used 365 would give
// answers that disagree with every other number on the dashboard.
import { useEffect, useMemo, useState } from "react";
import { fmtMoney } from "@/lib/calc";
import { fetchMonthlyGoalTarget } from "@/lib/monthly-goal-api";

// Annualization is 360/DTE, so a month is 360/12 = 30 days — kept consistent
// rather than using a 30.44-day calendar month, so monthly x 12 == annual
// exactly.
const DAYS_PER_YEAR = 360;
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

// The DTE ladder the comparison table walks: a weekly, two- and three-week,
// a monthly, and STRAT-001's own 45-day upper bound.
const DTE_LADDER = [7, 14, 21, 30, 45];

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(v: number, digits = 2): string {
  return `${v >= 0 ? "" : "-"}${Math.abs(v * 100).toFixed(digits)}%`;
}

export function ReturnCalculator() {
  const [strike, setStrike] = useState("100");
  const [premium, setPremium] = useState("1.50");
  const [contracts, setContracts] = useState("1");
  const [dte, setDte] = useState("7");

  // Benchmarks against the account holder's OWN saved monthly target rather
  // than a hardcoded RULE-010 constant, so "is this enough?" means the same
  // thing here as on the Monthly Goal card. Falls back to RULE-010's 3% if
  // the daemon isn't reachable.
  const [targetMonthlyPct, setTargetMonthlyPct] = useState(3);
  useEffect(() => {
    let cancelled = false;
    fetchMonthlyGoalTarget()
      .then((t) => {
        if (!cancelled && t.targetPercent > 0) setTargetMonthlyPct(t.targetPercent);
      })
      .catch(() => {
        /* daemon unreachable — keep the RULE-010 default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const r = useMemo(() => {
    const k = num(strike);
    const p = num(premium);
    const n = Math.max(1, num(contracts) || 1);
    const d = Math.max(1, num(dte) || 1);

    const credit = p * 100 * n;
    // Collateral for a cash-secured put. A covered call's capital base is the
    // shares' own cost rather than the strike, but at the same strike the two
    // are close enough that this stays a useful read for either.
    const collateral = k * 100 * n;
    const ror = collateral > 0 ? credit / collateral : 0;

    return {
      credit,
      collateral,
      ror,
      monthly: ror * (DAYS_PER_MONTH / d),
      annual: ror * (DAYS_PER_YEAR / d),
      perDay: d > 0 ? credit / d : 0,
      dte: d,
      strike: k,
      contracts: n,
    };
  }, [strike, premium, contracts, dte]);

  const target = targetMonthlyPct / 100;
  const meets = r.monthly >= target;

  // What premium the SAME strike would need at each DTE to clear the monthly
  // target — the direct answer to "am I being paid enough to go short-dated?"
  const ladder = useMemo(() => {
    return DTE_LADDER.map((d) => {
      const requiredRor = target * (d / DAYS_PER_MONTH);
      return {
        dte: d,
        requiredPremium: r.strike * requiredRor,
        requiredCredit: r.strike * 100 * r.contracts * requiredRor,
      };
    });
  }, [target, r.strike, r.contracts]);

  const field = "w-full rounded-md bg-surface-2 px-3 py-2 text-sm tabular ring-1 ring-inset ring-border";
  const label = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={label} htmlFor="calc-strike">Strike</label>
            <input id="calc-strike" className={field} inputMode="decimal" value={strike} onChange={(e) => setStrike(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="calc-premium">Premium / share</label>
            <input id="calc-premium" className={field} inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="calc-contracts">Contracts</label>
            <input id="calc-contracts" className={field} inputMode="numeric" value={contracts} onChange={(e) => setContracts(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="calc-dte">DTE</label>
            <input id="calc-dte" className={field} inputMode="numeric" value={dte} onChange={(e) => setDte(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Credit" value={fmtMoney(r.credit)} sub={`${fmtMoney(r.perDay)}/day`} />
          <Stat label="Collateral" value={fmtMoney(r.collateral)} sub="strike × 100 × contracts" />
          <Stat label="Return on capital" value={pct(r.ror)} sub={`over ${r.dte} DTE`} />
          <Stat
            label="Annualized"
            value={pct(r.annual, 1)}
            sub="360-day basis"
            tone={r.annual > 0 ? "pos" : undefined}
          />
        </div>

        <div className={`mt-4 rounded-xl border p-3 ${meets ? "border-pos/30 bg-pos/10" : "border-neg/30 bg-neg/10"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm">
              <span className="text-muted">Monthly equivalent</span>{" "}
              <span className={`text-lg font-bold tabular ${meets ? "text-pos" : "text-neg"}`}>{pct(r.monthly)}</span>
            </span>
            <span className="text-xs text-muted">
              {meets ? "clears" : "short of"} your {targetMonthlyPct.toFixed(2)}%/month target
            </span>
          </div>
          {!meets && r.strike > 0 && (
            <p className="mt-1 text-xs text-muted">
              At {r.dte} DTE you&apos;d need{" "}
              <span className="font-semibold text-text">{fmtMoney(r.strike * target * (r.dte / DAYS_PER_MONTH))}</span>/share
              {" "}({fmtMoney(r.strike * 100 * r.contracts * target * (r.dte / DAYS_PER_MONTH))} total) to get there.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-text">Premium needed to hit {targetMonthlyPct.toFixed(2)}%/month</h3>
        <p className="mt-0.5 text-xs text-muted">
          At a {fmtMoney(r.strike)} strike. Shorter DTE needs less premium in absolute terms, but more per day — this is the
          comparison worth making before taking a weekly over a monthly.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="py-2 font-medium">DTE</th>
              <th className="py-2 text-right font-medium">Premium / share</th>
              <th className="py-2 text-right font-medium">Credit</th>
              <th className="py-2 text-right font-medium">Your premium</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((row) => {
              const isCurrent = row.dte === r.dte;
              const clears = num(premium) >= row.requiredPremium;
              return (
                <tr key={row.dte} className={`border-b border-border/60 ${isCurrent ? "bg-surface-2/60" : ""}`}>
                  <td className="py-2 tabular">
                    {row.dte}
                    {isCurrent && <span className="ml-1 text-[10px] text-muted">(yours)</span>}
                  </td>
                  <td className="py-2 text-right tabular">{fmtMoney(row.requiredPremium)}</td>
                  <td className="py-2 text-right tabular text-muted">{fmtMoney(row.requiredCredit)}</td>
                  <td className={`py-2 text-right tabular ${clears ? "text-pos" : "text-neg"}`}>
                    {clears ? "clears" : "short"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular text-lg font-bold ${tone === "pos" ? "text-pos" : "text-text"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted">{sub}</div>}
    </div>
  );
}
