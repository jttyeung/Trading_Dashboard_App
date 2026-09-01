// General paper-trading wheel bot: STRAT-001 CSP candidates from the real
// Trade Suggestion Engine, logged into a review queue for approval
// feedback before ever going live. See app/layout.tsx (proxy.ts) for why
// /bot renders full-width instead of the phone-frame shell.
import { getGeneralBot } from "@/lib/bot";
import { BotTable } from "@/components/bot/BotTable";

export const dynamic = "force-dynamic";

export default async function GeneralBotPage() {
  const snap = await getGeneralBot();

  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">CSP Wheel Bot</h1>
        <p className="text-sm text-muted">
          Every candidate the live suggestion engine has surfaced for STRAT-001 (0.20–0.35 delta CSPs) — same scoring, same
          reasoning as the real digest, tracked here for review before it ever touches a real order.
        </p>
      </div>
      <BotTable trades={snap.trades} />
    </main>
  );
}
