"use client";

// "Run now" on the Trader page. Write-only, like the Quant scan button: the tap
// drops data/trader-run (via /api/trader/run); the trader service runs a full
// pass — closes, new puts, covered calls, notes — whatever the day or hour,
// pushes anything new to the phone and rewrites the suggestions file. We poll
// until the file's asOf moves past what it was when we asked, then soft-refresh.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface RunState {
  ok: boolean;
  pending: boolean;
  asOf: string | null;
  pushed: number;
  active: number;
  error?: string;
}
type Phase = "idle" | "working" | "done" | "error";

const TIMEOUT_MS = 90_000; // the trader looks for the marker every 5 s; a pass takes a few seconds

export function TraderRunButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const baseline = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  useEffect(() => stop, [stop]);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/trader/run", { cache: "no-store" });
      const s = (await r.json()) as RunState;
      if (s.asOf && s.asOf !== baseline.current && !s.pending) {
        stop();
        setPhase("done");
        setMsg(s.pushed > 0 ? `${s.pushed} new suggestion${s.pushed === 1 ? "" : "s"} pushed` : "Nothing new — every suggestion that applies was already sent");
        router.refresh();
        return;
      }
    } catch {
      // keep polling until the timeout
    }
    if (Date.now() - startedAt.current > TIMEOUT_MS) {
      stop();
      setPhase("error");
      setMsg("The trader didn't pick it up. Is its container running?");
    }
  }, [router, stop]);

  async function run() {
    if (phase === "working") return;
    setPhase("working");
    setMsg("");
    try {
      const r = await fetch("/api/trader/run", { method: "POST" });
      const s = (await r.json().catch(() => ({}))) as Partial<RunState>;
      if (!r.ok || s.ok === false) throw new Error(s.error || "Could not ask the trader.");
      baseline.current = s.asOf ?? null;
      startedAt.current = Date.now();
      stop();
      pollRef.current = setInterval(poll, 3000);
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "Could not ask the trader.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-[11px] ${phase === "error" ? "text-rose-300" : "text-muted"}`}>{msg}</span>}
      <button
        onClick={run}
        disabled={phase === "working"}
        className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/15 disabled:opacity-60"
        title="Re-test every rule against the account right now, any day, and push anything new"
      >
        {phase === "working" ? "Running…" : "Run now"}
      </button>
    </div>
  );
}
