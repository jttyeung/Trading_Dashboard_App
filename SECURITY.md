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

**`vercel deploy` uploads the local checkout, not the git tree.** The CLI
does not apply `.gitignore` the way git does: the `/data/*` + `!/data/.gitkeep`
pair let the entire real `data/` folder ride along as deployment source on
every deploy before 2026-09-11 (confirmed through the deployment files API,
`vercel api /v6/deployments/<id>/files`, not inferred). The demo flag meant
none of it was ever rendered, but real account data was still sitting on a
third-party host. `.vercelignore` now lists `data/` and `.env*` explicitly,
with no negation patterns. After any deploy, the check is the files API, not
the rendered page: a page that shows fixtures says nothing about what was
uploaded.

## Account numbers and secrets

**This repository is public.** Anything committed here, including in a
branch that was later deleted or a commit that was later amended, should be
treated as published.

- **The dashboard only ever sees opaque account ids** (`acct-` followed by
  hex). The evaluator derives them with a keyed HMAC, so an id can't be
  turned back into an account number without a key that never leaves the
  evaluator's machine. Treat an id as a key, never as something to parse,
  shorten or derive digits from. Show the account holder's own label
  instead.
- **Never show or store any digits of a real account number.** No "last 4"
  or `••••1234` display: a partial number still cuts the search to about a
  thousand guesses. The broker's own masked form counts as real digits
  too.
- **Never put real account data in the repo.** No real numbers or digits
  of one, real labels, real balances or real trades, in fixtures
  (`lib/example.ts`), tests, comments or commit messages. Use obviously
  fake values (`acct-demo01`, `12345678`). Once pushed, a value stays
  readable in git history, and in every fork and clone, until the history
  is rewritten everywhere.
- **Secrets stay in `.env*` on your machine.** Never in code, fixtures,
  logs, URLs or a third-party host's environment unless that host needs
  it. Never print one to check it: compare hashes or lengths instead.
- **Before pushing,** scan what you're adding, not just what you meant to
  change: `git diff --cached` for data, and gitleaks for credentials.
  gitleaks can't tell a real account number from a fake one, so that part
  is on the author.

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
