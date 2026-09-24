# Trading Dashboard

A self-hosted **Next.js dashboard** for tracking a stock & options portfolio — holdings,
open option positions (cash-secured puts, covered calls, LEAPs, spreads), closed-trade
history, P&L, research signals, and market context (VIX, breadth). **Read-only:** it
displays data, it never places trades.

The app reads its data from local JSON files in `data/`, which are written by a companion
data bridge. Out of the box — with no data and no bridge — it runs in **example mode** on a
built-in demo dataset, so you can explore the whole UI immediately.

## Features

- **Overview** — total value, buying power, day change, and a value-history chart
- **Holdings** — equities and crypto with cost basis and live-ish marks
- **Options** — positions grouped by strategy (CSP, covered call, LEAP, spread), with
  Greeks, breakevens, and chance-of-profit
- **Closed trades** — realized round-trips per strategy bucket
- **P&L by month** — each month's realized dollars next to its time-weighted return (TWR),
  the raw NAV change, the deposits/withdrawals detected that month, and what's left once
  they're backed out. Realized premium can hit its monthly target in a month the portfolio
  itself shrank, so both sit in one row. TWR comes from the daemon's already flow-adjusted
  `actualDailyReturns` (`data/benchmark.json`) — the same series the Benchmark page's range
  tabs link, so the two pages can't disagree. Months older than that series show realized
  dollars only, and the year row names the span it actually covers
- **Research & screeners** — approved-stock research signals and a CSP candidate screener
- **Market context** — VIX regime guide and morning briefing, plus the Fed calendar: the next
  FOMC decision with a countdown and what CME fed funds futures price into it (hike / cut /
  hold, odds of a 25bp move, the implied rate path), read from the daemon's `data/fomc.json`.
  Informational only — nothing gates on it
- **Chart a Ticker** — on-demand 2-year daily chart for any symbol: candles, Bollinger Bands,
  50/200-day SMA with golden/death cross markers, MACD and RSI panes, plus call/put walls and
  the gamma flip. Served by the app's own `/api/chart` route, which asks the OptionsEvaluator
  daemon's chart API first (Schwab bars, live walls for any ticker; `CHART_API_URL`, default
  `http://localhost:8092`) and falls back to Yahoo Finance with walls for held names only when
  the daemon is unreachable. Hold any ticker anywhere in the app for 1.8 seconds to open it there
- **Portfolio risk** — theta ceiling, sector concentration against a per-sector cap, beta vs
  QQQ, and an open-P&L floor, all across every account. Sector buckets (with the tickers behind
  each) come from the daemon's `data/portfolio-risk.json`; sectors are the wheel watchlist
  sheet's own, so a name not on the sheet shows under "Unclassified"
- **My Trades** (desktop `/overview` tab) — the account holder's own broker-confirmed trades that
  matched a suggestion, by strategy and delta bucket — kept separate from the bots. The guideline,
  management and entry-condition sections cover every closed short option trade across Schwab,
  Fidelity and E*TRADE (roll chains and alert response stay Schwab-only). A separate
  "LEAPs you bought" block grades closed long options (Schwab and Fidelity) against the LEAPs entry window
  only (365+ DTE, 0.70+ delta at entry), with return on cost rather than collateral, so a bought
  call never averages into the premium-selling stats
- **YTD returns on both scorecards** (`data/ytd-returns.json`) — a plain stock-return bar chart
  (prior year-end close to the latest close) for the tickers each tab covers: every name the
  account holder closed a trade on, or every name behind the bots' resolved picks
- **Bot Scorecard** (desktop `/overview` tab) — the paper bots' resolved picks by strategy, plus a score-factor section
  (`data/score-factors.json`): for each term in the paper bots' own score (VRP, IV rank,
  indicator signals, walls, gamma, entry timing) the win rate and mean return with vs without
  it, the correlation between the term and the trade's return, and that correlation replayed
  as the resolved sample grew — a mirror for judging whether a factor earns its place, never a
  feedback loop into the bots
- **Example mode** — a full, self-consistent demo dataset so the app is presentable
  without exposing (or even having) real data

## Getting started

### Prerequisites
- **Node.js 20+** and npm

### Install & run
```bash
npm install
npm run dev      # dev server at http://localhost:3000
```
The dev server binds `0.0.0.0`, so you can also reach it from other devices on your
network at `http://<your-machine-ip>:3000`.

For a production build:
```bash
npm run build
npm run start    # serves the optimized build on port 3000
```

**Use the production build for anything other than active development** — checking
the dashboard from your phone (e.g. over Tailscale), sharing it, or just regular
day-to-day browsing. `npm run dev`'s hot-reload client and unminified bundles make
initial hydration meaningfully slower once there's real network latency involved (a
loopback `localhost` connection hides this completely, which is why it can look fine
on desktop). The practical symptom: buttons that need JavaScript to do anything (a
`<button onClick>`, not a plain link) briefly do nothing when tapped right after the
page appears, because React hasn't finished attaching event handlers yet — worse in a
private/incognito tab, since there's no cached JS from a previous visit to speed it
up. Reach for `npm run dev` only while you're actively editing frontend code.

With no `data/` files present, every view renders the **example dataset** — nothing to
configure to look around.

## Data: example vs. live

The app loads a portfolio snapshot in this order:

1. **Example mode** (a UI toggle) → the built-in demo dataset in `lib/example.ts`
2. Otherwise → `data/snapshot.json` (and the other `data/*.json` files)
3. If those are missing/unreadable → it falls back to the example dataset

Everything in `data/*.json` is **gitignored** — real portfolio data never gets committed.
To feed the dashboard live data, run the companion bridge, which writes those JSON files:

> **Data bridge:** [`Schwab_Bridge_Public`](https://github.com/justintimefordinner-lang/Schwab_Bridge_Public)
> — a small read-only Python bridge that pulls from a Charles Schwab account and writes the
> `data/*.json` this app reads. Point its `APP_DATA_DIR` at this project's `data/` folder.

Connect your Schwab account right from the app: open **Settings → Schwab connection** to enter
your App Key/Secret (first run) and do the weekly re-login — no CLI needed. The app is write-only
toward the bridge: it deposits credentials and the pasted login URL and never reads the bridge's
secrets back.

## Deployment (optional)

It runs anywhere Node runs, including a Raspberry Pi. A simple pattern is to run
`npm run start` under a process manager (e.g. a `systemd` service) so it auto-starts on
boot, with the bridge running alongside it writing fresh data on an interval.

Two run modes, and they are mutually exclusive:

- **`npm run start`** (i.e. `next start`) serves an ordinary `npm run build`. This is the
  default.
- **`BUILD_STANDALONE=1 npm run build`** emits a self-contained `.next/standalone` tree you
  run with `node server.js` (copy `.next/static` and `public` in beside it, as the
  `Dockerfile` does). Useful when you want to ship build output to a host without
  installing dependencies there.

Pick one per host. Next refuses to run `next start` against a standalone build, and the
failure is easy to misread: pages still serve, but the global error page can't resolve its
chunk, so any server-side crash renders a bare HTTP 500 instead of the error UI.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- File-based data (no database) — the `data/*.json` snapshot is the single source of truth

## Notes

- This is a personal-use dashboard, not investment advice. Data can be delayed or
  incomplete; verify anything before acting on it.
- No secrets or credentials live in this repo — the app only ever *reads* local JSON. All
  brokerage access is isolated in the separate bridge project.
- **Commit-time secret guard:** a dependency-free `.githooks/pre-commit` (plus a gitleaks
  `.pre-commit-config.yaml`) blocks accidental commits of credential files or secret-looking
  values. After cloning, enable it with `git config core.hooksPath .githooks`.
