"use client";

// Schwab re-authorization, driven entirely from the browser — the same
// three steps `optionseval-cli auth` walks through at a terminal, so it
// can be done from a phone over Tailscale instead. Schwab's refresh
// token expires roughly weekly with no automatic recovery, and until
// it's renewed the dashboard's Today P/L, marks and Greeks silently read
// zero across every account.
//
// There are two flows, and which one applies is reported by the daemon
// (AuthStatus.callbackFlow) so the right instructions show from the
// first paint rather than switching mid-login:
//
//   - Callback flow (SCHWAB_CALLBACK_REDIRECT_URI set, and the same URL
//     registered on the Schwab app): Schwab delivers the code straight to
//     the daemon, so there is nothing to copy at all. This page just
//     polls until the session goes live, since the login finishes in
//     another tab.
//   - Paste flow (the default): Schwab redirects to https://127.0.0.1,
//     which resolves to whatever device you're on and has nothing
//     listening — so the one-time code lands in the address bar instead.
//     "Paste & reconnect" reads the clipboard so it's one tap rather than
//     a manual paste, with a text field kept as the fallback for when the
//     browser denies clipboard access (Safari prompts, and a denial
//     sticks for the session).
import { useCallback, useEffect, useState } from "react";
import { completeAuth, fetchAuthStatus, startAuth } from "@/lib/auth-api";
import { DEMO_MODE } from "@/lib/demo";

type Phase = "checking" | "connected" | "needs-auth" | "awaiting-code" | "awaiting-callback" | "done";

export function SchwabReconnect() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [autoComplete, setAutoComplete] = useState(false);

  const refresh = useCallback(async () => {
    // A demo build has no daemon behind it: show a healthy connection
    // rather than a broken-looking error, and never issue the request.
    // See lib/use-schwab-connected.ts for the same reasoning.
    if (DEMO_MODE) {
      setPhase("connected");
      setDetail("Connected.");
      return;
    }
    try {
      const status = await fetchAuthStatus();
      setUnreachable(false);
      setDetail(status.detail);
      setAutoComplete(status.callbackFlow);
      setPhase((prev) => {
        // Don't yank the user out of a login they're in the middle of.
        if ((prev === "awaiting-code" || prev === "awaiting-callback") && !status.connected) return prev;
        return status.connected ? "connected" : "needs-auth";
      });
    } catch {
      setUnreachable(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // In the callback flow the login finishes in ANOTHER tab, so this one
  // has to notice on its own. Polls only while actually waiting, and
  // stops as soon as the session goes live.
  useEffect(() => {
    if (phase !== "awaiting-callback") return;
    const id = setInterval(async () => {
      try {
        const status = await fetchAuthStatus();
        if (status.connected) {
          setPhase("done");
          setDetail("Connected.");
        }
      } catch {
        // daemon momentarily unreachable — keep waiting rather than
        // failing a login that may well have succeeded
      }
    }, 2000);
    return () => clearInterval(id);
  }, [phase]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      const start = await startAuth();
      setAutoComplete(start.autoComplete); // authoritative; status already hinted it
      setPhase(start.autoComplete ? "awaiting-callback" : "awaiting-code");
      window.open(start.url, "_blank", "noopener");
    } catch {
      setError("Could not reach the daemon to start the login.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(url: string) {
    setBusy(true);
    setError(null);
    try {
      await completeAuth(url);
      setRedirectUrl("");
      setPhase("done");
      setDetail("Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the connection.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasteAndSubmit() {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.includes("code=")) {
        setError("The clipboard doesn't look like the redirect URL — paste it below instead.");
        return;
      }
      await submit(text);
    } catch {
      setError("Couldn't read the clipboard — paste the URL below instead.");
    }
  }

  const connected = phase === "connected" || phase === "done";

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-text">Schwab connection</h1>

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
                connected ? "bg-emerald-500" : phase === "checking" ? "bg-muted" : "bg-rose-500"
              }`}
            />
            <span className={connected ? "text-emerald-600" : "text-text"}>
              {phase === "checking" ? "Checking…" : detail}
            </span>
          </div>
        )}

        {connected && (
          <p className="mt-3 text-xs text-muted">
            Nothing to do. Schwab sessions expire about weekly — you&apos;ll get a nudge in
            #app-alerts when it&apos;s time to reconnect.
          </p>
        )}

        {!connected && !unreachable && phase !== "checking" && autoComplete && (
          <div className="mt-4 space-y-3 text-sm text-text">
            <p>
              {phase === "awaiting-callback"
                ? "Sign in to Schwab in the tab that just opened. Nothing to copy — this page picks it up on its own once you approve."
                : "Signing in takes one tap. Nothing to copy or paste — Schwab hands the session straight back to the daemon."}
            </p>
            <button
              onClick={handleStart}
              disabled={busy}
              className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
            >
              {phase === "awaiting-callback" ? "Reopen Schwab login" : "Open Schwab login"}
            </button>
            {phase === "awaiting-callback" && (
              <p className="text-xs text-muted">Waiting for you to finish signing in…</p>
            )}
          </div>
        )}

        {!connected && !unreachable && phase !== "checking" && !autoComplete && (
          <div className="mt-4 space-y-4">
            <ol className="space-y-3 text-sm text-text">
              <li>
                <span className="text-muted">1.</span> Open the Schwab login and sign in.
                <div className="mt-2">
                  <button
                    onClick={handleStart}
                    disabled={busy}
                    className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
                  >
                    {phase === "awaiting-code" ? "Reopen Schwab login" : "Open Schwab login"}
                  </button>
                </div>
              </li>
              <li>
                <span className="text-muted">2.</span> After approving, the page will fail to load —
                that&apos;s expected. Copy the whole URL from the address bar.
              </li>
              <li>
                <span className="text-muted">3.</span> Come back here and tap:
                <div className="mt-2">
                  <button
                    onClick={handlePasteAndSubmit}
                    disabled={busy}
                    className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
                  >
                    Paste &amp; reconnect
                  </button>
                </div>
              </li>
            </ol>

            <details className="text-xs text-muted">
              <summary className="cursor-pointer">Clipboard blocked? Paste it manually</summary>
              <div className="mt-2 space-y-2">
                <input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://127.0.0.1/?code=…"
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none ring-emerald-400/40 focus:ring-2"
                />
                <button
                  onClick={() => submit(redirectUrl.trim())}
                  disabled={busy || !redirectUrl.trim()}
                  className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-xs font-medium text-emerald-600 ring-1 ring-inset ring-emerald-500/30 disabled:opacity-60"
                >
                  Reconnect
                </button>
              </div>
            </details>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
        {phase === "done" && (
          <p className="mt-3 text-xs text-emerald-600">
            Reconnected. The next cycle will repopulate Today P/L, marks and Greeks.
          </p>
        )}
      </div>
    </div>
  );
}
