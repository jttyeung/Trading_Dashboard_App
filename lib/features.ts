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
//   TRADER=1            the Trader page (/trader, /api/trader/*) and its card.
//                       Both parked 2026-10-03 on this fork: they read files only
//                       the upstream Python bridge / trader service writes
//                       (quant-scan.json, trade-suggestions.json), which
//                       OptionsEvaluator doesn't produce yet.
export const QUANT = (process.env.QUANT || "").trim() === "1";
export const TRADER = (process.env.TRADER || "").trim() === "1";
