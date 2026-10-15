// The pace car on the P&L page: the account against a benchmark bought with the
// same money on the same days (lib/pace-car.ts, fed by the bridge's pace_car.py).
// Gains are net of deposits and withdrawals, so "vs pace" is the wheel's own
// contribution. Below the headline: both curves, then the last weeks and months.
// Server component; amounts respect the privacy toggle through <Amt>.
import { Card } from "@/components/ui";
import { Amt } from "@/components/privacy";
import { fmtMoney } from "@/lib/calc";
import { windowChange, type PaceAccount, type PaceSummary } from "@/lib/pace-car";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;
const signedPct = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
const tone = (n: number) => (n >= 0 ? "text-emerald-400" : "text-rose-400");
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Curves({ acct }: { acct: PaceAccount }) {
  const s = acct.series;
  if (s.length < 2) return null;
  const w = 360;
  const h = 110;
  const pad = 6;
  const vals = s.flatMap((p) => [p.book, p.pace]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (s.length - 1);
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / span);
  const path = (key: "book" | "pace") => s.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" preserveAspectRatio="none" role="img" aria-label="Account value against the pace car">
      <path d={path("pace")} fill="none" stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />
      <path d={path("book")} fill="none" stroke="#34d399" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type Row = { label: string; book: number; pace: number };

/** The weeks of the last month: every week (Monday to Sunday) whose Monday falls in the last 31 days. */
function weeksOfLastMonth(acct: PaceAccount): Row[] {
  const out: Row[] = [];
  const today = new Date();
  const floor = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  const back = (today.getDay() + 6) % 7;
  let monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
  while (monday >= floor) {
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const c = windowChange(acct, ymd(monday), ymd(sunday));
    if (c) out.push({ label: `${monday.toLocaleDateString([], { month: "short", day: "numeric" })} wk`, book: c.book, pace: c.pace });
    monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
  }
  return out;
}

/** Calendar months from this one back to January of this year. */
function monthsThisYear(acct: PaceAccount): Row[] {
  const out: Row[] = [];
  const today = new Date();
  const n = today.getMonth() + 1;
  for (let i = 0; i < n; i++) {
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const last = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
    const c = windowChange(acct, ymd(first), ymd(last));
    if (c) out.push({ label: first.toLocaleDateString([], { month: "short", year: "2-digit" }), book: c.book, pace: c.pace });
  }
  return out;
}

function Periods({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <table className="mt-1 w-full text-[11px] tabular">
        <thead className="text-[10px] text-muted">
          <tr>
            <th className="text-left font-medium">Period</th>
            <th className="text-right font-medium">Book</th>
            <th className="text-right font-medium">Pace</th>
            <th className="text-right font-medium">vs pace</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 text-muted">{r.label}</td>
              <td className={`py-0.5 text-right ${tone(r.book)}`}><Amt>{signed(r.book)}</Amt></td>
              <td className="py-0.5 text-right text-muted"><Amt>{signed(r.pace)}</Amt></td>
              <td className={`py-0.5 text-right font-medium ${tone(r.book - r.pace)}`}><Amt>{signed(r.book - r.pace)}</Amt></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaceCarCard({ acct, benchmark }: { acct: PaceAccount; benchmark: string }) {
  const s = acct.summary as Partial<PaceSummary>;
  if (!s.days) return null;
  const weeks = weeksOfLastMonth(acct);
  const months = monthsThisYear(acct);
  return (
    <Card className="mt-3 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <div className="text-sm font-semibold">
            Pace car <span className="font-normal text-muted">· {benchmark}</span>
          </div>
          <div className="text-[11px] text-muted">
            Same money, same days, in {benchmark} since {acct.since} · {s.days} day{s.days === 1 ? "" : "s"}
            {acct.flows.length > 0 && ` · ${acct.flows.length} cash flow${acct.flows.length === 1 ? "" : "s"} matched`}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold tabular ${tone(s.vsPace ?? 0)}`}>
            <Amt>{signed(s.vsPace ?? 0)}</Amt> <span className="text-xs font-medium">({signedPct(s.vsPacePct ?? 0)})</span>
          </div>
          <div className="text-[10px] text-muted">the book versus the pace car</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular sm:grid-cols-4">
        <div>
          <span className="text-muted">Book</span> <Amt>{fmtMoney(s.book ?? 0)}</Amt>{" "}
          <span className={tone(s.bookGain ?? 0)}><Amt>{signed(s.bookGain ?? 0)}</Amt> ({signedPct(s.bookGainPct ?? 0)})</span>
        </div>
        <div>
          <span className="text-muted">Pace</span> <Amt>{fmtMoney(s.pace ?? 0)}</Amt>{" "}
          <span className={tone(s.paceGain ?? 0)}><Amt>{signed(s.paceGain ?? 0)}</Amt> ({signedPct(s.paceGainPct ?? 0)})</span>
        </div>
        <div>
          <span className="text-muted">Today vs pace</span> <span className={tone(s.todayVsPace ?? 0)}><Amt>{signed(s.todayVsPace ?? 0)}</Amt></span>
        </div>
        <div>
          <span className="text-muted">In / out</span> <Amt>{fmtMoney(s.flowsIn ?? 0)}</Amt> <span className="text-muted">/</span> <Amt>{fmtMoney(s.flowsOut ?? 0)}</Amt>
        </div>
      </div>

      <Curves acct={acct} />
      <div className="mt-1 flex gap-3 text-[10px] text-muted">
        <span><span className="inline-block h-0.5 w-3 bg-emerald-400 align-middle" /> book</span>
        <span><span className="inline-block h-0.5 w-3 border-t border-dashed border-slate-400 align-middle" /> pace car</span>
      </div>

      {(weeks.length > 0 || months.length > 0) && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Periods title="Weeks, last month" rows={weeks} />
          <Periods title="Months, back to January" rows={months} />
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Gains are net of deposits and withdrawals; the pace car buys or sells {benchmark} with each one at that day&apos;s close. Daily values
        are the bridge&apos;s logged totals, so the pace car starts on the first day the account was logged.
      </p>
    </Card>
  );
}
