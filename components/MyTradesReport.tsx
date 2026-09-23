"use client";

// My Trades scorecard sections (the desktop /overview My Trades tab,
// below the existing strategy/delta drill-down): the account holder's
// own closed trades graded against how THEY traded — guideline
// compliance, management behavior, VIX regime at entry, earnings
// proximity, concurrency and sizing, plus the same factor and IVR/VRP
// buckets the Bot Scorecard shows for paper picks. Every number arrives
// precomputed from data/my-trades.json (internal/export/my_trades.go is
// the one definition); this file only lays them out. Deliberately not a
// bot-vs-human comparison, and a mirror only — nothing here re-weights
// anything.
//
// Two kinds of sections: retroactive ones fill for any trade; the
// prospective ones (delta band, liquidity, earnings, VRP, alert
// response) only know trades opened after the tracker began freezing
// entry inputs, so they say so instead of showing a hollow zero.
import { Card, SectionTitle } from "@/components/ui";
import { BucketBars, FactorTableRow } from "@/components/FactorScorecard";
import { fmtMoney } from "@/lib/calc";
import type { BucketStat, GuidelineStat, LeapsSection, MyLeapTrade, MyTradesFile, RollChain } from "@/lib/types";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
const ret = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);

// PROSPECTIVE marks the guideline keys that need an entry snapshot, so
// an empty row can explain itself.
const PROSPECTIVE = new Set(["deltaBand", "liquidity", "earnings", "leapDelta"]);

function fillsIn(capturedSince: string, what: string) {
  return capturedSince ? `Fills in for trades opened after ${capturedSince}, when the tracker began freezing ${what} at entry.` : `Fills in once the tracker has frozen ${what} at entry for a trade that later closes.`;
}

function GuidelineRow({ g }: { g: GuidelineStat }) {
  const violated = g.nChecked - g.nCompliant;
  const compliance = g.nChecked === 0 ? null : (g.nCompliant / g.nChecked) * 100;
  return (
    <tr className="border-b border-border/60">
      <td className="whitespace-nowrap px-3 py-2">
        <div className="font-medium text-text">{g.label}</div>
        <div className="text-[10px] text-muted">{g.rule}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        {g.nChecked === 0 ? (
          <span className="text-[10px] text-muted">{PROSPECTIVE.has(g.key) ? "fills in from capture" : "no trade checkable yet"}</span>
        ) : (
          <>
            <span className={`font-semibold ${compliance != null && compliance < 100 ? "text-neg" : "text-text"}`}>{pct(compliance)}</span>
            <span className="ml-1.5 text-[10px] text-muted">
              {g.nCompliant}/{g.nChecked} followed
            </span>
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        <span className="text-text">{pct(g.winRateCompliant)}</span> <span className="text-muted">vs {pct(g.winRateViolated)}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        <span className="text-text">{ret(g.avgReturnCompliant)}</span> <span className="text-muted">vs {ret(g.avgReturnViolated)}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-[10px] tabular text-muted">{violated > 0 ? `${violated} broke it` : ""}</td>
    </tr>
  );
}

// legLabel — "410P 9/25" from an OCC symbol: the strike and expiry are
// what distinguish one leg of a chain from the next; the ticker is the
// row's own label.
function legLabel(symbol: string): string {
  const m = symbol.slice(6).match(/^(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!m) return symbol.trim();
  const strike = Number(m[5]) / 1000;
  return `${strike}${m[4]} ${Number(m[2])}/${Number(m[3])}`;
}

const money = (v: number) => fmtMoney(v, { sign: true });

function RollChainRow({ c }: { c: RollChain }) {
  const added = c.laterLegsPnl;
  const tone = c.status === "open" && added === 0 ? "text-muted" : added > 0 ? "text-pos" : added < 0 ? "text-neg" : "text-muted";
  return (
    <tr className="border-b border-border/60">
      <td className="px-3 py-2">
        <div className="font-medium text-text">
          {c.ticker} <span className="text-[10px] text-muted">{c.putCall === "PUT" ? "puts" : "calls"}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted">
          {c.legs.map((l, i) => (
            <span key={l.contractSymbol} className="whitespace-nowrap">
              {i > 0 && <span className="mx-0.5">→</span>}
              <span className="text-text">{legLabel(l.contractSymbol)}</span>
              <span className="ml-1">
                {l.realizedPnl == null ? "open" : `${money(l.realizedPnl)} · ${l.closeReason.toLowerCase()}`}
              </span>
            </span>
          ))}
        </div>
      </td>
      <td className={`whitespace-nowrap px-3 py-2 tabular ${c.firstLegPnl < 0 ? "text-neg" : "text-text"}`}>{money(c.firstLegPnl)}</td>
      <td className={`whitespace-nowrap px-3 py-2 tabular ${tone}`}>
        {c.status === "open" && added === 0 ? "—" : money(added)}
        {c.status === "open" && c.openLegCredit != null && (
          <span className="ml-1.5 text-[10px] text-muted">{fmtMoney(c.openLegCredit)} credit still open</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular">
        <span className={`font-semibold ${c.realizedPnl >= 0 ? "text-pos" : "text-neg"}`}>{money(c.realizedPnl)}</span>
        <span className="ml-1.5 text-[10px] text-muted">{c.status === "open" ? "so far" : "closed"}</span>
      </td>
    </tr>
  );
}

const day = (iso: string) => (iso ? iso.slice(0, 10) : "—");

function LeapRow({ t }: { t: MyLeapTrade }) {
  const dteOK = t.guidelines.leapDte;
  const deltaOK = t.guidelines.leapDelta;
  return (
    <tr className="border-b border-border/60">
      <td className="whitespace-nowrap px-3 py-2">
        <div className="font-medium text-text">
          {t.ticker} <span className="text-[10px] text-muted">{legLabel(t.contractSymbol)}</span>
        </div>
        <div className="text-[10px] text-muted">
          {t.source === "fidelity" ? "Fidelity" : "Schwab"} · {t.quantity} contract{t.quantity === 1 ? "" : "s"}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular text-muted">
        {day(t.openDate)} → {day(t.closeDate)}
        <span className="ml-1.5 text-[10px]">{t.dit}d held</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular">
        <span className={dteOK === false ? "text-neg" : "text-text"}>{t.dteAtOpen} DTE</span>
        <span className="ml-1.5 text-[10px] text-muted">
          {t.deltaAtOpen == null ? "Δ —" : <span className={deltaOK === false ? "text-neg" : ""}>Δ {Math.abs(t.deltaAtOpen).toFixed(2)}</span>}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 tabular text-muted">
        {t.openPrice.toFixed(2)} → {t.closeReason === "EXPIRED" ? "expired" : t.closePrice.toFixed(2)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right tabular">
        <span className={`font-semibold ${t.realizedPnl >= 0 ? "text-pos" : "text-neg"}`}>{money(t.realizedPnl)}</span>
        <span className="ml-1.5 text-[10px] text-muted">{ret(t.returnPct)} on cost</span>
      </td>
    </tr>
  );
}

// LeapsBlock — the bought side, on its own terms. The 365+ DTE, 0.70+
// delta entry window is the only guideline the notes give a LEAP, and a
// long call's return is on what it cost, so none of these rows feed the
// short-trade sections above; averaging a +$900 LEAP into "credit kept"
// would misstate the CSP record.
function LeapsBlock({ leaps, since }: { leaps: LeapsSection; since: string }) {
  return (
    <>
      <SectionTitle>LEAPs you bought</SectionTitle>
      <Card className="divide-y divide-border overflow-x-auto">
        <div className="px-3 py-1.5 text-[10px] text-muted">
          {leaps.trades.length === 0
            ? "Closed long calls and puts will show here, graded against the LEAPs entry window — kept apart from the premium-selling stats above since a bought option has no collateral or credit to keep."
            : `${leaps.trades.length} closed long trade${leaps.trades.length === 1 ? "" : "s"} · graded against the LEAPs entry window only · return is on cost, not collateral · delta at entry is known only for Schwab positions the tracker saw open`}
        </div>
        {leaps.trades.length > 0 && (
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Contract</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Held</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">At entry</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Paid → sold</th>
                <th className="whitespace-nowrap px-3 py-1.5 text-right font-medium">Realized</th>
              </tr>
            </thead>
            <tbody>
              {leaps.trades.map((t) => (
                <LeapRow key={`${t.source}|${t.contractSymbol}|${t.openDate}`} t={t} />
              ))}
            </tbody>
          </table>
        )}
        {leaps.trades.length > 0 && (
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Guideline</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Followed</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Win rate followed vs broken</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Avg return followed vs broken</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {leaps.guidelines.map((g) => (
                <GuidelineRow key={g.key} g={g} />
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {leaps.trades.length > 0 && (
        <BucketGrid>
          <BucketBars title="Win rate by how long it was held" buckets={leaps.hold} empty="No closed LEAP yet." />
          <BucketBars title="Win rate by VIX regime at open" buckets={leaps.regime} empty="Fills in for LEAPs opened after VIX sampling began." />
          <BucketBars title="Win rate by IV rank at open" buckets={leaps.ivrBuckets} empty="No closed LEAP yet." />
          <Card className="px-3 py-2 text-[11px] leading-relaxed text-muted">
            {`The delta grade needs the tracker's entry snapshot. ${fillsIn(since, "delta")} A Fidelity LEAP never gets one — the tracker only sees Schwab positions.`}
          </Card>
          <BucketBars
            title="Win rate by CBOE PCC at open (RULE-026)"
            buckets={leaps.pccAtOpenBuckets}
            empty="Fills in for LEAPs opened after PCC tracking began."
          />
          <BucketBars
            title="Win rate by CBOE PCC at close"
            buckets={leaps.pccAtCloseBuckets}
            empty="Fills in for LEAPs closed after PCC tracking began."
          />
          <BucketBars
            title="Win rate by how fast a PCC caution alert was acted on"
            buckets={leaps.pccAlertResponseBuckets}
            empty="Fills in once the tracker raises a PCC caution on a LEAP and it closes."
          />
          <PccCorrelationNote openR={leaps.pccAtOpenCorrelation} closeR={leaps.pccAtCloseCorrelation} />
        </BucketGrid>
      )}
    </>
  );
}

// PccCorrelationNote — a plain r, deliberately not colored "helps/hurts"
// the way FactorScorecard's rTone judges a score bonus: there, positive
// always means the bonus earned its keep, but a contrarian sentiment
// read has no such fixed "good" sign here — a negative r is the one that
// would actually agree with the close-below-0.75 rule, not disagree with
// it. Read the number yourself rather than trust a color for this one.
function PccCorrelationNote({ openR, closeR }: { openR: number | null; closeR: number | null }) {
  const line = (label: string, r: number | null) => `${label}: ${r == null ? "building — needs more closed LEAPs with a PCC reading" : `r = ${r.toFixed(2)}`}`;
  return (
    <Card className="px-3 py-2 text-[11px] leading-relaxed text-muted">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">PCC vs. return correlation</div>
      <div>{line("At open", openR)}</div>
      <div>{line("At close", closeR)}</div>
    </Card>
  );
}

function BucketGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>;
}

export function MyTradesReport({ file }: { file: MyTradesFile }) {
  const { meta } = file;
  const leaps = file.leaps ?? {
    trades: [], guidelines: [], regime: [], ivrBuckets: [], hold: [],
    pccAtOpenBuckets: [], pccAtCloseBuckets: [], pccAtOpenCorrelation: null, pccAtCloseCorrelation: null,
    pccAlertResponseBuckets: [],
  };
  if (meta.tradeCount === 0) {
    return (
      <>
        <SectionTitle>How you traded</SectionTitle>
        <Card className="px-4 py-6 text-center text-sm text-muted">
          No closed short option trades on file yet. Once a CSP or covered call closes, expires or is assigned, this grades
          it against your own guidelines and how you managed it.
        </Card>
        {leaps.trades.length > 0 && <LeapsBlock leaps={leaps} since={meta.capturedSince} />}
      </>
    );
  }

  const factors = file.factors.filter((f) => f.n > 0);
  const since = meta.capturedSince;
  const nonEmpty = (b: BucketStat[]) => b.length > 0;

  return (
    <>
      <SectionTitle>Execution vs the guidelines</SectionTitle>
      <Card className="divide-y divide-border overflow-x-auto">
        <div className="px-3 py-1.5 text-[10px] text-muted">
          {`${meta.tradeCount} closed trade${meta.tradeCount === 1 ? "" : "s"} across Schwab, Fidelity and E*TRADE · a rule is only counted where its input is known for that trade — an unknown is left out, never marked broken`}
        </div>
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
              <th className="whitespace-nowrap px-3 py-1.5 font-medium">Guideline</th>
              <th className="whitespace-nowrap px-3 py-1.5 font-medium">Followed</th>
              <th className="whitespace-nowrap px-3 py-1.5 font-medium">Win rate followed vs broken</th>
              <th className="whitespace-nowrap px-3 py-1.5 font-medium">Avg return followed vs broken</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {file.guidelines.map((g) => (
              <GuidelineRow key={g.key} g={g} />
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>How positions were managed</SectionTitle>
      <BucketGrid>
        <BucketBars title="Win rate by how it closed" buckets={file.management.closeReason} empty="No closed trades yet." />
        <BucketBars
          title="Win rate by credit kept (bought back early)"
          buckets={file.management.profitCaptured}
          empty="No trade bought back early yet — every close so far was an expiry or assignment."
        />
        <BucketBars title="Win rate by how long it was held (share of DTE)" buckets={file.management.holdFraction} empty="No closed trades yet." />
        <BucketBars
          title="Win rate by time from a close/roll alert to closing"
          buckets={file.management.alertResponse}
          empty={fillsIn(since, "when each alert first fired")}
        />
      </BucketGrid>

      <SectionTitle>Did rolling beat taking the loss?</SectionTitle>
      <Card className="divide-y divide-border overflow-x-auto">
        <div className="px-3 py-1.5 text-[10px] text-muted">
          Each row is one position followed through every roll (the two legs of a roll share a Schwab order id). &ldquo;First
          leg&rdquo; is what closing it without rolling would have booked; &ldquo;added by rolling&rdquo; is what the later legs
          have realized since.
        </div>
        {file.rollChains.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted">No roll on file yet — a close and re-open placed as one order will show here.</div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="px-3 py-1.5 font-medium">Chain</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">First leg</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Added by rolling</th>
                <th className="whitespace-nowrap px-3 py-1.5 text-right font-medium">Chain P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {file.rollChains.map((c) => (
                <RollChainRow key={c.legs[0]?.contractSymbol ?? c.ticker} c={c} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SectionTitle>Conditions at entry</SectionTitle>
      <BucketGrid>
        <BucketBars title="Win rate by VIX regime at open" buckets={file.regime} empty="Fills in for trades opened after VIX sampling began." />
        <BucketBars title="Win rate by earnings proximity at open" buckets={file.earnings} empty={fillsIn(since, "the next earnings date")} />
        <BucketBars title="Win rate by positions open at the time" buckets={file.concurrency} empty="No closed trades yet." />
        <BucketBars
          title="Win rate by collateral as a share of the account"
          buckets={file.sizing}
          empty="Fills in for trades opened after account value snapshots began."
        />
        <BucketBars title="Win rate by IV rank at open" buckets={file.ivrBuckets} empty="No closed trades yet." />
        <BucketBars title="Win rate by VRP at open" buckets={file.vrpBuckets} empty={fillsIn(since, "VRP")} />
      </BucketGrid>

      <SectionTitle>Score factors on the trades a suggestion matched</SectionTitle>
      <Card className="divide-y divide-border overflow-x-auto">
        <div className="px-3 py-1.5 text-[10px] text-muted">
          {`${meta.matchedCount} of ${meta.tradeCount} trade${meta.tradeCount === 1 ? "" : "s"} matched a suggestion · ${factors[0]?.n ?? 0} of those carry the points it earned (breakdowns were stored from a later date) · r is shown from n=${meta.minSample}`}
        </div>
        {factors.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted">No closed trade has matched a suggestion with a stored score breakdown yet.</div>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted">
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Factor</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Win rate with vs without</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">Avg return with vs without</th>
                <th className="whitespace-nowrap px-3 py-1.5 font-medium">r over the sample</th>
                <th className="whitespace-nowrap px-3 py-1.5 text-right font-medium">r</th>
              </tr>
            </thead>
            <tbody>
              {factors.map((f) => (
                <FactorTableRow key={f.key} f={f} minSample={meta.minSample} />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <LeapsBlock leaps={leaps} since={since} />

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        Every trade a broker confirmed closed counts here — Schwab, Fidelity and E*TRADE alike — whether or not it was ever
        suggested. Roll chains and alert response are Schwab-only (rolls are linked by Schwab order id; the tracker alerts on
        Schwab positions), so they read as absent, not broken, elsewhere. Retroactive reads
        (DTE, monthly ROI, wash-sale, sizing, regime, IV rank, how it was managed) cover every trade; the ones that need
        the tracker to have frozen the entry (delta band, liquidity, earnings, VRP, alert response) start from{" "}
        {since || "the first captured entry"}. Nothing here changes what gets suggested.
        {[file.regime, file.earnings, file.sizing].every(nonEmpty) ? "" : " Some sections are still filling in."}
      </p>
    </>
  );
}
