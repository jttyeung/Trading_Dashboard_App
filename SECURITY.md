# Security Policy

This is a personal, self-hosted project. By design it is **read-only** toward
your brokerage and keeps every secret on your own machine — see the "Security
notes" in the README. The app can only *write* into the bridge; it never reads
the bridge's credential files back.

## Public deployments (demo mode) must use synthetic data only

This app is sometimes deployed to a public host (e.g. Vercel) to demo its
features — never to expose real account data. Any such deployment **must**
have `NEXT_PUBLIC_DEMO_MODE=1` set, which (see `lib/demo.ts`) pins every
screen to the bundled synthetic fixtures in `lib/example.ts` and blocks
every write endpoint. `data/*.json` (real account data) and every `.env*`
file are gitignored and never bundled into a build regardless, so a public
deployment built from this repo has no real data reachable even before the
demo flag is considered — but the flag is still required for a complete,
non-empty demo experience.

**Every new data loader must follow this pattern from the start.** Each
`lib/*.ts` file that reads `data/*.json` (e.g. `lib/portfolio-risk.ts`,
`lib/csp-candidates.ts`) must check `isExampleMode()` (from
`lib/example-mode.ts`) *first* and return a matching hand-written fixture
from `lib/example.ts` before ever attempting the real file read. This was
caught as a real gap, not a hypothetical one: six screens added in one
session (Portfolio Risk, the alerts panel, all three Candidates tabs, and
the Suggestion Scorecard) initially skipped this check and would have shown
real account labels, real dollar figures, and real live-scored option
candidates on a public demo build. Before calling any new feature demo-safe,
verify live (curl or a browser, with `NEXT_PUBLIC_DEMO_MODE=1` set) that it
actually renders synthetic output — a compiling loader is not the same as a
gated one.

## Reporting a vulnerability

If you find a security issue — especially anything that could expose
credentials, the OAuth token, or brokerage data — please report it **privately**
rather than opening a public issue.

- Preferred: this repository's **Security** tab → **Report a vulnerability**
  (GitHub private vulnerability reporting).

Please include clear steps to reproduce and the affected file(s). I'll
acknowledge and address confirmed issues as time allows.

This is a hobby project provided **as is, without warranty** (see
[LICENSE](LICENSE.md)). Nothing here is financial advice.
