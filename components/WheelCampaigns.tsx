// Wheel campaign cards (lib/campaigns.ts). Server components: the list page and
// the Options page preview both render these; the detail page has its own layout.
import Link from "next/link";
import { Card } from "./ui";
import { Amt } from "./privacy";
import { fmtMoney } from "@/lib/calc";
import { STAGE_CHIP, STAGE_LABEL, legCaptured, stageStep, type Campaign, type CampaignLeg } from "@/lib/campaigns";

export const px = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function Signed({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`${n >= 0 ? "text-emerald-400" : "text-rose-400"} ${className}`}>
      <Amt>{`${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`}</Amt>
    </span>
  );
}

export function StageChip({ c }: { c: Campaign }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STAGE_CHIP[c.stage]}`}>
      {STAGE_LABEL[c.stage]}
    </span>
  );
}

const STEPS = ["Puts", "Assigned", "Calls", "Exit"];

/** Four-segment track: how far along the wheel the campaign got. */
export function StageTrack({ c }: { c: Campaign }) {
  const at = stageStep(c);
  const reached = (i: number) =>
    !c.active ? i === 0 || i === 3 || (i === 1 && c.stage !== "put-only") || (i === 2 && c.legs.some((l) => l.optionType === "call")) : i <= at;
  const color = (i: number) => (i === 3 ? "bg-emerald-300" : i === 2 ? "bg-amber-300" : "bg-sky-300");
  return (
    <div>
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 rounded-full ${reached(i) ? color(i) : "bg-surface-2"}`} />
        ))}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-muted">
        {STEPS.map((s, i) => (
          <span key={s} className={c.active && i === at ? (i >= 2 ? "text-amber-300" : "text-sky-300") : ""}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function legLabel(l: CampaignLeg): string {
  const exp = new Date(`${l.expiration}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${l.contracts} × ${exp} $${l.strike}${l.optionType === "put" ? "P" : "C"}`;
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "44% captured", or for a leg now worth more than its credit "32% over credit". */
export function capturedText(l: CampaignLeg): string {
  const n = Math.round(legCaptured(l) * 100);
  return n >= 0 ? `${n}% captured` : `${-n}% over credit`;
}

/** A per-share basis that the premium has pushed to (or below) zero. */
export function basisText(n: number): string {
  return n > 0 ? px(n) : "$0 · premium covers it";
}

function footer(c: Campaign): string {
  const legs = c.sharesHeld > 0 ? [...c.openCalls, ...c.openPuts] : [...c.openPuts, ...c.openCalls];
  if (c.active && legs.length) {
    const shares = c.sharesHeld > 0 ? `${c.sharesHeld} sh · ` : "";
    const more = legs.length > 1 ? ` · +${legs.length - 1} more` : "";
    return `${shares}${legLabel(legs[0])} · ${capturedText(legs[0])}${more}`;
  }
  if (c.active) return `${c.sharesHeld} sh · avg ${px(c.shareCostPerShare ?? 0)}`;
  return `${shortDate(c.start)} → ${shortDate(c.end ?? c.start)} · ${c.legs.length} leg${c.legs.length === 1 ? "" : "s"}`;
}

/** The full card used on the campaigns list. */
export function CampaignCard({ c }: { c: Campaign }) {
  const basisLabel = c.adjustedBasis != null ? "Adj. basis" : c.ifAssignedBasis != null ? "If assigned" : "Return";
  const basisValue =
    c.adjustedBasis != null ? basisText(c.adjustedBasis) : c.ifAssignedBasis != null ? basisText(c.ifAssignedBasis) : `${pct(c.returnPct)}`;
  return (
    <Link href={`/options/wheel/${encodeURIComponent(c.id)}`} className="block active:opacity-80">
      <Card className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[17px] font-bold">{c.symbol}</span>
            {c.price != null && c.active && <span className="tabular text-xs text-muted">{px(c.price)}</span>}
          </div>
          <StageChip c={c} />
        </div>
        <div className="mt-3">
          <StageTrack c={c} />
        </div>
        <div className="tabular mt-3 grid grid-cols-3 gap-2">
          <div>
            <div className="text-[11px] text-muted">Premium</div>
            <div className="text-sm font-semibold">
              <Amt>{fmtMoney(c.premium)}</Amt>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted">{basisLabel}</div>
            <div className="text-sm font-semibold">{basisValue}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Net P/L</div>
            <div className="text-sm font-semibold">
              <Signed n={c.netPnl} />
            </div>
          </div>
        </div>
        {c.needsAction.length > 0 && (
          <div className="mt-2.5 rounded-lg bg-orange-500/10 px-2.5 py-1.5 text-xs text-orange-300">{c.needsAction.join(" · ")}</div>
        )}
        <div className="tabular mt-2.5 flex justify-between gap-2 border-t border-border pt-2.5 text-xs text-muted">
          <span className="min-w-0 truncate">{footer(c)}</span>
          <span className="shrink-0">{c.active ? `Day ${c.days}` : `${c.days}d · ${pct(c.annualized)}/yr`}</span>
        </div>
      </Card>
    </Link>
  );
}

/** One compact row for the Options page preview. */
export function CampaignRow({ c }: { c: Campaign }) {
  return (
    <Link
      href={`/options/wheel/${encodeURIComponent(c.id)}`}
      className="flex items-center justify-between gap-3 px-4 py-2.5 active:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{c.symbol}</span>
          <StageChip c={c} />
        </div>
        <div className="tabular mt-0.5 truncate text-[11px] text-muted">
          <Amt>{fmtMoney(c.premium)}</Amt> premium
          {c.adjustedBasis != null && <> · basis {basisText(c.adjustedBasis)}</>}
          {c.needsAction.length > 0 && <span className="text-orange-300"> · {c.needsAction[0]}</span>}
        </div>
      </div>
      <div className="tabular shrink-0 text-right text-sm font-semibold">
        <Signed n={c.netPnl} />
        <div className="text-[10px] font-normal text-muted">day {c.days}</div>
      </div>
    </Link>
  );
}
