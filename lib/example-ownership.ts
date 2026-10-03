// Synthetic insider activity for example mode: made-up names, seeded off the
// ticker, with a couple of buys among the sales and one stale holder so every
// state the panel draws shows up. No real filer appears here.
import type { InsiderMonth, InsiderTrade, InsiderWindow, Ownership } from "./ownership";

const NAMES = ["Example Officer A", "Example Director B", "Example Officer C", "Example Director D"];

export function exampleOwnership(symbol: string): Ownership {
  let s = symbol.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 11) % 2147483647 || 1;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const now = new Date();
  const price = 40 + (symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 200);

  const trades: InsiderTrade[] = [];
  for (let i = 0; i < 9; i++) {
    const d = new Date(now.getTime() - (10 + Math.floor(rand() * 350)) * 864e5);
    const buy = i % 4 === 1;
    const shares = Math.round((buy ? 2000 : 8000) * (0.5 + rand()));
    const p = Math.round(price * (0.85 + rand() * 0.3) * 100) / 100;
    const date = d.toISOString().slice(0, 10);
    trades.push({ name: NAMES[i % NAMES.length], date, filed: date, buy, shares, price: p, value: shares * p, sharesAfter: Math.round(shares * (3 + rand() * 10)) });
  }
  trades.sort((a, b) => b.date.localeCompare(a.date));

  const windows: InsiderWindow[] = [3, 6, 12].map((m) => {
    const since = new Date(now.getFullYear(), now.getMonth() - m, now.getDate()).toISOString().slice(0, 10);
    const inWin = trades.filter((t) => t.date >= since);
    const buys = inWin.filter((t) => t.buy);
    const sells = inWin.filter((t) => !t.buy);
    return {
      months: m,
      buyValue: buys.reduce((a, t) => a + t.value, 0),
      sellValue: sells.reduce((a, t) => a + t.value, 0),
      buyers: new Set(buys.map((t) => t.name)).size,
      sellers: new Set(sells.map((t) => t.name)).size,
      buyTrades: buys.length,
      sellTrades: sells.length,
    };
  });

  const months: InsiderMonth[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1));
    const month = d.toISOString().slice(0, 7);
    const inMonth = trades.filter((t) => t.date.startsWith(month));
    return {
      month,
      buyValue: inMonth.filter((t) => t.buy).reduce((a, t) => a + t.value, 0),
      sellValue: inMonth.filter((t) => !t.buy).reduce((a, t) => a + t.value, 0),
    };
  });

  return {
    symbol,
    trades,
    windows,
    months,
    holders: [
      { name: "Example Index Fund Manager", percent: 8.1, shares: 61_000_000, asOf: "2026-03-31", filed: "2026-04-29", form: "SCHEDULE 13G" },
      { name: "Example Asset Manager", percent: 6.4, shares: 48_000_000, asOf: "", filed: "2024-02-12", form: "SC 13G/A" },
    ],
    fetchedAt: now.toISOString(),
  };
}
