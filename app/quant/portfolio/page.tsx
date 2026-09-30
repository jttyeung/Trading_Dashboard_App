import Link from "next/link";
import { BackLink, Card, PageHeader, Pill, SectionTitle } from "@/components/ui";
import { Amt, ShowAmounts } from "@/components/privacy";
import { getSnapshot } from "@/lib/snapshot";
import { getSelectedAccount } from "@/lib/account";
import { getVixSnapshot } from "@/lib/vix-data";
import { getQuantScan } from "@/lib/quant";
import { checkPortfolio, type QuantAction, type Urgency } from "@/lib/quant-portfolio";
import { fmtMoney } from "@/lib/calc";

export const dynamic = "force-dynamic";

const SECTIONS: { key: Urgency; title: string; blurb: string; pill: string }[] = [
  { key: "act", title: "Act now", blurb: "Positions outside the rules, or winners the rules say to take.", pill: "bg-rose-500/10 text-rose-300 ring-rose-500/20" },
  { key: "income", title: "Income to add", blurb: "Calls and LEAPS the wheel would have on already.", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" },
  { key: "deploy", title: "Deploy", blurb: "Capital that isn't working and where the scan says it could.", pill: "bg-sky-500/10 text-sky-300 ring-sky-500/20" },
  { key: "note", title: "Notes", blurb: "Inside the rules, or judgement calls the study doesn't make for you.", pill: "bg-surface-2 text-muted ring-border" },
];

function ActionCard({ a }: { a: QuantAction }) {
  return (
    <Card className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 text-sm font-semibold">
          <span data-ticker={a.symbol !== "—" ? a.symbol : undefined}>{a.title}</span>
        </div>
        {a.amount != null && (
          <div className="shrink-0 text-xs tabular text-muted">
            <Amt>{fmtMoney(a.amount)}</Amt>
          </div>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{a.detail}</p>
      <div className="mt-1.5 text-[10px] uppercase tracking-wide text-muted/70">rule · {a.rule}</div>
    </Card>
  );
}

export default async function QuantPortfolioPage() {
  const snap = await getSnapshot();
  const example = snap.meta.source === "example";
  const { account, data } = await getSelectedAccount(snap);
  const vix = getVixSnapshot(example)?.inputs.vix ?? null;
  const scan = getQuantScan(example);
  const check = checkPortfolio(data, vix, scan);
  const cap = check.capacity;
  const total = check.actions.length;

  return (
    <main className="px-4" data-wide="1">
      <ShowAmounts>
        <PageHeader
          title="Quant portfolio check"
          subtitle={`${account.nickname ?? account.mask} · ${check.counts.act} to act on · ${check.counts.income} income · ${check.counts.deploy} deploy`}
          right={<BackLink />}
        />

        <Card className="mt-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Pill className="shrink-0 whitespace-nowrap bg-emerald-500/10 text-emerald-300 ring-emerald-500/20">The rules</Pill>
            <span className="text-[11px] text-muted">management side of the backtested wheel</span>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>· Close a short put at <span className="text-text">50% of its credit</span>, however much life is left.</li>
            <li>· Every put <span className="text-text">cash-secured</span>; the margin allowance follows the VIX (0 under 20, 5% per 5 points, cap 35%).</li>
            <li>· No name over <span className="text-text">10% of buying power</span> (15% when one contract overshoots while adding).</li>
            <li>· On shares: sell a <span className="text-text">7–21 day call at or above cost</span>, the furthest strike still paying 0.5% of basis a week; hold with no call if none does.</li>
            <li>· On shares: hold a <span className="text-text">~0.60Δ LEAPS ~450 days out</span> per 100 shares; sell it when they&apos;re called away or inside 90 days.</li>
            <li>· Idle cash goes to whatever the <Link href="/quant" className="text-emerald-300 underline">scan</Link> says pays.</li>
          </ul>
        </Card>

        <Card className="mt-3 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Where the account stands</div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular sm:grid-cols-4">
            <div><span className="text-muted">Total</span> <Amt>{fmtMoney(cap.totalValue)}</Amt></div>
            <div><span className="text-muted">Free cash</span> <Amt className={cap.freeCash < 0 ? "text-rose-400" : ""}>{fmtMoney(cap.freeCash)}</Amt></div>
            <div><span className="text-muted">Put collateral</span> <Amt>{fmtMoney(cap.putObligations)}</Amt></div>
            <div><span className="text-muted">Committed</span> <Amt>{fmtMoney(cap.committedTotal)}</Amt> <span className="text-muted">({cap.totalValue ? Math.round((cap.committedTotal / cap.totalValue) * 100) : 0}%)</span></div>
            <div className="col-span-2 text-muted sm:col-span-4">
              VIX {vix != null ? vix.toFixed(1) : "—"} → margin allowance {Math.round(cap.margin * 100)}% · buying power <Amt>{fmtMoney(cap.buyingPower)}</Amt> · per-name cap <Amt>{fmtMoney(0.1 * cap.buyingPower)}</Amt>
            </div>
          </div>
        </Card>

        {total === 0 && (
          <Card className="mt-3 px-4 py-4 text-center text-xs text-emerald-300">Everything held is inside the rules. Nothing to do.</Card>
        )}

        {SECTIONS.map((s) => {
          const items = check.actions.filter((a) => a.urgency === s.key);
          if (!items.length) return null;
          return (
            <div key={s.key}>
              <SectionTitle>
                <span className="flex items-center gap-2">
                  <Pill className={`shrink-0 whitespace-nowrap ${s.pill}`}>{s.title}</Pill>
                  <span className="text-[11px] font-normal normal-case tracking-normal text-muted">{s.blurb}</span>
                </span>
              </SectionTitle>
              <div className="space-y-2.5 tablet:grid tablet:grid-cols-2 tablet:gap-3 tablet:space-y-0">
                {items.map((a, i) => (
                  <ActionCard key={`${a.rule}-${a.symbol}-${i}`} a={a} />
                ))}
              </div>
            </div>
          );
        })}

        {check.compliant.length > 0 && (
          <>
            <SectionTitle>Already inside the rules</SectionTitle>
            <Card className="px-4 py-3">
              <ul className="space-y-1 text-xs text-muted">
                {check.compliant.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-400">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted">
          Read against the account selected in the header. Covered-call picks come from the ladders the bridge prices for held names during
          market hours; LEAPS suggestions are the rule, not a quote. Nothing here places a trade, and the study&apos;s returns came from a
          hindsight-picked basket, so treat these as the rules applied to your positions, not as advice.
        </p>
      </ShowAmounts>
    </main>
  );
}
