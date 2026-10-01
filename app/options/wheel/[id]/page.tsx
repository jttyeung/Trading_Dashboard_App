import type { ReactNode } from "react";
import Link from "next/link";
import { BackLink, Card, PageHeader, SectionTitle } from "@/components/ui";
import { Amt, ShowAmounts } from "@/components/privacy";
import { Signed, StageChip, basisText, capturedText, legLabel, pct, px, shortDate } from "@/components/WheelCampaigns";
import { getSnapshot } from "@/lib/snapshot";
import { getCampaigns } from "@/lib/campaigns-load";
import { CLOSE_AT, legCaptured, legDte, type Campaign, type CampaignLeg, type ShareEvent } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/calc";

export const dynamic = "force-dynamic";

const MULT = 100;

type Row = { date: string; dot: string; title: string; sub: string; amount: number | null; plain?: string };

function legRow(l: CampaignLeg): Row {
  const kind = l.optionType === "put" ? "P" : "C";
  const dot = l.optionType === "put" ? "bg-sky-300" : "bg-amber-300";
  const per = (n: number) => (n / (MULT * l.contracts)).toFixed(2);
  const net = l.credit - l.debit;
  const name = `${shortDate(l.expiration)} $${l.strike}${kind}`;
  if (l.outcome === "open")
    return { date: l.openedAt, dot, title: `Sold ${legLabel(l)} @ ${per(l.credit)}`, sub: `${shortDate(l.openedAt)} · open, mark ${l.mark?.toFixed(2) ?? "—"}`, amount: l.credit };
  const what = l.outcome === "assigned" ? (l.optionType === "put" ? "assigned" : "called away") : l.outcome === "expired" ? "expired" : "closed";
  const how = l.outcome === "closed" ? `${per(l.credit)} in, ${per(l.debit)} out` : `${per(l.credit)} kept`;
  return { date: l.closedAt!, dot, title: `${l.contracts} × ${name} · ${what}`, sub: `${shortDate(l.openedAt)} → ${shortDate(l.closedAt!)} · ${how}`, amount: net };
}

function shareRow(s: ShareEvent): Row {
  const title =
    s.kind === "assigned"
      ? `Assigned ${s.shares} sh @ ${px(s.price)}`
      : s.kind === "called-away"
        ? `Called away ${s.shares} sh @ ${px(s.price)}`
        : s.kind === "sold"
          ? `Sold ${s.shares} sh @ ${px(s.price)}`
          : `Shares already held: ${s.shares} @ ${px(s.price)}`;
  return {
    date: s.date,
    dot: "bg-[var(--text)]",
    title,
    sub: `${shortDate(s.date)}${s.estimated ? " · price estimated (before the trade history)" : ""}`,
    amount: null,
    plain: fmtMoney(s.shares * s.price),
  };
}

function Line({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className={`tabular flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function NextStep({ c, quotes }: { c: Campaign; quotes: { dte: number; strike: number; mark: number }[] }) {
  const legs = c.sharesHeld > 0 ? [...c.openCalls, ...c.openPuts] : [...c.openPuts, ...c.openCalls];
  if (legs.length) {
    const floor = c.adjustedBasis;
    const anyCall = legs.some((l) => l.optionType === "call");
    return (
      <Card className="flex flex-col gap-3 p-3.5">
        {legs.map((open) => {
          const cap = legCaptured(open);
          const per = open.credit / (MULT * open.contracts);
          const target = per * (1 - CLOSE_AT);
          const isPut = open.optionType === "put";
          return (
            <div key={open.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{legLabel(open)}</span>
                <span className="tabular text-xs text-muted">{legDte(open)} DTE</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface-2">
                <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(1, cap)) * 100}%` }} />
                {isPut && <div className="absolute -top-[3px] h-3 w-0.5 bg-[var(--text)]" style={{ left: `${CLOSE_AT * 100}%` }} />}
              </div>
              <div className="tabular flex justify-between text-[11px] text-muted">
                <span>
                  {capturedText(open)} · sold {per.toFixed(2)}, mark {open.mark?.toFixed(2) ?? "—"}
                </span>
                {isPut ? (
                  <span className={cap >= CLOSE_AT ? "text-emerald-300" : ""}>{cap >= CLOSE_AT ? "at target — close" : `50% at ${target.toFixed(2)}`}</span>
                ) : (
                  <span>runs to expiration</span>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted">
          {anyCall
            ? floor != null
              ? `Calls run to expiration — expire or get called away. Then sell the next 7–21 day call at or above ${basisText(floor)}.`
              : "Calls run to expiration — expire or get called away. Then sell the next call."
            : c.ifAssignedBasis != null
              ? `If assigned, the shares would cost ${basisText(c.ifAssignedBasis)} after premium.`
              : ""}
        </p>
      </Card>
    );
  }
  if (c.stage === "shares") {
    const floor = c.adjustedBasis ?? 0;
    const ok = quotes.filter((q) => q.strike >= floor).sort((a, b) => a.strike - b.strike);
    return (
      <Card className="flex flex-col gap-1.5 p-3.5">
        <span className="text-sm font-semibold">Sell a call at or above {px(floor)}</span>
        {ok.length > 0 ? (
          ok.slice(0, 3).map((q) => (
            <div key={`${q.dte}-${q.strike}`} className="tabular flex justify-between text-xs text-muted">
              <span>
                {q.dte}d ${q.strike}C
              </span>
              <span>
                {q.mark.toFixed(2)} · <Amt>{fmtMoney(q.mark * c.sharesHeld)}</Amt>
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted">None of the bridge&apos;s quoted calls (~30Δ) clear the adjusted basis — wait, or check the chain.</p>
        )}
      </Card>
    );
  }
  return null;
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const cid = decodeURIComponent(raw);
  const snap = await getSnapshot();
  const { data, campaigns } = await getCampaigns(snap);
  const c = campaigns.find((x) => x.id === cid);

  if (!c) {
    return (
      <main className="px-4">
        <PageHeader title="Campaign" right={<BackLink href="/options/wheel" />} />
        <p className="mt-6 text-center text-sm text-muted">
          That campaign isn&apos;t in this account&apos;s history. <Link href="/options/wheel" className="text-sky-300">All campaigns ›</Link>
        </p>
      </main>
    );
  }

  const equity = data.equities.find((e) => e.symbol.toUpperCase() === c.symbol);
  const others = campaigns.filter((x) => x.symbol === c.symbol && x.id !== c.id);
  const putPrem = c.legs.filter((l) => l.optionType === "put").reduce((s, l) => s + l.credit - l.debit, 0);
  const callPrem = c.legs.filter((l) => l.optionType === "call").reduce((s, l) => s + l.credit - l.debit, 0);
  const openLegs = [...c.openPuts, ...c.openCalls];
  const openPnl = openLegs.reduce((s, l) => s + l.credit - (l.mark ?? 0) * MULT * l.contracts, 0);
  const closedPrem = c.premium - openLegs.reduce((s, l) => s + l.credit, 0);
  const showBasis = c.sharesHeld > 0 && c.shareCostPerShare != null && c.adjustedBasis != null;
  const rows = [...c.legs.map(legRow), ...c.shareEvents.map(shareRow)].sort((a, b) => b.date.localeCompare(a.date));
  const quotes = (equity?.coveredCalls ?? []).map((q) => ({ dte: q.dte, strike: q.strike, mark: q.mark }));

  return (
    <main className="px-4">
      <ShowAmounts>
        <PageHeader
          title={c.symbol}
          subtitle={`${c.price != null ? `${px(c.price)} · ` : ""}started ${shortDate(c.start)}${c.end ? ` · ended ${shortDate(c.end)}` : ""} · ${c.active ? `day ${c.days}` : `${c.days} days`}`}
          right={
            <div className="flex items-center gap-2">
              <StageChip c={c} />
              <BackLink href="/options/wheel" />
            </div>
          }
        />

        <Card className="mt-3 p-4">
          <div className="text-xs text-muted">{c.active ? "Net P/L, campaign to date" : "Net P/L"}</div>
          <div className="tabular mt-0.5 text-3xl font-bold">
            <Signed n={c.netPnl} />
          </div>
          <div className="tabular text-xs text-muted">
            {pct(c.returnPct)} on <Amt>{fmtMoney(c.capital)}</Amt> · {pct(c.annualized)} annualized
          </div>
          <div className="tabular mt-3.5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-surface-2 p-2.5">
              <div className="text-[11px] text-muted">Premium</div>
              <div className="text-[15px] font-semibold">
                <Amt>{fmtMoney(c.premium)}</Amt>
              </div>
              <div className="text-[10px] text-muted">
                {c.legs.length} leg{c.legs.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 p-2.5">
              <div className="text-[11px] text-muted">Shares</div>
              <div className="text-[15px] font-semibold">
                <Signed n={c.sharePnl} />
              </div>
              <div className="text-[10px] text-muted">at raw prices</div>
            </div>
            <div className="rounded-xl bg-surface-2 p-2.5">
              <div className="text-[11px] text-muted">{openLegs.length ? "Open legs" : "Closed legs"}</div>
              <div className="text-[15px] font-semibold">
                <Signed n={openLegs.length ? openPnl : closedPrem} />
              </div>
              <div className="text-[10px] text-muted">{openLegs.length ? "credit − cost to close" : "kept"}</div>
            </div>
          </div>
          {c.estimatedBasis && (
            <p className="mt-2.5 text-[11px] text-orange-300">
              Some share prices are estimated — the shares predate the trade history or left without a record.
            </p>
          )}
        </Card>

        {c.needsAction.length > 0 && (
          <div className="mt-3 rounded-xl bg-orange-500/10 px-3 py-2 text-xs text-orange-300">{c.needsAction.join(" · ")}</div>
        )}

        {showBasis && (
          <>
            <SectionTitle>Cost basis</SectionTitle>
            <Card className="flex flex-col gap-2.5 p-4 text-[13px]">
              <Line k={`Share cost (${c.sharesHeld} sh)`} v={px(c.shareCostPerShare!)} />
              {putPrem !== 0 && <Line k="Put premium" v={<span className="text-emerald-400">−{px(putPrem / c.sharesHeld)}</span>} />}
              {callPrem !== 0 && <Line k="Call premium" v={<span className="text-emerald-400">−{px(callPrem / c.sharesHeld)}</span>} />}
              <div className="h-px bg-border" />
              <Line k="Adjusted basis" v={basisText(c.adjustedBasis!)} strong />
              {equity && equity.avgCost > 0 && <Line k={<span className="text-xs">Schwab shows</span>} v={<span className="text-xs text-muted">{px(equity.avgCost)}</span>} />}
            </Card>
          </>
        )}

        {c.calledAway && (
          <div className="mt-3 flex flex-col gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <div className="text-xs font-semibold text-emerald-300">
              If called away at {c.calledAway.strikes} on {shortDate(c.calledAway.expiration)}
            </div>
            <div className="tabular text-xl font-bold">
              <Signed n={c.calledAway.pnl} />{" "}
              <span className="text-xs font-normal text-muted">
                · {pct(c.calledAway.pnl / (c.capital || 1))} in {c.calledAway.days} days ·{" "}
                {pct(((c.calledAway.pnl / (c.capital || 1)) * 365) / c.calledAway.days)}/yr
              </span>
            </div>
          </div>
        )}

        {c.active && (c.openCalls.length > 0 || c.openPuts.length > 0 || c.stage === "shares") && (
          <>
            <SectionTitle>Next step</SectionTitle>
            <NextStep c={c} quotes={quotes} />
          </>
        )}

        <SectionTitle>Timeline</SectionTitle>
        <Card className="px-3.5 py-1.5">
          {rows.map((r, i) => (
            <div key={i} className={`flex gap-3 py-2.5 ${i < rows.length - 1 ? "border-b border-surface-2" : ""}`}>
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="tabular flex justify-between gap-2 text-[13px]">
                  <span className="min-w-0">{r.title}</span>
                  <span className="shrink-0">{r.amount != null ? <Signed n={r.amount} /> : <Amt>{r.plain ?? ""}</Amt>}</span>
                </div>
                <div className="text-[11px] text-muted">{r.sub}</div>
              </div>
            </div>
          ))}
        </Card>

        {others.length > 0 && (
          <>
            <SectionTitle>Other {c.symbol} campaigns</SectionTitle>
            <Card className="divide-y divide-border">
              {others.map((o) => (
                <Link key={o.id} href={`/options/wheel/${encodeURIComponent(o.id)}`} className="tabular flex justify-between px-4 py-2.5 text-[13px] active:bg-surface-2">
                  <span>
                    {shortDate(o.start)} → {o.end ? shortDate(o.end) : "now"} <span className="text-muted">· {o.legs.length} legs</span>
                  </span>
                  <Signed n={o.netPnl} />
                </Link>
              ))}
            </Card>
          </>
        )}
        <div className="h-6" />
      </ShowAmounts>
    </main>
  );
}
