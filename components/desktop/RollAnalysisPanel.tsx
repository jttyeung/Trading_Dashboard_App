"use client";

import { useEffect, useMemo, useState } from "react";
import { daysToExpiry, fmtMoney, fmtPct } from "@/lib/calc";
import { isExampleClient } from "@/lib/demo";
import { exampleRollAnalysis } from "@/lib/example";
import {
  fetchRollAnalysis,
  fetchRollTarget,
  setRollTarget,
  type DefensiveRollAnalysis,
  type DefensiveRollCandidate,
  type RollAnalysisCandidate,
  type RollAnalysisMode,
  type RollAnalysisResponse,
} from "@/lib/roll-api";
import type { SourcedOption } from "./PositionsTable";

type CandidateSortKey = "strike" | "expirationDate" | "dte" | "delta" | "netCredit" | "resultingArr" | "incrementalArr";
type DefensiveSortKey = "strike" | "expirationDate" | "dte" | "delta" | "netCredit";

function candidateSortValue(c: RollAnalysisCandidate, key: CandidateSortKey): number | string {
  switch (key) {
    case "strike":
      return c.strike;
    case "expirationDate":
      return c.expirationDate;
    case "dte":
      return c.dte;
    case "delta":
      return c.delta;
    case "netCredit":
      return c.netCreditTotal;
    case "resultingArr":
      return c.resultingArr;
    case "incrementalArr":
      return c.incrementalArr;
  }
}

function defensiveSortValue(c: DefensiveRollCandidate, key: DefensiveSortKey): number | string {
  switch (key) {
    case "strike":
      return c.strike;
    case "expirationDate":
      return c.expirationDate;
    case "dte":
      return c.dte;
    case "delta":
      return c.delta;
    case "netCredit":
      return c.netCreditTotal;
  }
}

// RollAnalysisPanel is the desktop Positions table's on-demand "should I
// roll this CSP up, close it, or just let it expire" tool (RULE-021,
// internal/rules/rollup.go) -- a live, full-chain scan of every
// higher-strike replacement Schwab has for this ticker, across every
// expiration including the current one. Two modes:
//
//   - "Target ARR": only shows/recommends a roll that's a genuine net
//     credit AND brings the resulting position back above the account
//     holder's own stored target annualized return (editable here,
//     pencil-icon precedent from MonthlyGoalCard.tsx -- but this one
//     writes through to the BACKEND via setRollTarget, not localStorage,
//     since the Go tracker agent's own automatic check needs to see the
//     same number server-side).
//   - "Max cash": every credit roll, any DTE, sorted by dollars
//     collected, no ARR filtering at all -- for when the account holder
//     is comfortable with assignment either way and just wants the
//     single biggest number available right now.
//
// Both modes are roll-UP searches, so once the put is in the money they
// are empty by construction (no strike above spot is allowed, no strike
// below the current one counts as a roll-up). The backend then sends a
// `defensive` section instead -- the tracker's own "roll out and down for
// a credit or a small debit, aiming back toward Δ0.25" search, capped by
// RULE-023 -- and this panel swaps the roll-up table for that block
// (DefensiveRollBlock) rather than reporting "nothing found".
//
// Lazy: the parent only mounts this once a row is actually expanded, so
// opening the Positions table never fires N live chain calls up front.
//
// currentArrLeft is the SAME "ARR Left" figure already shown on the
// position's own row (lib/calc.ts's positionRemainingAnnualizedReturn,
// passed down rather than recomputed here per this repo's own "reuse,
// don't recompute" convention) -- the annualized rate of just holding
// the current contract to its own expiration. A candidate whose
// IncrementalARR doesn't beat that number is putting the same tied-up
// capital to WORSE use than doing nothing, regardless of how its
// ResultingARR or raw net credit look in isolation, so viableCandidates
// (below) excludes it outright rather than showing it. It's a plain
// fraction (0.206), unlike the roll-analysis API's own ARR fields
// (already percentage points, e.g. 20.6) -- normalized once in
// viableCandidates rather than per-row.
export function RollAnalysisPanel({
  position,
  currentArrLeft,
}: {
  position: SourcedOption;
  currentArrLeft: number | null;
}) {
  const [mode, setMode] = useState<RollAnalysisMode>("target_arr");
  const [target, setTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [data, setData] = useState<RollAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sortable in both views -- defaults match each mode's own natural
  // framing (Target ARR: closest/safest strike first; Max cash: biggest
  // credit first, matching the backend's own default ordering), but
  // either can be overridden by clicking any column.
  const [sortKey, setSortKey] = useState<CandidateSortKey>("strike");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(key: CandidateSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  useEffect(() => {
    if (mode === "max_cash") {
      setSortKey("netCredit");
      setSortDir(-1);
    } else {
      setSortKey("strike");
      setSortDir(1);
    }
  }, [mode]);

  // A candidate whose IncrementalARR doesn't beat currentArrLeft is
  // putting the same tied-up capital to WORSE use than just letting the
  // current contract ride to its own expiration -- true regardless of
  // mode, so it's excluded outright rather than merely dimmed (an
  // earlier dimmed-but-still-"recommended" version of this table read as
  // a flat contradiction on the account holder's own live position).
  // Units: currentArrLeft is a plain fraction (lib/calc.ts convention),
  // c.incrementalArr is already a percentage point (this API's own
  // convention) -- divide by 100 to compare.
  const viableCandidates = useMemo(() => {
    if (!data?.candidates) return [];
    if (currentArrLeft == null) return data.candidates;
    return data.candidates.filter((c) => c.incrementalArr / 100 >= currentArrLeft);
  }, [data, currentArrLeft]);

  const excludedCount = (data?.candidates?.length ?? 0) - viableCandidates.length;

  // The backend's own recommended pick (BestRollUp, gated on ResultingARR
  // -- see RULE-021) is computed with no knowledge of currentArrLeft, so
  // it can itself be one of the excluded rows. Surfaced explicitly rather
  // than just silently showing no star anywhere, since that's exactly the
  // scenario that read as a contradiction before this exclusion existed.
  const recommendedExcluded =
    data?.recommended != null && !viableCandidates.some((c) => c.symbol === data.recommended!.symbol);

  const sortedCandidates = useMemo(() => {
    return [...viableCandidates].sort((a, b) => {
      const av = candidateSortValue(a, sortKey);
      const bv = candidateSortValue(b, sortKey);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
  }, [viableCandidates, sortKey, sortDir]);

  useEffect(() => {
    // A public demo has no daemon; SECURITY.md requires synthetic data and
    // no live calls, so seed the same default the backend would return.
    if (isExampleClient()) {
      setTarget(30);
      setTargetDraft("30");
      return;
    }
    fetchRollTarget()
      .then((t) => {
        setTarget(t.targetArrPercent);
        setTargetDraft(String(t.targetArrPercent));
      })
      .catch(() => setTarget(30)); // a reasonable fallback if the daemon isn't reachable yet
  }, []);

  useEffect(() => {
    if (target == null) return; // wait for the stored target to load first, so the first fetch uses the real value
    if (isExampleClient()) {
      // Synthetic candidates so the panel demonstrates its full shape --
      // an empty or errored panel would show nothing of what it does.
      setData(exampleRollAnalysis(position.symbol, position.strike, mode, target));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRollAnalysis({
      symbol: position.symbol,
      currentStrike: position.strike,
      currentDte: daysToExpiry(position.expiration),
      contracts: position.qty,
      costToClose: position.mark,
      mode,
      targetArr: target,
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
    position.expiration,
    position.qty,
    position.mark,
  ]);

  async function saveTarget() {
    if (isExampleClient()) {
      setTargetDraft(String(target)); // read-only demo: never attempt a write
      return;
    }
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
          {(["target_arr", "max_cash"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                mode === m
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-text"
              }`}
            >
              {m === "target_arr" ? "Target ARR" : "Max cash"}
            </button>
          ))}
        </div>

        {mode === "target_arr" && (
          <div
            className="flex items-center gap-1 text-xs text-muted"
            title="Annualized, not monthly -- a 2.5%/month goal (RULE-010) is ~30% here (monthly x 365/30)."
          >
            Target ARR:
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
              title="Edit target ARR"
              className="text-muted/60 hover:text-text"
            >
              ✏️
            </button>
          </div>
        )}
      </div>

      {mode === "max_cash" && (
        <p className="text-[11px] text-muted">
          Ignoring your ARR target — every credit roll available, any DTE
          including the current expiration, sorted by dollars collected.
        </p>
      )}

      {loading && (
        <p className="text-xs text-muted">Scanning the live chain…</p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {!loading && !error && data?.defensive && (
        <DefensiveRollBlock defensive={data.defensive} strike={position.strike} />
      )}

      {!loading && !error && data && !data.defensive && sortedCandidates.length === 0 && (
        <p className="text-xs text-muted">
          {(data.candidates?.length ?? 0) > 0
            ? `Every credit roll found returns less, annualized, than simply holding this contract to its own expiration (${fmtPct(currentArrLeft ?? 0, 1)} ARR Left) -- none are worth taking over doing nothing.`
            : mode === "target_arr"
              ? "No higher strike found that's both a real credit and clears your target ARR right now."
              : "No credit roll available above the current strike right now."}
        </p>
      )}

      {!loading && !error && data && !data.defensive && sortedCandidates.length > 0 && excludedCount > 0 && (
        <p className="text-[11px] text-muted">
          {excludedCount} roll{excludedCount === 1 ? "" : "s"} excluded for
          returning less, annualized, than simply holding this contract to
          its own expiration ({fmtPct(currentArrLeft ?? 0, 1)} ARR Left).
        </p>
      )}

      {!loading && !error && data && !data.defensive && recommendedExcluded && (
        <p className="text-[11px] text-amber-400">
          The backend&apos;s own pick ({fmtMoney(data.recommended!.strike)}, {data.recommended!.expirationDate}) was
          excluded above — it clears your target ARR but its Incremental ARR
          doesn&apos;t beat just holding this contract.
        </p>
      )}

      {!loading && !error && data && !data.defensive && sortedCandidates.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-left uppercase tracking-wide text-muted">
                <SortableHeader label="Strike" col="strike" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Exp" col="expirationDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader label="DTE" col="dte" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Δ" col="delta" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Net credit" col="netCredit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader
                  label="Resulting ARR"
                  col="resultingArr"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                  title="This candidate's own annualized return if opened fresh today — includes the whole premium, not just what rolling adds on top of closing now."
                />
                <SortableHeader
                  label="Incremental ARR"
                  col="incrementalArr"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  align="right"
                  title="Annualized return on JUST the net credit rolling adds over closing now — the number to compare against a position you could simply close today."
                />
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => (
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

// DefensiveRollBlock is the ITM replacement for the roll-up table. Amber
// rather than the roll-up table's emerald: this is damage control (pay
// nothing or a little to push assignment out and the strike down), not
// an upgrade. The recommended row is the same contract the tracker's
// automatic `roll` alert names; a debit row shows its real negative
// number rather than being hidden, since the cap is the account
// holder's own $/contract line and they may still prefer assignment.
function DefensiveRollBlock({ defensive, strike }: { defensive: DefensiveRollAnalysis; strike: number }) {
  const capPerContract = defensive.maxDebitPerShare * 100;
  const [sortKey, setSortKey] = useState<DefensiveSortKey>("netCredit");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  function toggleSort(key: DefensiveSortKey) {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sortedCandidates = useMemo(() => {
    return [...defensive.candidates].sort((a, b) => {
      const av = defensiveSortValue(a, sortKey);
      const bv = defensiveSortValue(b, sortKey);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return cmp * sortDir;
    });
  }, [defensive.candidates, sortKey, sortDir]);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-amber-300/90">
        🛡️ In the money — a roll up (any strike above {fmtMoney(strike)}) isn&apos;t
        on the table. These are defensive rolls instead: same strike or lower,
        later expiration, for a credit or a debit within the RULE-023 cap
        ({fmtMoney(capPerContract)}/contract). Recommended is the closest to
        Δ0.25 among the credit-or-breakeven rows — the tracker&apos;s own pick.
        A bigger credit further down the list is time value at a strike that
        stays near {fmtMoney(strike)}: more cash now, but the same assignment
        risk you have today.
      </p>
      {defensive.candidates.length === 0 ? (
        <p className="text-xs text-muted">
          Nothing within the {fmtMoney(capPerContract)}/contract cap — expect
          assignment, or close manually.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-amber-500/30">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b border-border bg-amber-500/10 text-left uppercase tracking-wide text-muted">
                <SortableHeader label="Strike" col="strike" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Exp" col="expirationDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader label="DTE" col="dte" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Δ" col="delta" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Net credit" col="netCredit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => {
                const recommended = defensive.recommended?.symbol === c.symbol;
                return (
                  <tr key={c.symbol} className={`border-b border-border/60 ${recommended ? "bg-amber-500/15" : ""}`}>
                    <td className="px-2 py-1.5 tabular text-text">
                      {fmtMoney(c.strike)}
                      {recommended && <span className="ml-1 text-[10px] text-amber-300">🛡️ recommended</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-muted">{c.expirationDate}</td>
                    <td className="px-2 py-1.5 text-right tabular text-text">{c.dte}</td>
                    <td className="px-2 py-1.5 text-right tabular text-text">{c.delta.toFixed(2)}</td>
                    <td className={`px-2 py-1.5 text-right tabular ${c.netCreditPerShare >= 0 ? "text-pos" : "text-neg"}`}>
                      {fmtMoney(c.netCreditPerShare, { sign: true, cents: true })}/sh ({fmtMoney(c.netCreditTotal, { sign: true })})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortableHeader<K extends string>({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = "left",
  title,
}: {
  label: string;
  col: K;
  sortKey: K;
  sortDir: 1 | -1;
  onSort: (col: K) => void;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <th className={`px-2 py-1.5 font-medium ${align === "right" ? "text-right" : ""}`} title={title}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 hover:text-text ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span className="text-[9px]">{sortKey === col ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
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
  // Target-ARR mode dims a row that doesn't clear the bar (still visible
  // for context, since "how close is the next best" is useful too); the
  // recommended row is the same one the automatic backend alert would
  // pick (smallest qualifying strike). Max-cash mode never dims -- every
  // row shown there already cleared the credit-only floor, and "meets
  // target" isn't the point of that mode. A row that returns less than
  // just holding the position (IncrementalARR < ARR Left) never reaches
  // here at all -- the parent excludes those outright (see
  // viableCandidates), so recommended and dimmed can no longer disagree
  // the way they briefly did when that case was only dimmed.
  const dimmed = mode === "target_arr" && !c.meetsTarget;
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
        {fmtPct(c.resultingArr / 100, 1)}
      </td>
      <td className="px-2 py-1.5 text-right tabular text-text">
        {fmtPct(c.incrementalArr / 100, 1)}
      </td>
    </tr>
  );
}
