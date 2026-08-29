import { Card, SectionTitle } from "@/components/ui";
import type { Alert } from "@/lib/types";

const ACTION_STYLE: Record<Alert["action"], { label: string; chip: string }> = {
  close: { label: "Close", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  roll: { label: "Roll", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  monitor: { label: "Monitor", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
};

// Position alerts (close/roll/monitor) — always the tracker's current full
// set, not history (position_alerts is wiped and rewritten each cycle).
// Sorted with close first, then roll, then monitor, since that's roughly
// urgency order; ties broken by DTE (soonest first).
const ACTION_RANK: Record<Alert["action"], number> = { close: 0, roll: 1, monitor: 2 };

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => ACTION_RANK[a.action] - ACTION_RANK[b.action] || a.dte - b.dte);

  return (
    <>
      <SectionTitle>Needs attention</SectionTitle>
      <Card className="divide-y divide-border p-0">
        {sorted.map((a) => {
          const style = ACTION_STYLE[a.action];
          return (
            <div key={a.contractSymbol} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{a.ticker}</span>
                  <span className="text-[11px] text-muted">
                    ${a.strike} {a.putCall} · {a.dte}d
                  </span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${style.chip}`}>
                  {style.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{a.rationale}</p>
              {a.rollToSymbol && (
                <div className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-500/20">
                  Roll to <span className="font-medium">${a.rollToStrike}</span> exp {a.rollToExpirationDate} (
                  {a.rollToDte} DTE, Δ{a.rollToDelta?.toFixed(2)}
                  {a.rollToNetCredit != null && (
                    <>
                      , net {a.rollToNetCredit >= 0 ? "credit" : "debit"} ${Math.abs(a.rollToNetCredit).toFixed(2)}/sh
                    </>
                  )}
                  )
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
