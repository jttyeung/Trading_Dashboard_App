// Example-mode FOMC snapshot. Feeds the FOMC card when there's no bridge
// writing data/fomc.json — a public demo deployment, most of all.
//
// Meeting dates are the Fed's own published 2026–2027 calendar (public
// data), and the implied rates are a real strip reading (2026-09-15) so the
// hike/hold labels are a genuine example of the read, not invented. If the
// whole calendar has passed by the time someone views the demo, dates are
// synthesised six weeks apart from today so the card still shows an
// upcoming meeting rather than an empty state.
import type { FomcFile, FomcMeeting } from "./fomc";
import { daysUntil } from "./fomc";

const SCHEDULE: [string, string, boolean][] = [
  ["2026-09-15", "2026-09-16", true],
  ["2026-10-27", "2026-10-28", false],
  ["2026-12-08", "2026-12-09", true],
  ["2027-01-26", "2027-01-27", false],
  ["2027-03-16", "2027-03-17", true],
  ["2027-04-27", "2027-04-28", false],
  ["2027-06-08", "2027-06-09", true],
  ["2027-07-27", "2027-07-28", false],
  ["2027-09-14", "2027-09-15", true],
  ["2027-10-26", "2027-10-27", false],
  ["2027-12-07", "2027-12-08", true],
];

// Six reads, recycled down the list — a hike leaning into the near meetings,
// fading to holds further out, the shape a rising strip produces.
const READS: Pick<FomcMeeting, "impliedPreRate" | "impliedPostRate" | "changeBp" | "prob25" | "label">[] = [
  { impliedPreRate: 3.632, impliedPostRate: 3.858, changeBp: 22.6, prob25: 0.9, label: "hike" },
  { impliedPreRate: 3.858, impliedPostRate: 3.98, changeBp: 12.2, prob25: 0.49, label: "hold" },
  { impliedPreRate: 3.98, impliedPostRate: 4.149, changeBp: 16.9, prob25: 0.68, label: "hike" },
  { impliedPreRate: 4.144, impliedPostRate: 4.23, changeBp: 8.6, prob25: 0.34, label: "hold" },
  { impliedPreRate: 4.242, impliedPostRate: 4.371, changeBp: 12.9, prob25: 0.52, label: "hike" },
  { impliedPreRate: 4.371, impliedPostRate: 4.435, changeBp: 6.4, prob25: 0.26, label: "hold" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function exampleFomc(now = new Date()): FomcFile {
  const today = iso(now);
  let dates = SCHEDULE.filter(([, decision]) => daysUntil(decision, today) >= 0);
  if (dates.length === 0) {
    dates = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(now.getTime() + (10 + 42 * i) * 86_400_000);
      const decision = new Date(start.getTime() + 86_400_000);
      return [iso(start), iso(decision), i % 2 === 0] as [string, string, boolean];
    });
  }
  const meetings: FomcMeeting[] = dates.map(([start, decision, sep], i) => ({
    start,
    decision,
    sep,
    ...READS[i % READS.length],
  }));
  // Two contracts of strip are enough for the disclosure to look real.
  const m0 = meetings[0];
  return {
    asof: now.toISOString(),
    source: "example",
    meetings,
    strip: [
      { symbol: "/ZQ (front)", month: m0.decision.slice(0, 7), price: 96.2625, impliedRate: 3.737 },
      { symbol: "/ZQ (next)", month: meetings[1]?.decision.slice(0, 7) ?? m0.decision.slice(0, 7), price: 96.13, impliedRate: 3.87 },
    ],
  };
}
