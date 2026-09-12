import { Card, SectionTitle } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney, fmtPct } from "@/lib/calc";
import type { PortfolioRisk, RiskReading, ThetaStatus, OpenPnlStatus, SectorBucket, RiskRules } from "@/lib/types";

// Ported from jttyeung's fork (components/PortfolioRiskView.tsx on her staging
// branch), trimmed to what this bridge can feed: theta, open P&L and the sector
// breakout. Every band the gauges draw comes from `risk.rules`, never from a
// literal here.

const THETA_STYLE: Record<ThetaStatus, { label: string; chip: string }> = {
  below_target: { label: "Below target", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  on_target: { label: "On target", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  above_target_below_ceiling: { label: "Above target", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  over_ceiling: { label: "Over ceiling", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  unknown: { label: "Unknown", chip: "bg-surface-2 text-muted ring-border" },
};

const OPEN_PNL_STYLE: Record<OpenPnlStatus, { label: string; chip: string }> = {
  on_target: { label: "On target", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  below_target: { label: "Below floor", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  unknown: { label: "Unknown", chip: "bg-surface-2 text-muted ring-border" },
};

function Chip({ label, chip }: { label: string; chip: string }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chip}`}>{label}</span>;
}

function ThetaGauge({ risk, rules }: { risk: RiskReading; rules: RiskRules }) {
  const status = THETA_STYLE[risk.thetaStatus];
  // Gauge spans 0 to 1.5x the hard ceiling so "on target" and "over ceiling"
  // both have visible room either side.
  const gaugeMax = rules.theta.maxPct * 1.5;
  const frac = (v: number) => (gaugeMax > 0 ? Math.min(1, Math.max(0, v / gaugeMax)) : 0);
  const pct = frac(risk.thetaPct);
  const minPct = frac(rules.theta.minPct);
  const targetMaxPct = frac(rules.theta.targetMaxPct);
  const ceilingPct = frac(rules.theta.maxPct);
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted">Theta today</div>
          <div className="tabular text-lg font-bold leading-tight">
            <Amt>{`${risk.thetaToday >= 0 ? "+" : "−"}${fmtMoney(Math.abs(risk.thetaToday))}`}</Amt>/day
          </div>
          <div className="tabular text-[11px] text-muted">{(risk.thetaPct * 100).toFixed(2)}% of portfolio value</div>
          {risk.thetaGapToTarget > 0 && (
            <div className="tabular text-[11px] text-sky-300">
              +<Amt>{fmtMoney(risk.thetaGapToTarget)}</Amt>/day to reach target
            </div>
          )}
        </div>
        <Chip {...status} />
      </div>
      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="absolute inset-y-0 bg-emerald-500/25" style={{ left: `${minPct * 100}%`, width: `${Math.max(0, targetMaxPct - minPct) * 100}%` }} />
        <div className="absolute inset-y-0 w-px bg-rose-400/70" style={{ left: `${ceilingPct * 100}%` }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${risk.thetaStatus === "over_ceiling" ? "bg-rose-400" : "bg-sky-400"}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0%</span>
        <span>target {(rules.theta.minPct * 100).toFixed(2)}–{(rules.theta.targetMaxPct * 100).toFixed(2)}%</span>
        <span>ceiling {(rules.theta.maxPct * 100).toFixed(2)}%</span>
      </div>
    </div>
  );
}

function OpenPnLRow({ risk, rules }: { risk: RiskReading; rules: RiskRules }) {
  const s = OPEN_PNL_STYLE[risk.openPnLStatus];
  return (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted">Open P&L</div>
        <div className="tabular text-lg font-bold leading-tight">
          <Amt>{`${risk.openPnL >= 0 ? "+" : "−"}${fmtMoney(Math.abs(risk.openPnL))}`}</Amt>
        </div>
        <div className="tabular text-[11px] text-muted">
          {fmtPct(risk.openPnLPct)} of portfolio · floor {(rules.openPnl.minPct * 100).toFixed(0)}%
        </div>
      </div>
      <Chip {...s} />
    </div>
  );
}

function tickerList(b: SectorBucket): string {
  const names = b.tickers.map((t) => t.symbol);
  return names.length > 6 ? `${names.slice(0, 6).join(" · ")} +${names.length - 6}` : names.join(" · ");
}

export function SectorBars({ sectors, rules, compact = false }: { sectors: SectorBucket[]; rules: RiskRules; compact?: boolean }) {
  if (sectors.length === 0) {
    return <p className="text-[11px] text-muted">No sector exposure from current positions.</p>;
  }
  const hasUnclassified = sectors.some((b) => b.unclassified);
  return (
    <div className="space-y-2">
      {sectors.map((b) => {
        const tone = b.over ? "text-rose-300" : b.unclassified ? "text-amber-300" : "";
        return (
          <div key={b.sector}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className={`min-w-0 truncate ${tone} ${b.over ? "font-semibold" : ""}`}>{b.sector}</span>
              <span className={`tabular shrink-0 ${b.over ? "font-semibold text-rose-300" : "text-muted"}`}>
                <Amt>{fmtMoney(b.value)}</Amt> · {(b.pct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${b.over ? "bg-rose-400" : b.unclassified ? "bg-amber-400/70" : "bg-sky-400"}`} style={{ width: `${Math.min(100, b.pct * 100)}%` }} />
            </div>
            {!compact && <div className="mt-0.5 truncate text-[10px] text-muted">{tickerList(b)}</div>}
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-muted">
        Sector cap: {(rules.sector.maxAllocationPct * 100).toFixed(0)}% of portfolio value per sector. Capital counts stock
        value, CSP collateral, LEAP market value and spread risk — the same figures as the Holdings table.
      </p>
      {hasUnclassified && !compact && (
        <p className="text-[10px] text-amber-300/80">
          Unclassified tickers have no sector from Yahoo yet. Add them under <span className="font-mono">overrides</span> in{" "}
          <span className="font-mono">data/sectors.json</span> to place them by hand.
        </p>
      )}
    </div>
  );
}

export function PortfolioRiskView({ risk }: { risk: PortfolioRisk }) {
  const { overall, sectors, perAccount, rules } = risk;
  return (
    <div>
      <SectionTitle>Sector concentration</SectionTitle>
      <Card className="px-4 py-4">
        <div className="mb-3 text-[10px] text-muted">
          <Amt>{fmtMoney(overall.portfolioValue)}</Amt> total across {perAccount.length} account{perAccount.length === 1 ? "" : "s"}
        </div>
        <SectorBars sectors={sectors} rules={rules} />
      </Card>

      <SectionTitle>Overall portfolio</SectionTitle>
      <Card className="px-4 py-4">
        <ThetaGauge risk={overall} rules={rules} />
        <div className="mt-3">
          <OpenPnLRow risk={overall} rules={rules} />
        </div>
      </Card>

      {perAccount.length > 1 && (
        <>
          <SectionTitle>Per account — theta</SectionTitle>
          {perAccount.map((a) => (
            <Card key={a.accountId} className="mb-2 px-4 py-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>{a.accountLabel}</span>
                <span className="tabular font-normal text-muted">
                  <Amt>{fmtMoney(a.portfolioValue)}</Amt>
                </span>
              </div>
              <ThetaGauge risk={a} rules={rules} />
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
