"use client";

import { useEffect, useState } from "react";
import type { Alert, BotSnapshot } from "@/lib/types";
import { PositionsTable, type SourcedOption } from "@/components/desktop/PositionsTable";
import { BotTable } from "@/components/bot/BotTable";
import { useThemeMode } from "@/components/theme-mode";

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
  const { resolved } = useThemeMode();

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
    <div className="flex h-full w-full">
      {/* Icon rail: thin, fixed-width, always visible — the whole point of
          this page is switching between these three views without a full
          navigation. sticky + h-[100dvh] (not the flex row's own h-full,
          which only ever matched ONE viewport's worth of height) so the
          rail stays pinned in view as the page's own outer ScrollArea
          (layout.tsx) scrolls a long table past it, instead of scrolling
          away with everything above it — the real bug this fixes.

          Light mode only: a deliberately darker dusty-slate rail against
          the light content pane, per a Headspace reference screen (a
          dark slate-blue backdrop behind a light phone frame, the
          account holder's own explicit "side nav bar with a darker color
          than the rest" ask) — the one place in the light theme that
          inverts to a dark-ish surface on purpose, rather than another
          shade of the same light palette. Lightened twice now (the
          first two passes both read as too dark) — this is also the
          anchor hue for globals.css's own --bg/--surface-2/--surface-3/
          --border in light mode ("shades off the nav bar" was the
          account holder's own explicit direction for the rest of the
          page too), so lightening it further here is paired with
          lightening those the same direction in globals.css. Dark mode
          is untouched (already approved) since a rail this size adds
          little further hierarchy on top of an already-dark page.
          --accent (gold) reads well against this slate regardless of
          theme, so the active-tab treatment doesn't need its own
          rail-specific variant; inactive/hover text darkened from the
          previous near-white pair since they need real contrast against
          a much lighter rail now, not the earlier near-navy one. */}
      <nav
        className={`sticky top-0 flex h-[100dvh] w-16 shrink-0 flex-col items-center gap-1 border-r py-4 ${
          resolved === "light" ? "border-[#838da6] bg-[#9aa4bd]" : "border-border bg-surface"
        }`}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            title={t.label}
            aria-label={t.label}
            aria-current={tab === t.key}
            className={`flex w-12 flex-col items-center gap-1 rounded-xl py-2.5 text-[9px] font-medium transition-colors ${
              tab === t.key
                ? "bg-accent/20 text-accent"
                : resolved === "light"
                  ? "text-[#565f78] hover:bg-white/20 hover:text-[#2f3547]"
                  : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </nav>

      <main className="min-w-0 flex-1 px-6 py-6">
        {/* Boxed (not just bare text on the page bg) so this reads as its
            own section, distinct from --surface-2's grayer tone used
            just below (BotTable's date-group headers) — the account
            holder's own "each of those sets are slight variants" ask. */}
        <div className="mb-4 rounded-xl bg-surface-3 px-4 py-3">
          <h1 className="text-lg font-semibold text-text">{heading.title}</h1>
          <p className="text-sm text-muted">{heading.subtitle}</p>
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
