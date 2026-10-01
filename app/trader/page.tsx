import { notFound } from "next/navigation";
import { BackLink, Card, PageHeader } from "@/components/ui";
import { ShowAmounts } from "@/components/privacy";
import { TraderList } from "@/components/TraderList";
import { readSuggestions, traderPresent } from "@/lib/trader";

export const dynamic = "force-dynamic";

// Only installs running the trader service have this page: it keys off the
// file that service writes. Everyone else gets the app's 404.
export default async function TraderPage() {
  if (!traderPresent()) notFound();
  const doc = readSuggestions();
  const m = doc?.meta;
  const asOf = m ? new Date(m.asOf) : null;

  return (
    <main className="px-4" data-wide="1">
      <ShowAmounts>
        <PageHeader
          title="Trader"
          subtitle={
            m
              ? `${m.active} open suggestion${m.active === 1 ? "" : "s"} · last pass ${asOf?.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}${m.paused ? " · paused" : ""}${m.ntfy ? "" : " · ntfy not set"}`
              : "No passes yet"
          }
          right={<BackLink />}
        />
        <Card className="mt-3 px-4 py-3 text-[11px] leading-relaxed text-muted">
          Stage 1: suggestions only. The trader applies the quant rules to this account every 15 minutes during the session, pushes
          anything new to your phone, and logs it here. Mark each one <span className="text-emerald-300">good</span> or{" "}
          <span className="text-rose-300">bad</span> as you review, <span className="text-sky-300">placed it</span> if you traded it
          yourself, or <span className="text-text">skip</span> to stop the reminders. That record is what decides when the next stage —
          placing orders after your approval — is ready. Nothing here places a trade.
        </Card>
        <div className="mt-3">
          <TraderList initial={doc?.suggestions ?? []} />
        </div>
      </ShowAmounts>
    </main>
  );
}
