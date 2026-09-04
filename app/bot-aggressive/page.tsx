// Aggressive paper-trading wheel bot: STRAT-011's short-dated CSP band
// (3-14 DTE, ideally 7-10, capped at 0.25 delta, 40%+ annualized return
// required just to be considered). Deliberately paperbot-only — unlike
// the general/20-delta-safe bots (whose strategies are also real live
// suggestions), STRAT-011 never appears in the real Discord digest or
// suggested_moves; this is purely a review queue for building trust in
// a more aggressive band before it's ever a real suggestion. Same
// review-queue workflow as /bot and /bot-20-delta-safe. See
// app/layout.tsx (proxy.ts) for why this renders full-width instead of
// the phone-frame shell.
import { getAggressiveBot } from "@/lib/bot";
import { BotTable } from "@/components/bot/BotTable";

export const dynamic = "force-dynamic";

export default async function AggressiveBotPage() {
  const snap = await getAggressiveBot();

  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <div className="mb-4 rounded-xl bg-header-box px-4 py-3">
        <h1 className="text-lg font-semibold text-header-box-text">Aggressive Bot</h1>
        <p className="text-sm text-header-box-text/70">
          STRAT-011&apos;s short-dated CSP band (3–14 DTE, capped at 0.25 delta, 40%+ annualized return required) —
          paperbot-only, never a real suggestion. Same review-queue workflow as the other bots.
        </p>
      </div>
      <BotTable trades={snap.trades} myGrade={snap.myGrade} storageKey="aggressive" />
    </main>
  );
}
