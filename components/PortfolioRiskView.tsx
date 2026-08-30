import { Card, SectionTitle } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import type { RiskView, AccountRiskView } from "@/lib/types";

const STATUS_STYLE: Record<RiskView["thetaStatus"], { label: string; chip: string }> = {
  below_target: { label: "Below target", chip: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  on_target: { label: "On target", chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  above_target_below_ceiling: { label: "Above target", chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  over_ceiling: { label: "Over ceiling", chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
  unknown: { label: "Unknown", chip: "bg-surface-2 text-muted ring-border" },
};

function ThetaGauge({ risk }: { risk: RiskView }) {
  const status = STATUS_STYLE[risk.thetaStatus];
  // Gauge spans 0 to 1.5x the hard ceiling so "on target" and "over ceiling"
  // both have visible room either side.
  const gaugeMax = risk.thetaMaxPct * 1.5;
  const pct = gaugeMax > 0 ? Math.min(1, Math.max(0, risk.thetaPct / gaugeMax)) : 0;
  const minPct = gaugeMax > 0 ? risk.thetaMinPct / gaugeMax : 0;
  const targetMaxPct = gaugeMax > 0 ? risk.thetaTargetMaxPct / gaugeMax : 0;
  const ceilingPct = gaugeMax > 0 ? risk.thetaMaxPct / gaugeMax : 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted">Theta today</div>
          <div className="tabular text-lg font-bold leading-tight">
            <Amt>{`${risk.thetaToday >= 0 ? "+" : "−"}${fmtMoney(Math.abs(risk.thetaToday))}`}</Amt>/day
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.chip}`}>
          {status.label}
        </span>
      </div>
      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {/* target band */}
        <div
          className="absolute inset-y-0 bg-emerald-500/25"
          style={{ left: `${minPct * 100}%`, width: `${Math.max(0, targetMaxPct - minPct) * 100}%` }}
        />
        {/* ceiling marker */}
        <div className="absolute inset-y-0 w-px bg-rose-400/70" style={{ left: `${ceilingPct * 100}%` }} />
        {/* current value */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${risk.thetaStatus === "over_ceiling" ? "bg-rose-400" : "bg-sky-400"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0%</span>
        <span>target {(risk.thetaMinPct * 100).toFixed(2)}–{(risk.thetaTargetMaxPct * 100).toFixed(2)}%</span>
        <span>ceiling {(risk.thetaMaxPct * 100).toFixed(2)}%</span>
      </div>
    </div>
  );
}

function SectorBars({ risk, portfolioValue }: { risk: RiskView; portfolioValue: number }) {
  const sectors = Object.entries(risk.sectorValues).sort((a, b) => b[1] - a[1]);
  if (sectors.length === 0) {
    return <p className="text-[11px] text-muted">No sector exposure from current positions.</p>;
  }
  return (
    <div className="space-y-2">
      {sectors.map(([sector, value]) => {
        const pct = portfolioValue > 0 ? value / portfolioValue : 0;
        const over = pct > risk.maxSectorAllocationPct;
        return (
          <div key={sector}>
            <div className="flex items-center justify-between text-[11px]">
              <span className={over ? "font-semibold text-rose-300" : "text-text"}>{sector}</span>
              <span className={`tabular ${over ? "font-semibold text-rose-300" : "text-muted"}`}>
                <Amt>{fmtMoney(value)}</Amt> · {(pct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${over ? "bg-rose-400" : "bg-sky-400"}`}
                style={{ width: `${Math.min(100, pct * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[10px] text-muted">Sector cap: {(risk.maxSectorAllocationPct * 100).toFixed(0)}% per sector</p>
    </div>
  );
}

export function PortfolioRiskView({ overall, perAccount }: { overall: RiskView; perAccount: AccountRiskView[] }) {
  return (
    <div>
      <Card className="px-4 py-4">
        <ThetaGauge risk={overall} />
      </Card>

      <SectionTitle>Sector exposure (overall)</SectionTitle>
      <Card className="px-4 py-4">
        <SectorBars risk={overall} portfolioValue={overall.portfolioValue} />
      </Card>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        Only the overall (blended) numbers above actually gate a new suggestion — accounts here are mostly
        tax/custodial wrappers, not independent risk pools. The per-account breakdown below is for visibility only.
      </p>

      <SectionTitle>Per account</SectionTitle>
      {perAccount.map((a) => (
        <Card key={a.accountLabel} className="mb-2 px-4 py-4">
          <div className="mb-2 text-xs font-semibold">{a.accountLabel}</div>
          <ThetaGauge risk={a} />
          <div className="mt-3 border-t border-border pt-3">
            <SectorBars risk={a} portfolioValue={a.portfolioValue} />
          </div>
        </Card>
      ))}
    </div>
  );
}
