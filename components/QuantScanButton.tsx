"use client";

// "Scan now" for the quant CSP page. Write-only, same model as the Brief's
// Refresh: the tap drops a marker in the bridge's task_inbox/ (via /api/quant/scan);
// the bridge runs the scan and writes quant-status.json into the app's own data/
// folder, which we poll. On a fresh "done" we soft-refresh so the new scan shows.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Status {
  status: "idle" | "running" | "done" | "error";
  error: string | null;
  updatedAt: string | null;
}
type Phase = "idle" | "working" | "done" | "error";

const TIMEOUT_MS = 4 * 60_000; // one chain call per approved name, half a second apart

function friendly(err: string | null): string {
  const e = (err || "").toLowerCase();
  if (e.includes("token") || e.includes("credential") || e.includes("reconnect") || e.includes("auth"))
    return "Connect your Schwab account first (Settings → Schwab connection).";
  return err || "Scan failed.";
}

export function QuantScanButton({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const baseline = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginPolling = useCallback(() => {
    stop();
    startedAt.current = Date.now();
    pollRef.current = setInterval(async () => {
      let s: Status | null = null;
      try {
        const r = await fetch("/api/quant/status", { cache: "no-store" });
        if (r.ok) s = (await r.json()) as Status;
      } catch {
        return;
      }
      if (!s) return;
      const fresh = !!s.updatedAt && s.updatedAt !== baseline.current;
      if (s.status === "done" && fresh) {
        stop();
        setPhase("done");
        router.refresh();
        setTimeout(() => setPhase("idle"), 2500);
      } else if (s.status === "error" && fresh) {
        stop();
        setErrMsg(friendly(s.error));
        setPhase("error");
        setTimeout(() => setPhase("idle"), 8000);
      } else if (Date.now() - startedAt.current > TIMEOUT_MS) {
        stop();
        setErrMsg("Still working — make sure the bridge is running.");
        setPhase("error");
        setTimeout(() => setPhase("idle"), 8000);
      }
    }, 3000);
  }, [router, stop]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/quant/status", { cache: "no-store" });
        if (!r.ok) return;
        const s = (await r.json()) as Status;
        if (!cancelled && s.status === "running") {
          baseline.current = s.updatedAt;
          setPhase("working");
          beginPolling();
        }
      } catch {
        /* no status yet */
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [beginPolling, stop]);

  const start = useCallback(async () => {
    if (phase === "working") return;
    setPhase("working");
    setErrMsg("");
    try {
      try {
        const r0 = await fetch("/api/quant/status", { cache: "no-store" });
        baseline.current = r0.ok ? ((await r0.json()) as Status).updatedAt : null;
      } catch {
        baseline.current = null;
      }
      const r = await fetch("/api/quant/scan", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) throw new Error(d.error || "Could not start.");
      beginPolling();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Failed to start.");
      setPhase("error");
      setTimeout(() => setPhase("idle"), 8000);
    }
  }, [phase, beginPolling]);

  const working = phase === "working";
  const label = phase === "done" ? "Scanned" : phase === "error" ? "Failed" : working ? "Scanning…" : "Scan now";

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void start()}
        disabled={working || demo}
        title={demo ? "The demo shows a sample scan" : phase === "error" ? errMsg : "Pull live chains for every approved name and apply the rule"}
        className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-inset ring-border transition-colors active:bg-surface disabled:opacity-80"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={working ? "animate-spin" : ""}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        <span className={phase === "done" ? "text-emerald-400" : phase === "error" ? "text-rose-400" : ""}>{label}</span>
      </button>
      {phase === "error" && <span className="text-[11px] text-rose-400">{errMsg}</span>}
      {working && <span className="text-[11px] text-muted">One chain per name; a minute or so.</span>}
    </div>
  );
}
