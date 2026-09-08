"use client";

import { useEffect, useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/calc";
import {
  fetchRollAnalysis,
  fetchRollTarget,
  setRollTarget,
  type RollAnalysisCandidate,
  type RollAnalysisMode,
  type RollAnalysisResponse,
} from "@/lib/roll-api";
import type { SourcedOption } from "./PositionsTable";

// RollAnalysisPanel is the desktop Positions table's on-demand "should I
// roll this CSP up, close it, or just let it expire" tool (RULE-021,
// internal/rules/rollup.go) -- a live, full-chain scan of every
// higher-strike replacement Schwab has for this ticker, across every
// expiration including the current one. Two modes:
//
//   - "Target APY": only shows/recommends a roll that's a genuine net
//     credit AND brings the resulting position back above the account
//     holder's own stored target annualized return (editable here,
//     pencil-icon precedent from MonthlyGoalCard.tsx -- but this one
//     writes through to the BACKEND via setRollTarget, not localStorage,
//     since the Go tracker agent's own automatic check needs to see the
//     same number server-side).
//   - "Max cash": every credit roll, any DTE, sorted by dollars
//     collected, no APY filtering at all -- for when the account holder
//     is comfortable with assignment either way and just wants the
//     single biggest number available right now.
//
// Lazy: the parent only mounts this once a row is actually expanded, so
// opening the Positions table never fires N live chain calls up front.
export function RollAnalysisPanel({ position }: { position: SourcedOption }) {
  const [mode, setMode] = useState<RollAnalysisMode>("target_apy");
  const [target, setTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [data, setData] = useState<RollAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRollTarget()
      .then((t) => {
        setTarget(t.targetApyPercent);
        setTargetDraft(String(t.targetApyPercent));
      })
      .catch(() => setTarget(30)); // a reasonable fallback if the daemon isn't reachable yet
  }, []);

  useEffect(() => {
    if (target == null) return; // wait for the stored target to load first, so the first fetch uses the real value
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRollAnalysis({
      symbol: position.symbol,
      currentStrike: position.strike,
      contracts: position.qty,
      costToClose: position.mark,
      mode,
      targetApy: target,
    })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    target,
    position.symbol,
    position.strike,
    position.qty,
    position.mark,
  ]);

  async function saveTarget() {
    const parsed = parseFloat(targetDraft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      try {
        await setRollTarget(parsed);
        setTarget(parsed);
      } catch {
        setTargetDraft(String(target)); // reject a failed write, revert the input
      }
    } else {
      setTargetDraft(String(target));
    }
    setEditingTarget(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["target_apy", "max_cash"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                mode === m
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-text"
              }`}
            >
              {m === "target_apy" ? "Target APY" : "Max cash"}
            </button>
          ))}
        </div>

        {mode === "target_apy" && (
          <div className="flex items-center gap-1 text-xs text-muted">
            Target:
            {editingTarget ? (
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={targetDraft}
                onChange={(e) => setTargetDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveTarget()}
                onBlur={saveTarget}
                autoFocus
                className="w-14 rounded border border-border bg-surface-2 px-1 py-0.5 text-xs tabular text-accent"
              />
            ) : (
              <span className="font-semibold text-accent">
                {target != null ? target.toFixed(1) : "…"}%
              </span>
            )}
            <button
              onClick={() => {
                setTargetDraft(String(target ?? ""));
                setEditingTarget(true);
              }}
              title="Edit target APY"
              className="text-muted/60 hover:text-text"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {mode === "max_cash" && (
        <p className="text-[11px] text-muted">
          Ignoring your APY target — every credit roll available, any DTE
          including the current expiration, sorted by dollars collected.
        </p>
      )}

      {loading && (
        <p className="text-xs text-muted">Scanning the live chain…</p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {!loading && !error && data && data.candidates.length === 0 && (
        <p className="text-xs text-muted">
          {mode === "target_apy"
            ? "No higher strike found that's both a real credit and clears your target APY right now."
            : "No credit roll available above the current strike right now."}
        </p>
      )}

      {!loading && !error && data && data.candidates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-left uppercase tracking-wide text-muted">
                <th className="px-2 py-1.5 font-medium">Strike</th>
                <th className="px-2 py-1.5 font-medium">Exp</th>
                <th className="px-2 py-1.5 text-right font-medium">DTE</th>
                <th className="px-2 py-1.5 text-right font-medium">Δ</th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Net credit
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  Resulting APY
                </th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => (
                <CandidateRow
                  key={c.symbol}
                  candidate={c}
                  mode={mode}
                  recommended={data.recommended?.symbol === c.symbol}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  candidate: c,
  mode,
  recommended,
}: {
  candidate: RollAnalysisCandidate;
  mode: RollAnalysisMode;
  recommended: boolean;
}) {
  // Target-APY mode dims a row that doesn't clear the bar (still visible
  // for context, since "how close is the next best" is useful too); the
  // recommended row is the same one the automatic backend alert would
  // pick (smallest qualifying strike). Max-cash mode never dims anything
  // -- every row shown there already cleared the credit-only floor, and
  // "meets target" isn't the point of that mode.
  const dimmed = mode === "target_apy" && !c.meetsTarget;
  return (
    <tr
      className={`border-b border-border/60 ${recommended ? "bg-emerald-500/10" : ""} ${dimmed ? "opacity-50" : ""}`}
    >
      <td className="px-2 py-1.5 tabular text-text">
        {fmtMoney(c.strike)}
        {recommended && (
          <span className="ml-1 text-[10px] text-emerald-400">
            ★ recommended
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-muted">
        {c.expirationDate}
      </td>
      <td className="px-2 py-1.5 text-right tabular text-text">{c.dte}</td>
      <td className="px-2 py-1.5 text-right tabular text-text">
        {c.delta.toFixed(2)}
      </td>
      <td
        className={`px-2 py-1.5 text-right tabular ${c.netCreditPerShare >= 0 ? "text-pos" : "text-neg"}`}
      >
        {fmtMoney(c.netCreditPerShare, { sign: true, cents: true })}/sh (
        {fmtMoney(c.netCreditTotal, { sign: true })})
      </td>
      <td className="px-2 py-1.5 text-right tabular text-text">
        {fmtPct(c.resultingApy / 100, 1)}
      </td>
    </tr>
  );
}
