// FOMC card (OptionsEvaluator): the next Fed decision, how far off
// it is, and what fed funds futures price into it. Two shapes — `compact`
// for the Home "Volatility & Positioning" stack (one row, taps through to
// /vix), full for the /vix page (every upcoming meeting, plus the strip the
// reads came from). Server component; the meeting list is a <details> so
// no client JS is needed for the disclosure.
import Link from "next/link";
import { Card } from "@/components/ui";
import {
  FOMC_LABEL_COLORS,
  FOMC_LABEL_TEXT,
  daysText,
  daysUntil,
  fmtMeetingDates,
  nextMeeting,
  oddsText,
  type FomcFile,
  type FomcMeeting,
} from "@/lib/fomc";
import { etDateString } from "@/lib/market-hours";

function MeetingRow({ m, today, lead }: { m: FomcMeeting; today: string; lead?: boolean }) {
  const days = daysUntil(m.decision, today);
  const tone = FOMC_LABEL_COLORS[m.label];
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-[88px] shrink-0">
        <div className={`text-xs font-semibold ${lead ? "text-text" : ""}`}>
          {fmtMeetingDates(m)}
          {m.sep && <span className="ml-1 text-[9px] font-semibold uppercase tracking-wide text-muted">SEP</span>}
        </div>
        <div className="text-[10px] text-muted">decision {daysText(days)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tone.chip}`}>
          {FOMC_LABEL_TEXT[m.label]}
        </span>
        <div className="mt-1 text-[11px] leading-snug text-muted">{oddsText(m)}</div>
      </div>
    </div>
  );
}

export function FomcCard({ file, compact = false }: { file: FomcFile; compact?: boolean }) {
  const today = etDateString(new Date());
  const next = nextMeeting(file, today);
  if (!next) return null;
  const days = daysUntil(next.decision, today);
  const tone = FOMC_LABEL_COLORS[next.label];
  // Inside a week of the decision the row leads with the countdown in the
  // label's own colour — that's the window a short-premium holder most
  // wants the nudge, since the expiring contracts are already on.
  const urgent = days <= 7;

  if (compact) {
    return (
      <Link href="/vix#fomc" className="block active:opacity-80">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted">FOMC</span>
            <span className={`text-sm font-bold leading-tight ${urgent ? tone.text : ""}`}>{fmtMeetingDates(next)}</span>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone.chip}`}>
            {FOMC_LABEL_TEXT[next.label]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">Decision {daysText(days)}</div>
            <div className="truncate text-[11px] text-muted">{oddsText(next)}</div>
          </div>
          <span className="shrink-0 text-muted">›</span>
        </div>
      </Link>
    );
  }

  const upcoming = file.meetings.filter((m) => daysUntil(m.decision, today) >= 0);
  return (
    <Card className="px-4 py-3">
      <div id="fomc" className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted">Next FOMC decision</div>
          <div className={`mt-0.5 text-2xl font-bold ${urgent ? tone.text : ""}`}>{fmtMeetingDates(next)}</div>
          <div className="text-[11px] text-muted">
            decision {daysText(days)}
            {next.sep && " · with projections (dot plot)"}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone.chip}`}>{FOMC_LABEL_TEXT[next.label]}</span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{oddsText(next)}.</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Read off CME 30-Day Fed Funds futures, the same input as FedWatch: a meeting-free month&rsquo;s
        contract prices the rate outright, a meeting month blends before and after by days in force. A
        decision that expires inside a short-premium position&rsquo;s life is a reason to look, not a rule —
        rates day IV is often already rich.
      </p>

      {upcoming.length > 1 && (
        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-muted">
            All scheduled meetings ({upcoming.length})
          </summary>
          <div className="mt-1 divide-y divide-border">
            {upcoming.map((m) => (
              <MeetingRow key={m.decision} m={m} today={today} lead={m.decision === next.decision} />
            ))}
          </div>
        </details>
      )}

      {file.strip.length > 0 && (
        <details className="mt-2 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-muted">Futures strip behind the read</summary>
          <div className="mt-1 grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-0.5 text-[11px]">
            {file.strip.map((c) => (
              <div key={c.symbol} className="contents">
                <span className="tabular text-muted">{c.month}</span>
                <span className="text-muted">{c.symbol}</span>
                <span className="tabular">{c.price.toFixed(3)}</span>
                <span className="tabular font-medium">{c.impliedRate.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="mt-2 text-[10px] text-muted">
        Dates: Federal Reserve calendar (tentative until confirmed at the prior meeting). As of {file.asof}.
      </p>
    </Card>
  );
}
