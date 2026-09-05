"use client";

import { useEffect, useState } from "react";
import type { Alert, BotSnapshot } from "@/lib/types";
import { PositionsTable, type SourcedOption } from "@/components/desktop/PositionsTable";
import { BotTable } from "@/components/bot/BotTable";
import { SecurityChart } from "@/components/desktop/SecurityChart";

type Tab = "desktop" | "bot-safe" | "bot" | "bot-aggressive" | "chart";

// Order: Desktop, 20 Delta Safe, Wheel Bot, Aggressive Bot, Chart — the
// account holder's own explicit ask for the rail's ordering (Chart
// appended last, added later than the other four).
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  {
    key: "desktop",
    label: "Positions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M9 9v11" />
      </svg>
    ),
  },
  {
    key: "bot-safe",
    label: "20 Delta Safe",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
      </svg>
    ),
  },
  {
    key: "bot",
    label: "Wheel Bot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M9 8V5a3 3 0 0 1 6 0v3M9 13h.01M15 13h.01" />
      </svg>
    ),
  },
  {
    key: "bot-aggressive",
    label: "Aggressive Bot",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
      </svg>
    ),
  },
  {
    key: "chart",
    label: "Chart",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 3 5-7 4 4" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
];

const TAB_KEY = "overviewActiveTab";

function loadTab(): Tab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "desktop" || raw === "bot" || raw === "bot-safe" || raw === "bot-aggressive" || raw === "chart") return raw;
  } catch {
    /* ignore */
  }
  return "desktop";
}

const HEADINGS: Record<Tab, { title: string; subtitle: string }> = {
  desktop: { title: "Open Positions", subtitle: "Every live option position across every linked account." },
  bot: {
    title: "Wheel Bot",
    subtitle: "STRAT-001's 0.20–0.35 delta CSP band — same scoring, same reasoning as the real digest.",
  },
  "bot-safe": {
    title: "20 Delta Safe Moves",
    subtitle: "STRAT-003's conservative 0.10–0.20 delta CSP band, biased toward near-zero assignment odds.",
  },
  "bot-aggressive": {
    title: "Aggressive Bot",
    subtitle: "STRAT-011's short-dated CSP band (3–14 DTE, ≤0.25 delta, 40%+ ARR required) — paperbot-only, never a real suggestion.",
  },
  chart: {
    title: "Security Chart",
    subtitle: "2 years of daily candles with Bollinger Bands, MACD, RSI, 200-day SMA, and today's call/put walls — computed on demand for whichever ticker you search.",
  },
};

// A single icon rail switching between the desktop positions table and
// all three paper-bot review tables, so all four "personal power-user"
// surfaces live under one path instead of four separately-typed URLs.
// Data for all four is fetched once by the server component and handed
// down here, so switching tabs is instant client-side state, never a
// re-fetch or navigation.
export function OverviewShell({
  options,
  alerts,
  generalBot,
  safeBot,
  aggressiveBot,
  exampleMode,
}: {
  options: SourcedOption[];
  alerts: Alert[];
  generalBot: BotSnapshot;
  safeBot: BotSnapshot;
  aggressiveBot: BotSnapshot;
  exampleMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("desktop");
  useEffect(() => setTab(loadTab()), []);

  function selectTab(next: Tab) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const heading = HEADINGS[tab];
  // Not the full backend watchlist (no export of that exists yet) --
  // currently-held underlyings are a reasonable, zero-new-plumbing set of
  // "quick access" suggestions; free-text search still works for anything
  // else regardless.
  const heldTickers = Array.from(new Set(options.map((o) => o.symbol))).sort();

  return (
    // min-h-full, not h-full: h-full capped this row at exactly one
    // viewport (the outer ScrollArea's own box in layout.tsx), so nav's
    // sticky positioning had no containing block taller than itself to
    // travel within — it looked fine for one screen, then simply ran out
    // of "stick" room and stopped covering the column for any content
    // beyond that, on a page as long as a big positions table. min-h-full
    // lets this row grow to the real content height (still at least one
    // viewport for short content) so sticky has room to keep nav pinned
    // — and its background genuinely extending — for the whole scroll.
    <div className="flex min-h-full w-full">
      {/* Icon rail: thin, fixed-width, always visible — the whole point of
          this page is switching between these four views without a full
          navigation. sticky + h-[100dvh] keeps it pinned in view as the
          page's own outer ScrollArea (layout.tsx) scrolls a long table
          past it, instead of scrolling away with everything above it.

          Update: no longer a special darker color in light mode — per
          the account holder's own explicit ask, it now matches the
          table rows underneath it (bg-surface/border-border, the exact
          classes dark mode already used) rather than a hardcoded hex
          rail color. That standalone rail hue lives on as the anchor for
          the header-box treatment below instead (see globals.css's
          --header-box). */}
      <nav className="sticky top-0 flex h-[100dvh] w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            title={t.label}
            aria-label={t.label}
            aria-current={tab === t.key}
            className={`flex w-12 flex-col items-center gap-1 rounded-xl py-2.5 text-[9px] font-medium transition-colors ${
              tab === t.key ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-6 py-6">
        {/* --header-box/--header-box-text (globals.css): a bold, self-
            contained box with its own text color, not just another pale
            --surface-N tint read with --text — light mode's own value is
            a bit lighter than the rail's former darker shade, with white
            text; dark mode is aliased back to the previous bg-surface-3/
            text-text look (never part of this ask). */}
        <div className="mb-4 rounded-xl bg-header-box px-4 py-3">
          <h1 className="text-lg font-semibold text-header-box-text">{heading.title}</h1>
          <p className="text-sm text-header-box-text/70">{heading.subtitle}</p>
        </div>

        {tab === "desktop" && <PositionsTable options={options} alerts={alerts} />}
        {tab === "bot" && <BotTable trades={generalBot.trades} myGrade={generalBot.myGrade} storageKey="general" />}
        {tab === "bot-safe" && (
          <BotTable trades={safeBot.trades} myGrade={safeBot.myGrade} storageKey="20_delta_safe" />
        )}
        {tab === "bot-aggressive" && (
          <BotTable trades={aggressiveBot.trades} myGrade={aggressiveBot.myGrade} storageKey="aggressive" />
        )}
        {tab === "chart" && <SecurityChart watchlist={heldTickers} exampleMode={exampleMode} />}
      </main>
    </div>
  );
}
