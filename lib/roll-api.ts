// Client-side call into OptionsEvaluator's small roll-analysis API
// (internal/rollapi) -- mirrors lib/chart-api.ts's/lib/watchlist-api.ts's
// exact fetch/error shape and same-caveat: only reachable when the
// OptionsEvaluator daemon is running on whatever host actually serves this
// dashboard, on ROLL_API_PORT (8095 by default). window.location.hostname
// (not a hardcoded "localhost") is load-bearing here for the same reason
// documented in lib/chart-api.ts -- a phone reaching this over Tailscale
// needs the request to target the SAME host the page itself was loaded from.
function rollAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8095";
  return `${window.location.protocol}//${window.location.hostname}:8095`;
}

export type RollAnalysisMode = "target_arr" | "max_cash";

export interface RollAnalysisCandidate {
  symbol: string;
  strike: number;
  expirationDate: string;
  dte: number;
  delta: number;
  premium: number;
  netCreditPerShare: number;
  netCreditTotal: number;
  resultingArr: number;
  // Annualizes only netCreditTotal (already net of the cost to close the
  // current leg) over the same collateral/DTE resultingArr uses -- unlike
  // resultingArr (the candidate's own gross premium, as if opened fresh
  // today), this is the number actually comparable to "what do I give up
  // by not just closing now." See internal/rules/rollup.go's
  // IncrementalARR doc comment for the live case that prompted this.
  incrementalArr: number;
  meetsTarget: boolean;
}

// One contract within RULE-023's debit cap for an in-the-money put. No
// resultingArr/meetsTarget on purpose — see internal/rollapi's
// DefensiveRollCandidate. netCreditPerShare is signed: negative is a debit.
export interface DefensiveRollCandidate {
  symbol: string;
  strike: number;
  expirationDate: string;
  dte: number;
  delta: number;
  premium: number;
  netCreditPerShare: number;
  netCreditTotal: number;
}

// Present only when the put is already ITM, where neither roll-up mode can
// find anything by construction. Carries the tracker's own defensive
// search (roll out and down for a credit or a small debit), so the panel
// names the same contract the automatic alert does. recommended is null
// when nothing is within the cap — "expect assignment, or close manually".
export interface DefensiveRollAnalysis {
  maxDebitPerShare: number;
  candidates: DefensiveRollCandidate[];
  recommended: DefensiveRollCandidate | null;
}

export interface RollAnalysisResponse {
  symbol: string;
  mode: RollAnalysisMode;
  targetArrUsed: number;
  candidates: RollAnalysisCandidate[] | null; // null when the pool is empty — guard before spreading
  recommended: RollAnalysisCandidate | null;
  defensive: DefensiveRollAnalysis | null;
}

export interface RollAnalysisParams {
  symbol: string;
  currentStrike: number;
  currentDte: number;
  contracts: number;
  costToClose: number;
  mode: RollAnalysisMode;
  targetArr?: number;
}

export async function fetchRollAnalysis(
  params: RollAnalysisParams,
): Promise<RollAnalysisResponse> {
  const qs = new URLSearchParams({
    symbol: params.symbol,
    currentStrike: String(params.currentStrike),
    currentDte: String(params.currentDte),
    contracts: String(params.contracts),
    costToClose: String(params.costToClose),
    mode: params.mode,
  });
  if (params.targetArr != null) qs.set("targetArr", String(params.targetArr));

  const res = await fetch(`${rollAPIBase()}/roll-analysis?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      text || `roll analysis API failed for ${params.symbol}: ${res.status}`,
    );
  }
  return res.json();
}

export interface RollTarget {
  targetArrPercent: number;
}

export async function fetchRollTarget(): Promise<RollTarget> {
  const res = await fetch(`${rollAPIBase()}/roll-target`);
  if (!res.ok) {
    throw new Error(`roll-target API failed: ${res.status}`);
  }
  return res.json();
}

export async function setRollTarget(percent: number): Promise<RollTarget> {
  const res = await fetch(`${rollAPIBase()}/roll-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetArrPercent: percent }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `roll-target API failed: ${res.status}`);
  }
  return res.json();
}
