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
import type { BucketStat, GuidelineStat, MyTradesFile } from "@/lib/types";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
const ret = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);

// PROSPECTIVE marks the guideline keys that need an entry snapshot, so
// an empty row can explain itself.
const PROSPECTIVE = new Set(["deltaBand", "liquidity", "earnings"]);

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

function BucketGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>;
}

export function MyTradesReport({ file }: { file: MyTradesFile }) {
  const { meta } = file;
  if (meta.tradeCount === 0) {
    return (
      <>
        <SectionTitle>How you traded</SectionTitle>
        <Card className="px-4 py-6 text-center text-sm text-muted">
          No closed short option trades on file yet. Once a CSP or covered call closes, expires or is assigned, this grades
          it against your own guidelines and how you managed it.
        </Card>
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
          {`${meta.tradeCount} closed trade${meta.tradeCount === 1 ? "" : "s"} · a rule is only counted where its input is known for that trade — an unknown is left out, never marked broken`}
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

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
        Every trade the broker confirmed closed counts here, whether or not it was ever suggested. Retroactive reads
        (DTE, monthly ROI, wash-sale, sizing, regime, IV rank, how it was managed) cover every trade; the ones that need
        the tracker to have frozen the entry (delta band, liquidity, earnings, VRP, alert response) start from{" "}
        {since || "the first captured entry"}. Nothing here changes what gets suggested.
        {[file.regime, file.earnings, file.sizing].every(nonEmpty) ? "" : " Some sections are still filling in."}
      </p>
    </>
  );
}
