// Auto Trader: OptionsEvaluator's four paper accounts side by side — one per
// put strategy (General, Safe, Aggressive on the account holder's own rules;
// Quant on the reference wheel study's), each started with $250k and trading
// its rules through the whole wheel with no human step. Laid out like the
// Trader page's paper card (and reusing its trade log), but for four accounts,
// with SPY over the same days. Positions and closed trades live in the account
// switcher, where these accounts are typed "paper" and kept out of All
// Accounts. Shows only once OptionsEvaluator has written report.json.
import { notFound } from "next/navigation";
import { BackLink, Card, PageHeader } from "@/components/ui";
import { Amt, ShowAmounts } from "@/components/privacy";
import { PaperTrades } from "@/components/PaperTrades";
import { AutotraderChart } from "@/components/AutotraderChart";
import { OpenAccountLink } from "@/components/OpenAccountLink";
import { readAutotraderReport, type AutotraderAccount } from "@/lib/autotrader";
import type { PaperTrade } from "@/lib/trader";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;
const pct = (v: number | null, digits = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(digits)}%`);
const plain = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const tone = (v: number | null) => (v == null ? "text-muted" : v >= 0 ? "text-emerald-300" : "text-rose-300");
const short = (label: string) => label.replace("Auto Trader · ", "");
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The log in the Trader page's PaperTrades shape (oldest first; it reverses).
function toPaperTrades(a: AutotraderAccount): PaperTrade[] {
  return a.log
    .slice()
    .reverse()
    .map((e) => ({ at: e.at, kind: e.kind, text: e.rule ? `${e.text} · ${e.rule}` : e.text, amount: e.amount, symbol: e.symbol }));
}

export default async function AutotraderPage() {
  const report = readAutotraderReport();
  if (!report) notFound();
  const accounts = report.accounts;
  const asOf = new Date(report.meta.generatedAt);
  const started = accounts.map((a) => a.startedAt).sort()[0];

  return (
    <main className="px-4" data-wide="1">
      <ShowAmounts>
        <PageHeader
          title="Auto Trader"
          subtitle={`${accounts.length} paper accounts · ${money(accounts[0].startingCash)} each since ${started} · updated ${asOf.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
          right={<BackLink />}
        />

        <Card className="mt-3 px-4 py-3 text-[11px] leading-relaxed text-muted">
          Each account trades one put strategy by its own rules, every 15 minutes in market hours, with no approval step: entries, exits, assignment,
          covered calls. Paper only — nothing is sent to a broker. Fills are the mid less a quarter of the bid–ask spread, so a wide market costs
          what it would in real life. None opens a put across an earnings date. The Quant rule&apos;s backtest basket was picked with hindsight;
          read its line as the study, not a forecast.
        </Card>

        {/* The comparison, one row per account: a table, so it's also the chart's table view. */}
        <Card className="mt-3 overflow-x-auto px-4 py-3">
          <table className="w-full min-w-[34rem] text-[11px] tabular">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="py-1 pr-2 font-semibold">Account</th>
                <th className="py-1 pr-2 text-right font-semibold">Value</th>
                <th className="py-1 pr-2 text-right font-semibold">Return</th>
                <th className="py-1 pr-2 text-right font-semibold">vs SPY</th>
                <th className="py-1 pr-2 text-right font-semibold">Annualized</th>
                <th className="py-1 pr-2 text-right font-semibold">Max drawdown</th>
                <th className="py-1 pr-2 text-right font-semibold">Won</th>
                <th className="py-1 text-right font-semibold">Deployed</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-1.5 pr-2 font-semibold">{short(a.label)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    <Amt>{money(a.value)}</Amt>
                  </td>
                  <td className={`py-1.5 pr-2 text-right ${tone(a.returnPct)}`}>{pct(a.returnPct, 2)}</td>
                  <td className={`py-1.5 pr-2 text-right ${tone(a.vsSpyPct)}`}>{pct(a.vsSpyPct, 2)}</td>
                  <td className="py-1.5 pr-2 text-right text-muted">{a.annualizedPct == null ? "after 30 days" : pct(a.annualizedPct)}</td>
                  <td className="py-1.5 pr-2 text-right">{pct(a.maxDrawdownPct)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {plain(a.winRatePct)}
                    <span className="text-muted"> of {a.closedTrades}</span>
                  </td>
                  <td className="py-1.5 text-right">{plain(a.deployedPct)}</td>
                </tr>
              ))}
              <tr className="border-t border-border text-muted">
                <td className="py-1.5 pr-2">SPY</td>
                <td />
                <td className={`py-1.5 pr-2 text-right ${tone(accounts[0].spyReturnPct)}`}>{pct(accounts[0].spyReturnPct, 2)}</td>
                <td colSpan={5} className="py-1.5 text-right text-[10px]">
                  {report.meta.spyAsOf ? `close of ${report.meta.spyAsOf}, or live in market hours` : "no SPY history yet"}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card className="mt-3 px-4 py-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">% since start</div>
          <AutotraderChart series={accounts.map((a) => ({ key: a.key, label: short(a.label), points: a.series }))} spy={report.spy} />
        </Card>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a.id} className="min-w-0 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{a.label} · paper</div>
                  <div className="text-[11px] text-muted">{a.rules}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular">
                    <Amt>{money(a.value)}</Amt>
                  </div>
                  <div className={`text-[11px] tabular ${tone(a.pnl)}`}>
                    <Amt>{signed(a.pnl)}</Amt> on {money(a.startingCash)}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                <span>
                  cash <Amt>{money(a.cash)}</Amt>
                </span>
                <span>
                  realized <Amt>{signed(a.realized)}</Amt>
                </span>
                <span>
                  open <Amt>{signed(a.unrealized)}</Amt>
                </span>
                <span>{count(a.open.puts, "put")}</span>
                <span>{count(a.open.calls, "call")}</span>
                <span>{count(a.open.shareLots, "share lot")}</span>
                {a.key === "quant" && <span>{a.open.leaps} LEAPS</span>}
                {a.avgDaysHeld != null && <span>puts held {a.avgDaysHeld} days on average</span>}
              </div>
              <div className="mt-2">
                <OpenAccountLink id={a.id} href="/options">
                  Positions and closed trades ›
                </OpenAccountLink>
              </div>
              <PaperTrades trades={toPaperTrades(a)} />
            </Card>
          ))}
        </div>
      </ShowAmounts>
    </main>
  );
}
