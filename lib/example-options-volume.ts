// Synthetic options volume for example mode. Tickers match the demo watchlist;
// every number is made up, with one name running well above its usual volume
// and one put-heavy so both states show.
import type { OptionsVolume, OptionsVolumeRow } from "./options-volume";

const TICKERS = ["NVDA", "TSLA", "AMD", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "AVGO", "GLW", "INTC", "PLTR", "MU", "NFLX", "JPM"];

export function exampleOptionsVolume(): OptionsVolume {
  let s = 4242;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const rows: OptionsVolumeRow[] = TICKERS.map((ticker, i) => {
    const scale = 1 / (1 + i * 0.35);
    const callVolume = Math.round(2_000_000 * scale * (0.6 + rand() * 0.6));
    const putVolume = Math.round(callVolume * (i === 4 ? 1.8 : 0.4 + rand() * 0.6));
    const avgPrice = 2 + rand() * 4;
    const spot = 50 + rand() * 400;
    const exp = "2026-10-16";
    const strikeC = Math.round(spot * 1.05);
    const strikeP = Math.round(spot * 0.95);
    return {
      ticker,
      spot,
      callVolume,
      putVolume,
      callPremium: callVolume * avgPrice * 100,
      putPremium: putVolume * avgPrice * 0.8 * 100,
      callOI: callVolume * 3,
      putOI: putVolume * 3,
      putCallRatio: putVolume / callVolume,
      relVolume: i === 2 ? 3.4 : 0.7 + rand() * 0.8,
      topCall: { symbol: `${ticker} C${strikeC}`, strike: strikeC, expiration: exp, volume: Math.round(callVolume * 0.08), oi: Math.round(callVolume * (i === 2 ? 0.03 : 0.2)), premium: callVolume * 0.08 * avgPrice * 100 },
      topPut: { symbol: `${ticker} P${strikeP}`, strike: strikeP, expiration: exp, volume: Math.round(putVolume * 0.07), oi: Math.round(putVolume * 0.3), premium: putVolume * 0.07 * avgPrice * 80 },
    };
  });
  rows.sort((a, b) => b.callPremium + b.putPremium - (a.callPremium + a.putPremium));
  return { date: "2026-10-02", updatedAt: "2026-10-02 20:00:00", rows, historyDays: 20 };
}
