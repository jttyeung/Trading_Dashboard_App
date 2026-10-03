"use client";

// Insider activity and 5%+ holders under the chart. Insider trades are
// open-market purchases and sales only (Form 4 codes P and S): grants, option
// exercises and tax withholding aren't decisions to buy or sell, and they were
// most of the raw filings (GLW: 328 of 362 rows in a year). Purchases are the
// stronger signal; a sale can be a pre-scheduled 10b5-1 plan, which the data
// doesn't flag. Holders are SEC Schedule 13G filers; one whose latest filing is
// over a year old may have changed since, so it's marked rather than hidden.
import { Card } from "@/components/ui";
import { AQUA, AXIS, H, ORANGE, PAD, W, Axis, Legend, Panel, Row, barPath, fmtMoney, niceScale, useColumns } from "@/components/mini-charts";
import type { Ownership } from "@/lib/ownership";

const STALE_DAYS = 365;

function monthLabel(ym: string): string {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function fmtShares(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Buys above zero, sells below, one column per month.
function MonthlyFlow({ months }: { months: Ownership["months"] }) {
  const { targets, tooltip, step } = useColumns(months.length);
  const vals = months.flatMap((m) => [m.buyValue, -m.sellValue]);
  const { ticks, y } = niceScale(vals.some((v) => v !== 0) ? vals : [0, 1]);
  const barW = Math.min(step * 0.6, 22);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Insider open-market buying and selling by month">
        <Axis ticks={ticks} y={y} fmt={fmtMoney} />
        {months.map((m, i) => {
          const x = PAD.left + step * i + (step - barW) / 2;
          return (
            <g key={m.month}>
              {m.buyValue > 0 && <path d={barPath(x, barW, y(0), y(m.buyValue))} fill={AQUA} />}
              {m.sellValue > 0 && <path d={barPath(x, barW, y(0), y(-m.sellValue))} fill={ORANGE} />}
            </g>
          );
        })}
        {months.map((m, i) => (
          <text key={m.month} x={PAD.left + step * (i + 0.5)} y={H - 5} textAnchor="middle" fontSize={8.5} fill={AXIS}>
            {monthLabel(m.month)}
          </text>
        ))}
        {targets}
      </svg>
      {tooltip((i) => (
        <>
          <div className="mb-0.5 font-medium text-text">{monthLabel(months[i].month)} {months[i].month.slice(0, 4)}</div>
          <Row color={AQUA} label="Bought" value={months[i].buyValue ? fmtMoney(months[i].buyValue) : "—"} />
          <Row color={ORANGE} label="Sold" value={months[i].sellValue ? fmtMoney(months[i].sellValue) : "—"} />
        </>
      ))}
    </div>
  );
}

export function InsiderPanel({ data, error, loading }: { data: Ownership | null; error: string | null; loading: boolean }) {
  if (loading && !data) {
    return <Card className="mt-3 px-4 py-6 text-center text-xs text-muted">Loading insider activity…</Card>;
  }
  if (error) {
    return <Card className="mt-3 px-4 py-4 text-xs text-muted">Insider activity: {error}</Card>;
  }
  if (!data) return null;

  // Staleness is judged against when the data was fetched, not the render clock.
  const now = Date.parse(data.fetchedAt);
  const anyTrades = data.trades.length > 0;
  return (
    <Card className="mt-3 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h2 className="text-sm font-semibold">Insiders &amp; major holders</h2>
        <span className="text-[10px] text-muted">Open-market trades only · Form 4 &amp; SEC 13G</span>
      </div>
      <div className="grid gap-2">
        <Panel title="Insider buying vs selling" note="Last 12 months · grants, exercises and tax withholding excluded">
          <div className="mb-2 grid grid-cols-3 gap-1.5 px-1">
            {data.windows.map((w) => (
              <div key={w.months} className="rounded-lg bg-surface-2 px-2 py-1.5 text-[11px]">
                <div className="mb-0.5 text-[10px] text-muted">{w.months} months</div>
                <div className="flex justify-between gap-1">
                  <span className="text-muted">Buys</span>
                  <span className="tabular text-text">{w.buyValue ? fmtMoney(w.buyValue) : "—"}</span>
                </div>
                <div className="text-right text-[10px] text-muted">{w.buyers ? `${w.buyers} insider${w.buyers > 1 ? "s" : ""}` : "none"}</div>
                <div className="flex justify-between gap-1">
                  <span className="text-muted">Sells</span>
                  <span className="tabular text-text">{w.sellValue ? fmtMoney(w.sellValue) : "—"}</span>
                </div>
                <div className="text-right text-[10px] text-muted">{w.sellers ? `${w.sellers} insider${w.sellers > 1 ? "s" : ""}` : "none"}</div>
              </div>
            ))}
          </div>
          {anyTrades ? (
            <>
              <MonthlyFlow months={data.months} />
              <Legend items={[{ label: "Bought", color: AQUA }, { label: "Sold", color: ORANGE }]} />
            </>
          ) : (
            <p className="px-1 py-4 text-center text-[11px] text-muted">No open-market insider trades in the last 12 months.</p>
          )}
        </Panel>

        {anyTrades && (
          <Panel title="Recent insider trades" note="Sales can be pre-scheduled (10b5-1); purchases are the stronger signal">
            <ul className="divide-y divide-border/60 px-1 text-[11px]">
              {data.trades.slice(0, 8).map((t, i) => (
                <li key={`${t.date}-${t.name}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-text">{t.name}</div>
                    <div className="text-[10px] text-muted">
                      {fmtDate(t.date)} · {fmtShares(t.shares)} sh @ ${t.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular text-text">{fmtMoney(t.value)}</div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-muted">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: t.buy ? AQUA : ORANGE }} />
                      {t.buy ? "Bought" : "Sold"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="5%+ holders" note="Latest Schedule 13G per holder">
          {data.holders.length === 0 ? (
            <p className="px-1 py-4 text-center text-[11px] text-muted">No 5%+ holder filings on record.</p>
          ) : (
            <ul className="divide-y divide-border/60 px-1 text-[11px]">
              {data.holders.map((h) => {
                const stale = now - Date.parse(`${h.filed}T00:00:00Z`) > STALE_DAYS * 864e5;
                return (
                  <li key={h.name} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-text">{h.name}</div>
                      <div className="text-[10px] text-muted">
                        {fmtShares(h.shares)} sh · {h.asOf ? `as of ${fmtDate(h.asOf)}` : `filed ${fmtDate(h.filed)}`}
                        {stale && <span className="text-amber-300"> · last filed over a year ago, may be out of date</span>}
                      </div>
                    </div>
                    <span className="tabular shrink-0 text-text">{h.percent.toFixed(2)}%</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </Card>
  );
}
