// Feature switches. Each is off unless the environment says otherwise, so a
// release never surprises anyone; flip one on by adding the variable to the
// stack's .env (compose passes it to the dashboard) and restarting.
//
//   WHEEL_CAMPAIGNS=1   the wheel-campaign view (Options page preview and
//                       /options/wheel). Parked 2026-10-01; the code stays.
export const WHEEL_CAMPAIGNS = (process.env.WHEEL_CAMPAIGNS || "").trim() === "1";
//
//   QUANT=1             the Quant CSP scan and Quant portfolio check (/quant,
//                       /quant/portfolio, /api/quant/*) and their Research cards.
//                       quant-scan.json comes from the bridge or, on
//                       OptionsEvaluator, its STRAT-013 quant scan agent (Scan
//                       now via lib/quant-scan-api.ts).
//   TRADER=1            the Trader page (/trader, /api/trader/*) and its card.
//                       Parked 2026-10-03 on this fork: it reads files only the
//                       upstream trader service writes (trade-suggestions.json),
//                       which OptionsEvaluator doesn't produce yet.
export const QUANT = (process.env.QUANT || "").trim() === "1";
export const TRADER = (process.env.TRADER || "").trim() === "1";
//
//   BRIDGE=1            this dashboard is fed by the upstream Python bridge
//                       (justintimefordinner-lang/Schwab_Bridge_Public)
//                       instead of OptionsEvaluator. Hides what only
//                       OptionsEvaluator serves, so nothing shows empty or
//                       "can't reach the daemon": the desktop, overview,
//                       paper-bot, benchmark, risk and connections pages;
//                       its cards on Home, P&L, VIX and Chart; and every
//                       call to its localhost APIs (8091–8096). Data files
//                       both backends write (snapshot, vix, research,
//                       am_report, *-closed) render either way. The reverse
//                       too: the Brief's Refresh button queues work only the
//                       bridge picks up, so it shows only with BRIDGE=1. P&L's
//                       Build history works on both: the bridge via its
//                       task_inbox, OptionsEvaluator via the daemon's
//                       /history-sync (lib/history-sync.ts).
export const BRIDGE = (process.env.BRIDGE || "").trim() === "1";
export const OPTIONSEVAL = !BRIDGE;
