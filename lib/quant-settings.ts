// The Quant scan's variables, chosen on the /quant page. The study's values are
// the defaults; anything the user changes is written to data/quant-settings.json,
// which the bridge's quant_scan.py reads at the start of every scan and the
// trader picks up from the scan's meta.params. Delete the file (Reset) and the
// study's rule is back. Server-only (touches the filesystem).
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/data-dirs";

export const QUANT_SETTINGS_PATH = path.join(DATA_DIR, "quant-settings.json");

export interface QuantParams {
  targetYield: number; // of the strike, per yieldDays (0.04 = 4%)
  yieldDays: number;
  maxDelta: number;
  expMin: number; // days to expiry, inclusive
  expMax: number;
  closeAtPct: number; // close a put once this % of the credit is captured
  maxPerTicker: number; // of buying power (0.10 = 10%)
  tickerBand: number; // stretch allowed for one more contract (0.05 = 5%)
  vixMargin: boolean; // size against the VIX-scaled margin allowance (0 under 20, 5% per 5 points, cap 35%)
  vixCash: boolean; // hold back the VIX framework's cash reserve (the band on the VIX page) from deployable cash
}

/** Combo 87 v2 with 0.75Δ LEAPS: the backtest's best. */
export const STUDY_DEFAULTS: QuantParams = {
  targetYield: 0.04,
  yieldDays: 30,
  maxDelta: 0.35,
  expMin: 28,
  expMax: 45,
  closeAtPct: 50,
  maxPerTicker: 0.1,
  tickerBand: 0.05,
  vixMargin: true,
  vixCash: false, // the study ran with VIX sizing off: fully deployed whatever the VIX
};

type NumericKey = Exclude<keyof QuantParams, "vixMargin" | "vixCash">;

// Sane ranges, so a typo can't ask the bridge for 400% a month or a 900-day put.
const RANGES: Record<NumericKey, [number, number]> = {
  targetYield: [0.005, 0.2],
  yieldDays: [7, 90],
  maxDelta: [0.05, 0.6],
  expMin: [1, 180],
  expMax: [1, 180],
  closeAtPct: [10, 95],
  maxPerTicker: [0.01, 0.5],
  tickerBand: [0, 0.25],
};

export function validateQuantParams(raw: Partial<Record<keyof QuantParams, unknown>>): { params?: QuantParams; error?: string } {
  const out = { ...STUDY_DEFAULTS };
  for (const key of Object.keys(RANGES) as NumericKey[]) {
    const v = raw[key];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    const [lo, hi] = RANGES[key];
    if (!Number.isFinite(n) || n < lo || n > hi) return { error: `${key} must be between ${lo} and ${hi}.` };
    out[key] = key === "yieldDays" || key === "expMin" || key === "expMax" || key === "closeAtPct" ? Math.round(n) : n;
  }
  const flag = (v: unknown) => v === true || v === "true" || v === 1;
  if (raw.vixMargin !== undefined && raw.vixMargin !== null) out.vixMargin = flag(raw.vixMargin);
  if (raw.vixCash !== undefined && raw.vixCash !== null) out.vixCash = flag(raw.vixCash);
  if (out.expMin > out.expMax) return { error: "The shortest expiry can't be after the longest." };
  return { params: out };
}

export function readQuantSettings(): { params: QuantParams; custom: boolean } {
  try {
    const parsed = JSON.parse(fs.readFileSync(QUANT_SETTINGS_PATH, "utf8")) as Partial<QuantParams>;
    const { params } = validateQuantParams(parsed);
    if (params) return { params, custom: JSON.stringify(params) !== JSON.stringify(STUDY_DEFAULTS) };
  } catch {
    /* absent or malformed: the study's rule */
  }
  return { params: STUDY_DEFAULTS, custom: false };
}

export function writeQuantSettings(params: QuantParams): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${QUANT_SETTINGS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...params, updatedAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmp, QUANT_SETTINGS_PATH);
}

export function resetQuantSettings(): void {
  try {
    fs.unlinkSync(QUANT_SETTINGS_PATH);
  } catch {
    /* already the defaults */
  }
}
