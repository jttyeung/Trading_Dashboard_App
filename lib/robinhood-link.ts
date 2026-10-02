// Find a Robinhood dashboard (the Robinhood-Connection app) running beside this
// one and read its holdings export, so Settings → Manual positions can offer
// "Import Robinhood holdings". Server-only.
//
// Most installs have no Robinhood app, so discovery has to cost nothing: a few
// fast probes of port 3001 on this machine (a refused connection returns at
// once), the answer cached in memory, a miss remembered for 10 minutes. Nothing
// is configured or stored; the button simply never appears when nothing answers.
//
// Where it looks, in order:
//   ROBINHOOD_URL            explicit override, e.g. http://192.168.0.110:3001
//   host.docker.internal     Docker Desktop, or compose with a host-gateway entry
//   the container's gateway  plain Docker on Linux: the host, as seen from here
//   127.0.0.1                both apps run directly on the host (no containers)
import fs from "node:fs";
import { DEMO_MODE } from "@/lib/demo";

const PORT = Number(process.env.ROBINHOOD_PORT || 3001);
const PATH = "/api/export/positions";

export interface RobinhoodPosition {
  type: "stock" | "option";
  [k: string]: unknown;
}
export interface RobinhoodAccount {
  id: string;
  mask?: string;
  label: string;
  cash: number;
  positions: RobinhoodPosition[];
}
export interface RobinhoodExport {
  ok: boolean;
  app: "robinhood";
  generatedAt?: string | null;
  accounts?: RobinhoodAccount[];
  error?: string;
}

/** The default gateway of this container (= the Docker host), from /proc/net/route. */
function dockerGateway(): string | null {
  try {
    for (const line of fs.readFileSync("/proc/net/route", "utf8").split("\n").slice(1)) {
      const [, dest, gw] = line.trim().split(/\s+/);
      if (dest === "00000000" && gw && gw !== "00000000") {
        const b = gw.match(/../g)!.map((h) => parseInt(h, 16)).reverse(); // little-endian hex
        return b.join(".");
      }
    }
  } catch {
    /* not Linux / no procfs */
  }
  return null;
}

function candidates(): string[] {
  const list: string[] = [];
  if (process.env.ROBINHOOD_URL) list.push(...process.env.ROBINHOOD_URL.split(",").map((s) => s.trim().replace(/\/+$/, "")));
  list.push(`http://host.docker.internal:${PORT}`);
  const gw = dockerGateway();
  if (gw) list.push(`http://${gw}:${PORT}`);
  list.push(`http://127.0.0.1:${PORT}`);
  return [...new Set(list.filter(Boolean))];
}

async function read(base: string, timeoutMs: number): Promise<RobinhoodExport | null> {
  try {
    const res = await fetch(base + PATH, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const body = (await res.json()) as RobinhoodExport;
    return body && body.app === "robinhood" ? body : null; // something else on 3001 is not ours
  } catch {
    return null;
  }
}

let cache: { url: string | null; at: number } | null = null;
const HIT_MS = 60_000;
const MISS_MS = 10 * 60_000;

/** The Robinhood dashboard's base URL, or null. `fresh` skips a cached miss (the button press). */
export async function findRobinhood(fresh = false): Promise<string | null> {
  if (DEMO_MODE || process.env.VERCEL) return null;
  const now = Date.now();
  if (cache && now - cache.at < (cache.url ? HIT_MS : MISS_MS) && !(fresh && !cache.url)) return cache.url;
  const all = candidates();
  const results = await Promise.all(all.map((u) => read(u, 1500)));
  const url = all[results.findIndex((r) => r !== null)] ?? null;
  cache = { url, at: now };
  return url;
}

/** Fetch the holdings export from the Robinhood dashboard (null when it isn't there). */
export async function fetchRobinhood(fresh = false): Promise<RobinhoodExport | null> {
  const url = await findRobinhood(fresh);
  if (!url) return null;
  const body = await read(url, 8000);
  if (!body) cache = null; // it went away — look again next time
  return body;
}
