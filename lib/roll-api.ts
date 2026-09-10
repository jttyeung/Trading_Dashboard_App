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

export type RollAnalysisMode = "target_apy" | "max_cash";

export interface RollAnalysisCandidate {
  symbol: string;
  strike: number;
  expirationDate: string;
  dte: number;
  delta: number;
  premium: number;
  netCreditPerShare: number;
  netCreditTotal: number;
  resultingApy: number;
  meetsTarget: boolean;
}

export interface RollAnalysisResponse {
  symbol: string;
  mode: RollAnalysisMode;
  targetApyUsed: number;
  candidates: RollAnalysisCandidate[];
  recommended: RollAnalysisCandidate | null;
}

export interface RollAnalysisParams {
  symbol: string;
  currentStrike: number;
  currentDte: number;
  contracts: number;
  costToClose: number;
  mode: RollAnalysisMode;
  targetApy?: number;
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
  if (params.targetApy != null) qs.set("targetApy", String(params.targetApy));

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
  targetApyPercent: number;
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
    body: JSON.stringify({ targetApyPercent: percent }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `roll-target API failed: ${res.status}`);
  }
  return res.json();
}
