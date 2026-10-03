// Server-side: the selected account's wheel campaigns (lib/campaigns.ts), from the
// closed-trade files plus the snapshot's open positions.
import type { AccountData, Snapshot } from "./types";
import { COMBINED_ID, getCombineIds, getSelectedAccount } from "./account";
import { getClosedCsps } from "./csp-closed";
import { getClosedCovered } from "./covered-closed";
import { getClosedStocks } from "./stocks-closed";
import { buildCampaigns, type Campaign } from "./campaigns";

export async function getCampaigns(snap: Snapshot): Promise<{ id: string; data: AccountData; campaigns: Campaign[] }> {
  const { id, data } = await getSelectedAccount(snap);
  const ids = id === COMBINED_ID ? await getCombineIds(snap) : [id];
  // Closed records carry the account they came from; unstamped ones (older builds,
  // manual accounts) can't be placed, so they stay in every view like elsewhere.
  const mine = <T extends { accountId?: string }>(rs: T[]) => rs.filter((r) => !r.accountId || ids.includes(r.accountId));
  const [csp, covered, stocks] = await Promise.all([getClosedCsps(), getClosedCovered(), getClosedStocks()]);
  const campaigns = buildCampaigns({
    closedCsps: mine(csp.closed),
    closedCovered: mine(covered.closed),
    closedStocks: mine(stocks.closed),
    options: data.options,
    equities: data.equities,
  });
  return { id, data, campaigns };
}
