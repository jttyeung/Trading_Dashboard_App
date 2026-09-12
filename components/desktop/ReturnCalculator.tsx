"use client";

// A standalone premium-return calculator for a short put or covered call,
// built around the question the account holder actually asks of a short-DTE
// trade: "is this premium pulling its weight compared to a longer-dated one?"
//
// Everything here uses the SAME 365-day annualization the positions table and
// the tracker's own alerts use (see lib/calc.ts's cspAnnualizedReturn and
// internal/rules.AnnualizedReturn, both validated against the account
// holder's own spreadsheet). A calculator that quietly used 365 would give
// answers that disagree with every other number on the dashboard.
import { useEffect, useMemo, useState } from "react";
import { DAYS_PER_YEAR, fmtMoney } from "@/lib/calc";
import { isExampleClient } from "@/lib/demo";
import { fetchMonthlyGoalTarget } from "@/lib/monthly-goal-api";

// Annualization is 365/DTE (lib/calc.ts's DAYS_PER_YEAR, matching
// rules.daysPerYear and quant/options_eval.py), so a month is 365/12 ≈
// 30.42 days — derived rather than hardcoded, so monthly x 12 == annual
// exactly.
const DAYS_PER_MONTH = DAYS_PER_YEAR / 12;

// The DTE ladder the comparison table walks: a weekly, two- and three-week,
// a monthly, and STRAT-001's own 45-day upper bound.
const DTE_LADDER = [7, 14, 21, 30, 45];

// A calculator-local override of the monthly target, seeded from the real
// Monthly Goal target but deliberately NOT written back to it: asking "what
// premium would 5%/month need" is a what-if, and shouldn't quietly change
// the goal the dashboard is actually pacing against.
const TARGET_KEY = "calcMonthlyTargetPct";

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// Premium needed for a given monthly rate on NET collateral: solving
// prem / (K - prem) = x for prem.
function requiredPremiumAt(strike: number, monthlyTarget: number, dte: number): number {
  const x = monthlyTarget * (dte / DAYS_PER_MONTH);
  return (strike * x) / (1 + x);
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
  const [targetDraft, setTargetDraft] = useState("3");
  // Tracks whether a local override exists, so the backend target doesn't
  // overwrite one on arrival.
  const [hasTargetOverride, setHasTargetOverride] = useState(false);
  const [savedCapitalBase, setSavedCapitalBase] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TARGET_KEY);
      const v = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(v) && v > 0) {
        setTargetMonthlyPct(v);
        setTargetDraft(String(v));
        setHasTargetOverride(true);
      }
    } catch {
      /* storage unavailable — fall back to the Monthly Goal target */
    }
  }, []);

  useEffect(() => {
    // A public demo has no daemon to reach, and SECURITY.md requires
    // synthetic data with no live calls — the RULE-010 default and a
    // representative capital base give a complete calculator either way.
    if (isExampleClient()) {
      setSavedCapitalBase(850000);
      return;
    }
    let cancelled = false;
    fetchMonthlyGoalTarget()
      .then((t) => {
        if (cancelled) return;
        if (t.targetPercent > 0 && !hasTargetOverride) {
          setTargetMonthlyPct(t.targetPercent);
          setTargetDraft(String(t.targetPercent));
        }
        if (t.capitalBase > 0) setSavedCapitalBase(t.capitalBase);
      })
      .catch(() => {
        /* daemon unreachable — keep the RULE-010 default */
      });
    return () => {
      cancelled = true;
    };
  }, [hasTargetOverride]);

  // Commit on blur (and Enter), per the account holder's own ask. A bad value
  // reverts rather than leaving the whole page computing against NaN.
  function commitTarget() {
    const parsed = parseFloat(targetDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setTargetDraft(String(targetMonthlyPct));
      return;
    }
    setTargetMonthlyPct(parsed);
    setHasTargetOverride(true);
    try {
      localStorage.setItem(TARGET_KEY, String(parsed));
    } catch {
      /* not persisted, but the session still uses it */
    }
  }

  const r = useMemo(() => {
    const k = num(strike);
    const p = num(premium);
    const n = Math.max(1, num(contracts) || 1);
    const d = Math.max(1, num(dte) || 1);

    const credit = p * 100 * n;
    // NET collateral: the credit lands at open, so a $62 put posting $6,200
    // really ties up $6,140. Matches lib/calc.ts's cspCollateral,
    // rules.NetCollateral and quant/options_eval.py, and reconciles with the
    // account holder's own chain spreadsheet.
    const collateral = k - p > 0 ? (k - p) * 100 * n : 0;
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
      // Inverting the net basis: solving prem / (K - prem) = x for prem
      // gives K·x / (1 + x), not K·x — the gross form would overstate what
      // you actually need.
      const x = target * (d / DAYS_PER_MONTH);
      const requiredPremium = (r.strike * x) / (1 + x);
      return { dte: d, requiredPremium, requiredCredit: requiredPremium * 100 * r.contracts };
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
          <Stat label="Collateral" value={fmtMoney(r.collateral)} sub="net of credit received" />
          <Stat label="Return on capital" value={pct(r.ror)} sub={`over ${r.dte} DTE`} />
          <Stat
            label="Annualized"
            value={pct(r.annual, 1)}
            sub="365-day basis"
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
              <span className="font-semibold text-text">{fmtMoney(requiredPremiumAt(r.strike, target, r.dte))}</span>/share
              {" "}({fmtMoney(requiredPremiumAt(r.strike, target, r.dte) * 100 * r.contracts)} total) to get there.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="flex flex-wrap items-center gap-1 text-sm font-semibold text-text">
          Premium needed to hit
          <input
            aria-label="Monthly target percent"
            className="w-16 rounded-md bg-surface-2 px-2 py-0.5 text-sm tabular ring-1 ring-inset ring-border"
            inputMode="decimal"
            value={targetDraft}
            onChange={(e) => setTargetDraft(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          %/month
        </h3>
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

      <IncomeTargetTable savedCapitalBase={savedCapitalBase} />
    </div>
  );
}

// IncomeTargetTable answers the portfolio-level question rather than the
// per-trade one: for a given account size, what monthly rate does each level
// of monthly income actually require?
//
// The annual column COMPOUNDS -- (1 + monthly)^12 - 1 -- because it models
// income earned and redeployed month over month. That is deliberately NOT the
// 365/DTE simple annualization the trade calculator above uses, and the two
// genuinely answer different questions: one is "what rate is this single
// trade running at", the other is "what does sustaining this every month come
// out to". At 5.88%/month the gap is wide (98.6% compounded vs 70.6% simple),
// so the table says which it is rather than leaving it to be assumed.
const STORE_KEY = "incomeTargetInputs";

function IncomeTargetTable({ savedCapitalBase }: { savedCapitalBase: number | null }) {
  const [portfolio, setPortfolio] = useState("");
  const [step, setStep] = useState("5000");
  // touched covers both "the account holder typed something" and "we restored
  // a saved value", since either should stop the Monthly Goal capital base
  // from overwriting what's in the box.
  const [touched, setTouched] = useState(false);
  const [restored, setRestored] = useState(false);

  // Read in an effect rather than a lazy useState initializer — the same
  // impure-render-time-read concern MonthlyGoalCard's own doc comment calls
  // out for localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { portfolio?: string; step?: string };
        if (saved.portfolio) {
          setPortfolio(saved.portfolio);
          setTouched(true);
        }
        if (saved.step) setStep(saved.step);
      }
    } catch {
      /* absent or malformed — fall through to the defaults */
    }
    setRestored(true);
  }, []);

  // Only persist after the restore pass, so the initial empty state can't
  // overwrite what was saved.
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ portfolio, step }));
    } catch {
      /* private window or storage disabled — the table still works */
    }
  }, [portfolio, step, restored]);

  // With nothing saved, fall back to the capital base already on the Monthly
  // Goal card so this opens on a real number rather than a placeholder.
  useEffect(() => {
    if (!touched && savedCapitalBase != null) setPortfolio(String(Math.round(savedCapitalBase)));
  }, [savedCapitalBase, touched]);

  const p = num(portfolio);
  const s = Math.max(1, num(step) || 1);

  const rows = useMemo(() => {
    if (p <= 0) return [];
    return Array.from({ length: 10 }, (_, i) => {
      const income = s * (i + 1);
      const monthly = income / p;
      return { income, monthly, annual: Math.pow(1 + monthly, 12) - 1 };
    });
  }, [p, s]);

  const field = "w-full rounded-md bg-surface-2 px-3 py-2 text-sm tabular ring-1 ring-inset ring-border";
  const label = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text">Income target by portfolio size</h3>
      <p className="mt-0.5 text-xs text-muted">
        What monthly rate each level of monthly income requires. Annual compounds month over month, unlike the per-trade
        figure above.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
        <div>
          <label className={label} htmlFor="calc-portfolio">Portfolio value</label>
          <input
            id="calc-portfolio"
            className={field}
            inputMode="decimal"
            value={portfolio}
            placeholder="850000"
            onChange={(e) => {
              setTouched(true);
              setPortfolio(e.target.value);
            }}
          />
        </div>
        <div>
          <label className={label} htmlFor="calc-step">Step</label>
          <input id="calc-step" className={field} inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
        </div>
      </div>

      {p <= 0 && (
        <p className="mt-3 text-xs text-muted">Enter a portfolio value to see the table.</p>
      )}

      {p > 0 && (
        <>
          <div className="mt-3 text-xs text-muted">Based on {fmtMoney(p)}:</div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">$/mo</th>
                <th className="py-2 text-right font-medium">Monthly rate</th>
                <th className="py-2 text-right font-medium">Annual (compounded)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.income} className="border-b border-border/60">
                  <td className="py-2 tabular">{fmtMoney(r.income)}</td>
                  <td className="py-2 text-right tabular">{pct(r.monthly)}</td>
                  <td className="py-2 text-right tabular text-muted">{pct(r.annual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
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
