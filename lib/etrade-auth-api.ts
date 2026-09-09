// Client-side calls into OptionsEvaluator's small E*TRADE auth API
// (internal/etradeauthapi) -- the browser equivalent of
// `optionseval-cli etrade-authorize` / `etrade-callback`, needed daily
// since E*TRADE's own access token expires unconditionally at midnight
// ET with no refresh grant.
//
// Simpler than lib/auth-api.ts's Schwab flow: E*TRADE's OAuth1 request
// uses oauth_callback=oob (out-of-band), so there is no redirect URL,
// ever -- after logging in, E*TRADE displays a short verification code
// directly on the page, which is pasted back in as a plain string. No
// callbackFlow/autoComplete concept to mirror.
//
// Host is derived from window.location at call time for the same reason
// every other lib/*-api.ts does: a fetch made by the PHONE's browser
// resolves "localhost" to the phone itself, which has nothing listening.
function etradeAuthAPIBase(): string {
  if (typeof window === "undefined") return "http://localhost:8096";
  return `http://${window.location.hostname}:8096`;
}

export interface ETradeAuthStatus {
  connected: boolean;
  // False means this integration isn't set up in the app at all (no
  // consumer key/secret configured) -- a different case from
  // "configured but not connected," which the dashboard should render
  // as a quiet note rather than an actionable reconnect button.
  configured: boolean;
  detail: string;
}

export async function fetchETradeAuthStatus(): Promise<ETradeAuthStatus> {
  const res = await fetch(`${etradeAuthAPIBase()}/etrade-auth/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`etrade auth status failed: ${res.status}`);
  return res.json();
}

export interface ETradeAuthStart {
  url: string;
}

// startETradeAuth returns E*TRADE's own login URL. It carries the
// (public) consumer key and a request token only -- never the consumer
// secret.
export async function startETradeAuth(): Promise<ETradeAuthStart> {
  const res = await fetch(`${etradeAuthAPIBase()}/etrade-auth/start`, { method: "POST" });
  if (!res.ok) throw new Error(`etrade auth start failed: ${res.status}`);
  return res.json();
}

// completeETradeAuth hands the verification code E*TRADE displayed after
// login to the daemon, which exchanges it and saves the session to the
// OS keychain. The code never touches this app's own storage or logs.
export async function completeETradeAuth(verifier: string): Promise<void> {
  const res = await fetch(`${etradeAuthAPIBase()}/etrade-auth/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verifier }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || data.ok !== true) {
    throw new Error(data.error || "Could not complete the E*TRADE connection.");
  }
}
