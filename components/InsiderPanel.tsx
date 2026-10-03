"use client";

// Insider activity under the chart. Trades are open-market purchases and sales
// only (Form 4 codes P and S): grants, option exercises and tax withholding
// aren't decisions to buy or sell, and they were most of the raw filings (GLW:
// 328 of 362 rows in a year). Each trade carries the insider's role and title
// and whether it was made under a pre-arranged 10b5-1 plan, all from the Form 4
// itself. A planned sale was scheduled months ahead, so discretionary trades,
// and purchases above all, are the ones that say something.
import { Card } from "@/components/ui";
import { AQUA, AXIS, H, ORANGE, PAD, W, Axis, Legend, Panel, Row, barPath, fmtMoney, niceScale, useColumns } from "@/components/mini-charts";
import type { InsiderRole, InsiderTrade, Ownership } from "@/lib/ownership";

// Planned (10b5-1) sales: the same hue as discretionary sales, lighter, so a
// sold bar reads as one quantity split into its two parts.
const ORANGE_PLANNED = "rgba(217, 89, 38, 0.4)";

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

function PlanTag({ t }: { t: InsiderTrade }) {
  if (t.planned == null) return null;
  return t.planned ? (
    <span className="rounded bg-surface-2 px-1 text-[9px] text-muted">10b5-1 plan</span>
  ) : (
    <span className="rounded bg-amber-400/15 px-1 text-[9px] text-amber-300">discretionary</span>
  );
}

// One row per role group: bought on its own bar, sold split into
// discretionary (solid) and planned (light), all on one scale so groups compare.
function ByRole({ roles }: { roles: InsiderRole[] }) {
  const max = Math.max(1, ...roles.flatMap((r) => [r.buyValue, r.sellValue]));
  const w = (v: number) => `${(v / max) * 100}%`;
  return (
    <ul className="space-y-2 px-1 text-[11px]">
      {roles.map((r) => {
        const discretionary = r.sellValue - r.plannedSellValue;
        const people = r.sellers.length + r.buyers.length;
        return (
          <li key={r.role}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="font-medium text-text">{r.role}</span>
              <span className="truncate text-[10px] text-muted">
                {people} {people === 1 ? "person" : "people"}
              </span>
            </div>
            {r.buyValue > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 flex-1">
                  <div className="h-full rounded-r" style={{ width: w(r.buyValue), backgroundColor: AQUA }} />
                </div>
                <span className="tabular w-28 shrink-0 text-right text-muted">Bought {fmtMoney(r.buyValue)}</span>
              </div>
            )}
            {r.sellValue > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex h-2.5 flex-1">
                  <div className="h-full" style={{ width: w(discretionary), backgroundColor: ORANGE }} />
                  <div className="h-full rounded-r" style={{ width: w(r.plannedSellValue), backgroundColor: ORANGE_PLANNED }} />
                </div>
                <span className="tabular w-28 shrink-0 text-right text-muted">Sold {fmtMoney(r.sellValue)}</span>
              </div>
            )}
            {r.sellValue > 0 && (
              <div className="text-[10px] text-muted">
                {r.plannedSellValue === 0
                  ? "all discretionary"
                  : discretionary <= 0.005 * r.sellValue
                    ? "all under 10b5-1 plans"
                    : `${fmtMoney(discretionary)} discretionary · ${fmtMoney(r.plannedSellValue)} planned`}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
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

  const anyTrades = data.trades.length > 0;
  return (
    <Card className="mt-3 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h2 className="text-sm font-semibold">Insider activity</h2>
        <span className="text-[10px] text-muted">Open-market trades only · SEC Form 4</span>
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

        {data.roles.length > 0 && (
          <Panel title="By role" note="Last 12 months · who traded, and how much selling was planned">
            <ByRole roles={data.roles} />
            <Legend items={[{ label: "Bought", color: AQUA }, { label: "Sold, discretionary", color: ORANGE }, { label: "Sold, 10b5-1 plan", color: ORANGE_PLANNED }]} />
          </Panel>
        )}

        {anyTrades && (
          <Panel title="Recent insider trades" note="Purchases and discretionary sales are the stronger signals">
            <ul className="divide-y divide-border/60 px-1 text-[11px]">
              {data.trades.slice(0, 8).map((t, i) => (
                <li key={`${t.date}-${t.name}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-text">{t.name}</span>
                      {t.role && <span className="shrink-0 rounded bg-violet-400/15 px-1 text-[9px] text-violet-300">{t.role}</span>}
                    </div>
                    {t.title && <div className="truncate text-[10px] text-muted">{t.title}</div>}
                    <div className="flex items-center gap-1 text-[10px] text-muted">
                      {fmtDate(t.date)} · {fmtShares(t.shares)} sh @ ${t.price.toFixed(2)} <PlanTag t={t} />
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
      </div>
    </Card>
  );
}
