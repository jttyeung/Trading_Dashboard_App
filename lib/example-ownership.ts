// Synthetic insider activity for example mode: made-up names, seeded off the
// ticker, with a director's buys among planned and discretionary sales so every
// state the panel draws shows up. No real filer appears here.
import type { InsiderMonth, InsiderRole, InsiderRoleGroup, InsiderTrade, InsiderWindow, Ownership } from "./ownership";

const PEOPLE: { name: string; role: InsiderRoleGroup; title: string; planned: boolean }[] = [
  { name: "Example Officer A", role: "C-suite", title: "Chief Executive Officer", planned: true },
  { name: "Example Director B", role: "Director", title: "Director", planned: false },
  { name: "Example Officer C", role: "Other officer", title: "SVP, General Counsel", planned: false },
  { name: "Example Officer D", role: "C-suite", title: "EVP & Chief Financial Officer", planned: true },
];

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
    const who = PEOPLE[i % PEOPLE.length];
    trades.push({
      name: who.name, date, filed: date, buy, shares, price: p, value: shares * p, sharesAfter: Math.round(shares * (3 + rand() * 10)),
      role: who.role, title: who.title, planned: buy ? false : who.planned,
    });
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

  const order: InsiderRoleGroup[] = ["C-suite", "Other officer", "Director", "10% owner", "Other"];
  const roles: InsiderRole[] = order
    .map((role) => {
      const ts = trades.filter((t) => t.role === role);
      const sells = ts.filter((t) => !t.buy);
      return {
        role,
        buyValue: ts.filter((t) => t.buy).reduce((a, t) => a + t.value, 0),
        sellValue: sells.reduce((a, t) => a + t.value, 0),
        plannedSellValue: sells.filter((t) => t.planned).reduce((a, t) => a + t.value, 0),
        buyers: [...new Set(ts.filter((t) => t.buy).map((t) => t.name))],
        sellers: [...new Set(sells.map((t) => t.name))],
      };
    })
    .filter((r) => r.buyValue || r.sellValue);

  return {
    symbol,
    trades,
    windows,
    months,
    roles,
    fetchedAt: now.toISOString(),
  };
}
