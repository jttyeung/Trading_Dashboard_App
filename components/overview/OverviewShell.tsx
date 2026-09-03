"use client";

import { useEffect, useState } from "react";
import type { Alert, BotSnapshot } from "@/lib/types";
import { PositionsTable, type SourcedOption } from "@/components/desktop/PositionsTable";
import { BotTable } from "@/components/bot/BotTable";

type Tab = "desktop" | "bot" | "bot-safe";

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
    key: "bot-safe",
    label: "20 Delta Safe",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
      </svg>
    ),
  },
];

const TAB_KEY = "overviewActiveTab";

function loadTab(): Tab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "desktop" || raw === "bot" || raw === "bot-safe") return raw;
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
};

// A single icon rail switching between the desktop positions table and
// both paper-bot review tables, so all three "personal power-user"
// surfaces live under one path instead of three separately-typed URLs.
// Data for all three is fetched once by the server component and handed
// down here, so switching tabs is instant client-side state, never a
// re-fetch or navigation.
export function OverviewShell({
  options,
  alerts,
  generalBot,
  safeBot,
}: {
  options: SourcedOption[];
  alerts: Alert[];
  generalBot: BotSnapshot;
  safeBot: BotSnapshot;
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
          this page is switching between these three views without a full
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
      </main>
    </div>
  );
}
