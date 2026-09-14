// Client-side call into OptionsEvaluator's small settings API
// (internal/rollapi's /alert-reads) for AlertsPanel's "mark read"
// checkmarks -- mirrors lib/monthly-goal-api.ts's exact fetch/base-URL
// shape. This used to be localStorage-only, which meant an alert checked
// off on the desktop came right back as unread on the phone -- the
// third per-viewer preference to hit that wall (roll target and monthly
// goal before it), so it gets the same fix: real backend persistence.
function alertReadsAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8095";
  return `${window.location.protocol}//${window.location.hostname}:8095`;
}

export interface AlertReads {
  contractSymbols: string[];
}

export async function fetchAlertReads(): Promise<AlertReads> {
  const res = await fetch(`${alertReadsAPIBase()}/alert-reads`);
  if (!res.ok) {
    throw new Error(`alert-reads API failed: ${res.status}`);
  }
  return res.json();
}

// One symbol, one direction per call -- deliberately not a full-list
// replace, so two devices toggling at once can't overwrite each other's
// checkmarks with their own stale list. The server echoes back its full
// current list so the caller can adopt it wholesale.
export async function setAlertRead(contractSymbol: string, read: boolean): Promise<AlertReads> {
  const res = await fetch(`${alertReadsAPIBase()}/alert-reads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contractSymbol, read }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `alert-reads API failed: ${res.status}`);
  }
  return res.json();
}
