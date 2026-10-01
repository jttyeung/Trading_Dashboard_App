import { BackLink, PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/SettingsForm";
import { BRIDGE_ENV_PATH } from "@/lib/bridge-dir";
import { bridges } from "@/lib/bridges";
import { readEnvFile } from "@/lib/env-file";
import { getSimSkew } from "@/lib/sim-skew";
import { readManualFile } from "@/lib/manual-positions";
import { getSnapshot } from "@/lib/snapshot";
import { getCombineIds, getSelectedAccountId, COMBINED_ID, accountLabel } from "@/lib/account";
import Link from "next/link";
import { Card } from "@/components/ui";
import { readSuggestions, traderPresent } from "@/lib/trader";

export const dynamic = "force-dynamic";

function secToMin(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n / 60 : fallback;
}

export default async function SettingsPage() {
  const env = readEnvFile(BRIDGE_ENV_PATH);
  const bridgeList = bridges().map((b) => ({ id: b.id, label: b.label }));
  const snap = await getSnapshot();
  const [combineIds, selectedId] = await Promise.all([getCombineIds(snap), getSelectedAccountId(snap)]);
  const accounts = snap.accounts.map((a) => ({ id: a.id, label: accountLabel(a), mask: a.mask, type: a.type }));

  return (
    <main className="px-4">
      <PageHeader title="Settings" subtitle="Refresh intervals, Simulate & views" right={<BackLink />} />
      <div className="mt-4 pb-6">
        {/* Only installs running the trader service see this. */}
        {traderPresent() && (
          <Link href="/trader" className="mb-3 block active:opacity-80">
            <Card className="flex items-center justify-between gap-3 bg-sky-500/5 px-4 py-3 ring-1 ring-inset ring-sky-500/25">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-sky-200">Trader</div>
                <div className="text-[11px] text-muted">{readSuggestions()?.meta.active ?? 0} open suggestions · pushed to your phone</div>
              </div>
              <span className="shrink-0 text-sm font-medium text-sky-300">Open ›</span>
            </Card>
          </Link>
        )}
        <SettingsForm
          initialIntervals={{
            appMinutes: secToMin(env.APP_PUSH_INTERVAL, 1),
            historyMinutes: secToMin(env.HISTORY_PUSH_INTERVAL, 1),
            researchMinutes: secToMin(env.RESEARCH_PUSH_INTERVAL, 15),
            amReportMinutes: secToMin(env.AM_REPORT_PUSH_INTERVAL, 30),
            amLadderMinutes: secToMin(env.AM_LADDER_PUSH_INTERVAL, 5),
          }}
          initialSkew={getSimSkew()}
          bridges={bridgeList}
          manual={readManualFile().accounts}
          accounts={accounts}
          combineIds={combineIds}
          combinedSelected={selectedId === COMBINED_ID}
        />
      </div>
    </main>
  );
}
