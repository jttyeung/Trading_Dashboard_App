// Client-side calls into OptionsEvaluator's small auth API
// (internal/authapi) -- the browser equivalent of `optionseval-cli auth`,
// so a Schwab re-authorization can be done from a phone over Tailscale
// instead of only at a desktop terminal.
//
// Host is derived from window.location at call time for the same reason
// lib/chart-api.ts's own chartAPIBase does: a fetch made by the PHONE's
// browser resolves "localhost" to the phone itself, which has nothing
// listening. Whatever host served this page is also where the daemon is.
function authAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8094";
  return `http://${window.location.hostname}:8094`;
}

export interface AuthStatus {
  connected: boolean;
  detail: string;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${authAPIBase()}/auth/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`auth status failed: ${res.status}`);
  return res.json();
}

// startAuth returns Schwab's own login URL. It carries the (public)
// client ID and redirect URI only -- never the client secret.
export async function startAuth(): Promise<string> {
  const res = await fetch(`${authAPIBase()}/auth/start`, { method: "POST" });
  if (!res.ok) throw new Error(`auth start failed: ${res.status}`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

// completeAuth hands the post-login redirect URL (carrying a one-time
// code) to the daemon, which exchanges it and saves the session to the
// OS keychain. The code never touches this app's own storage or logs.
export async function completeAuth(redirectUrl: string): Promise<void> {
  const res = await fetch(`${authAPIBase()}/auth/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirectUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || "Could not complete the Schwab connection.");
  }
}
