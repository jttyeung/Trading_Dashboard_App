// Options volume leaders (components/OptionsVolumeLeaders.tsx). Mirrors
// OptionsEvaluator's internal/chartapi OptionsVolumeResponse: per watchlist
// ticker, the latest session's call and put volume, saved by the options agent
// from the chains it already pulls. Activity, not direction: a chain can't
// tell a bought contract from a sold one, or an institution from retail.

export interface TopContract {
  symbol: string;
  strike: number;
  expiration: string;
  volume: number;
  oi: number;
  premium: number;
}

export interface OptionsVolumeRow {
  ticker: string;
  spot: number;
  callVolume: number;
  putVolume: number;
  callPremium: number; // ≈ volume × mark at snapshot × 100
  putPremium: number;
  callOI: number;
  putOI: number;
  putCallRatio: number | null;
  relVolume: number | null; // today's contracts ÷ the ticker's own prior-session average
  topCall: TopContract | null;
  topPut: TopContract | null;
}

export interface OptionsVolume {
  date: string; // ET session
  updatedAt: string; // UTC, "YYYY-MM-DD HH:MM:SS"
  rows: OptionsVolumeRow[];
  historyDays: number;
}

export async function fetchOptionsVolume(): Promise<OptionsVolume> {
  const res = await fetch("/api/options-volume", { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as (OptionsVolume & { error?: string }) | null;
  if (!res.ok || !body || body.error) throw new Error(body?.error ?? `options volume failed (${res.status})`);
  return body;
}
