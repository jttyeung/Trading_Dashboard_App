// Client-side call into OptionsEvaluator's small settings API
// (internal/rollapi's /monthly-goal-target) for MonthlyGoalCard's
// target %/capital base override -- mirrors lib/roll-api.ts's exact
// fetch/base-URL shape. This used to be a localStorage-only preference,
// which turned out not to "stick" reliably (a different browser
// origin, cleared site data, a different device) -- moved to real
// backend persistence, same fix already applied to the roll-up target.
function monthlyGoalAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8095";
  return `${window.location.protocol}//${window.location.hostname}:8095`;
}

export interface MonthlyGoalTarget {
  targetPercent: number;
  capitalBase: number;
  hasOverride: boolean;
}

export async function fetchMonthlyGoalTarget(): Promise<MonthlyGoalTarget> {
  const res = await fetch(`${monthlyGoalAPIBase()}/monthly-goal-target`);
  if (!res.ok) {
    throw new Error(`monthly-goal-target API failed: ${res.status}`);
  }
  return res.json();
}

export async function setMonthlyGoalTarget(targetPercent: number, capitalBase: number): Promise<MonthlyGoalTarget> {
  const res = await fetch(`${monthlyGoalAPIBase()}/monthly-goal-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetPercent, capitalBase }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `monthly-goal-target API failed: ${res.status}`);
  }
  return res.json();
}
