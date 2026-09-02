// /overview combines the desktop positions table and both paper-bot
// review tables behind one icon rail, instead of three separately-typed
// URLs (/desktop, /bot, /bot-20-delta-safe — all three still work on
// their own too, nothing here removes them). Fetches everything once
// server-side, same "fetch once, pass down" convention as the rest of
// this app, so switching tabs client-side is instant with no re-fetch.
import { getSnapshot } from "@/lib/snapshot";
import { getAlerts } from "@/lib/alerts";
import { getGeneralBot, get20DeltaSafeBot } from "@/lib/bot";
import { accountLabel } from "@/lib/account-shared";
import { OverviewShell } from "@/components/overview/OverviewShell";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const snap = await getSnapshot();
  const alerts = (await getAlerts()).alerts;
  const [generalBot, safeBot] = await Promise.all([getGeneralBot(), get20DeltaSafeBot()]);

  // Same per-account flatten app/desktop/page.tsx uses — see its own
  // comment for why this can't just read the pre-merged "combined" bucket.
  const realAccounts = snap.accounts.filter((a) => a.type !== "all");
  const options = realAccounts.flatMap((a) =>
    snap.data[a.id].options.map((o) => ({ ...o, sourceLabel: accountLabel(a) })),
  );

  return <OverviewShell options={options} alerts={alerts} generalBot={generalBot} safeBot={safeBot} />;
}
