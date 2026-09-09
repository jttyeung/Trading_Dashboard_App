"use client";

// E*TRADE re-authorization, driven entirely from the browser — the
// same two steps `optionseval-cli etrade-authorize` / `etrade-callback`
// walk through at a terminal, so it can be done from a phone over
// Tailscale instead. Same reasoning as SchwabReconnect.tsx, but this one
// is a genuinely daily chore: E*TRADE's own access token expires
// unconditionally at midnight ET with no refresh grant, unlike Schwab's
// roughly-weekly session.
//
// Simpler flow than Schwab's, not just a smaller copy of it: E*TRADE's
// OAuth1 request uses oauth_callback=oob (out-of-band), so there is no
// redirect URL, ever, and no server-hosted-callback option the way
// Schwab's CallbackRedirectURI is. After approving on E*TRADE's own
// site, a short verification CODE is displayed directly on the page
// (not a URL to copy from an address bar), which is pasted back in
// here — no clipboard-URL-parsing needed, just a plain text field.
import { useCallback, useEffect, useState } from "react";
import { completeETradeAuth, fetchETradeAuthStatus, startETradeAuth } from "@/lib/etrade-auth-api";
import { DEMO_MODE } from "@/lib/demo";

type Phase = "checking" | "not-configured" | "connected" | "needs-auth" | "awaiting-code" | "done";

export function ETradeReconnect() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState("");
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const refresh = useCallback(async () => {
    // A demo build has no daemon behind it: show a healthy connection
    // rather than a broken-looking error, and never issue the request.
    if (DEMO_MODE) {
      setPhase("connected");
      setDetail("Connected.");
      return;
    }
    try {
      const status = await fetchETradeAuthStatus();
      setUnreachable(false);
      setDetail(status.detail);
      setPhase((prev) => {
        // Don't yank the user out of a login they're in the middle of.
        if (prev === "awaiting-code" && !status.connected) return prev;
        if (!status.configured) return "not-configured";
        return status.connected ? "connected" : "needs-auth";
      });
    } catch {
      setUnreachable(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      const start = await startETradeAuth();
      setPhase("awaiting-code");
      window.open(start.url, "_blank", "noopener");
    } catch {
      setError("Could not reach the daemon to start the login.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await completeETradeAuth(verifier.trim());
      setVerifier("");
      setPhase("done");
      setDetail("Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the connection.");
    } finally {
      setBusy(false);
    }
  }

  const connected = phase === "connected" || phase === "done";

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-text">E*TRADE connection</h1>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
        {unreachable ? (
          <p className="text-sm text-amber-500">
            Can&apos;t reach the OptionsEvaluator daemon from this device. It has to be running on the
            same machine that served this page.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                connected ? "bg-emerald-500" : phase === "checking" || phase === "not-configured" ? "bg-muted" : "bg-rose-500"
              }`}
            />
            <span className={connected ? "text-emerald-600" : "text-text"}>
              {phase === "checking" ? "Checking…" : detail}
            </span>
          </div>
        )}

        {phase === "not-configured" && !unreachable && (
          <p className="mt-3 text-xs text-muted">
            E*TRADE isn&apos;t set up in this app yet — nothing to do here.
          </p>
        )}

        {connected && (
          <p className="mt-3 text-xs text-muted">
            Nothing to do right now. E*TRADE sessions expire every day at midnight ET — you&apos;ll need
            to come back and reconnect tomorrow.
          </p>
        )}

        {!connected && !unreachable && (phase === "needs-auth" || phase === "awaiting-code") && (
          <div className="mt-4 space-y-4">
            <ol className="space-y-3 text-sm text-text">
              <li>
                <span className="text-muted">1.</span> Open the E*TRADE login and sign in.
                <div className="mt-2">
                  <button
                    onClick={handleStart}
                    disabled={busy}
                    className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
                  >
                    {phase === "awaiting-code" ? "Reopen E*TRADE login" : "Open E*TRADE login"}
                  </button>
                </div>
              </li>
              <li>
                <span className="text-muted">2.</span> After approving, E*TRADE shows a verification
                code directly on the page — copy it.
              </li>
              <li>
                <span className="text-muted">3.</span> Paste it here and reconnect:
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={verifier}
                    onChange={(e) => setVerifier(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifier.trim() && handleSubmit()}
                    placeholder="Verification code"
                    className="w-40 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none ring-emerald-400/40 focus:ring-2"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={busy || !verifier.trim()}
                    className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
                  >
                    Reconnect
                  </button>
                </div>
              </li>
            </ol>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
        {phase === "done" && (
          <p className="mt-3 text-xs text-emerald-600">
            Reconnected. The next sync will pick up today&apos;s real positions and transactions.
          </p>
        )}
      </div>
    </div>
  );
}
