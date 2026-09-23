// Aggressive paper-trading wheel bot: a short-dated CSP band
// (3-14 DTE, ideally 7-10, capped at 0.28 delta, 80%+ annualized return
// required just to be considered). Started paperbot-only, then promoted
// to a real suggestion once paperbot history built trust in the band —
// like the general/20-delta-safe bots, it now also appears in the real
// Discord digest/suggested_moves; this page remains a review queue on
// top of that, same workflow as /bot and /bot-20-delta-safe. See
// app/layout.tsx (proxy.ts) for why this renders full-width instead of
// the phone-frame shell.
import { getAggressiveBot } from "@/lib/bot";
import { BotTable } from "@/components/bot/BotTable";
import { isExampleMode } from "@/lib/example-mode";

export const dynamic = "force-dynamic";

export default async function AggressiveBotPage() {
  const [snap, exampleMode] = await Promise.all([getAggressiveBot(), isExampleMode()]);

  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <div className="mb-4 rounded-xl bg-header-box px-4 py-3">
        <h1 className="text-lg font-semibold text-header-box-text">Aggressive Bot</h1>
        <p className="text-sm text-header-box-text/70">
          A short-dated CSP band (3–14 DTE, capped at 0.28 delta, 80%+ annualized return required).
          Same review-queue workflow as the other bots.
        </p>
      </div>
      <BotTable trades={snap.trades} myGrade={snap.myGrade} storageKey="aggressive" exampleMode={exampleMode} />
    </main>
  );
}
