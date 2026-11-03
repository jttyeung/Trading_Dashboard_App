// Calendar of the account holder's real SPX/SPXW P/L by the day each trade
// closed. A top-level wide surface (see app/layout.tsx), reached from the
// icon rail on /overview.
import { notFound } from "next/navigation";
import Link from "next/link";
import { BRIDGE } from "@/lib/features";
import { getSpxPnl } from "@/lib/spx-pnl";
import { SpxPnlCalendar } from "@/components/SpxPnlCalendar";

export const dynamic = "force-dynamic";

export default async function SpxPnlPage() {
  if (BRIDGE) notFound(); // OptionsEvaluator-only; see lib/features.ts
  const file = await getSpxPnl();
  return (
    <main className="min-h-screen w-full bg-bg px-6 py-6 text-text">
      <Link href="/overview" className="mb-4 inline-block text-xs text-muted hover:text-text">
        ← Overview
      </Link>
      <SpxPnlCalendar days={file.days} />
    </main>
  );
}
