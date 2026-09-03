// 20-delta-safe paper-trading wheel bot: STRAT-003's "20 Delta Safe
// Moves" (0.10-0.20 delta CSPs, biased toward strikes far below current
// price with near-zero assignment odds) — same review-queue idea as
// /bot, just the conservative delta band. See app/layout.tsx (proxy.ts)
// for why this renders full-width instead of the phone-frame shell.
import { get20DeltaSafeBot } from "@/lib/bot";
import { BotTable } from "@/components/bot/BotTable";

export const dynamic = "force-dynamic";

export default async function DeltaSafeBotPage() {
  const snap = await get20DeltaSafeBot();

  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <div className="mb-4 rounded-xl bg-header-box px-4 py-3">
        <h1 className="text-lg font-semibold text-header-box-text">20 Delta Safe Moves</h1>
        <p className="text-sm text-header-box-text/70">
          STRAT-003&apos;s conservative CSP band (0.10–0.20 delta) — biased toward strikes far below current price, aiming
          for near-zero assignment odds. Same review-queue workflow as the general bot.
        </p>
      </div>
      <BotTable trades={snap.trades} myGrade={snap.myGrade} storageKey="20_delta_safe" />
    </main>
  );
}
