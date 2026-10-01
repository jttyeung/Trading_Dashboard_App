"use client";

// "Rebuild" on the Trader page. While the trader repo is private its code is
// copied onto the host (./trader in the stack folder); this asks the updater
// container to build that folder and restart the trader, so an update is scp
// then one tap. Write-only marker, status file polled, like Update now.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Status {
  ok: boolean;
  status: "idle" | "requested" | "running" | "done" | "error";
  message: string | null;
  updatedAt: string | null;
  error?: string;
}
type Phase = "idle" | "requested" | "running" | "done" | "error";

const TIMEOUT_MS = 10 * 60_000; // a from-scratch build on a Pi can take several minutes

export function TraderRebuildButton() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  useEffect(() => stop, [stop]);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/trader/rebuild", { cache: "no-store" });
      const s = (await r.json()) as Status;
      if (s.status === "running") setPhase("running");
      if (s.status === "done") {
        stop();
        setPhase("done");
        setMsg("Rebuilt and restarted.");
        router.refresh();
        return;
      }
      if (s.status === "error") {
        stop();
        setPhase("error");
        setMsg(s.message || "The rebuild failed.");
        return;
      }
    } catch {
      // keep polling until the timeout
    }
    if (Date.now() - startedAt.current > TIMEOUT_MS) {
      stop();
      setPhase("error");
      setMsg("No answer from the updater in ten minutes. Is the release stack's updater running?");
    }
  }, [router, stop]);

  async function rebuild() {
    if (phase === "requested" || phase === "running") return;
    setMsg("");
    try {
      const r = await fetch("/api/trader/rebuild", { method: "POST" });
      const s = (await r.json().catch(() => ({}))) as Partial<Status>;
      if (!r.ok || s.ok === false) throw new Error(s.error || "Could not ask the updater.");
      setPhase("requested");
      startedAt.current = Date.now();
      stop();
      pollRef.current = setInterval(poll, 3000);
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "Could not ask the updater.");
    }
  }

  const busy = phase === "requested" || phase === "running";
  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-[11px] ${phase === "error" ? "text-rose-300" : phase === "done" ? "text-emerald-300" : "text-muted"}`}>{msg}</span>}
      <button
        onClick={rebuild}
        disabled={busy}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-inset ring-border hover:text-text disabled:opacity-60"
        title="Build the trader folder copied into the stack and restart the trader container (dev phase; nothing is downloaded)"
      >
        {phase === "requested" ? "Requested…" : phase === "running" ? "Building…" : "Rebuild trader"}
      </button>
    </div>
  );
}
