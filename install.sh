#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Portfolio Manager — one-line installer
#  Commit as:  Trading_Dashboard_App/install.sh
#
#  Usage (this is the whole install):
#
#    curl -fsSL https://raw.githubusercontent.com/justintimefordinner-lang/Trading_Dashboard_App/main/install.sh | bash
#
#  Downloads the compose file, writes a settings file, and starts the stack
#  from prebuilt images. Nothing is compiled. No repository is cloned.
#
#  Safe to re-run: it never overwrites an existing .env, and never touches
#  data/ or bridge-state/.
#
#  Knobs (environment variables, all optional):
#    PORTFOLIO_DIR        where to install        (default ~/portfolio-manager)
#    PORTFOLIO_REPO_RAW   where to fetch the compose file from — a fork, or a
#                         branch for testing      (default this repo's main)
#
#  The whole script is one function called on the last line, so a download
#  that is cut off part-way runs nothing at all.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

main() {
  local REPO_RAW DIR TZ_GUESS PORT
  REPO_RAW="${PORTFOLIO_REPO_RAW:-https://raw.githubusercontent.com/justintimefordinner-lang/Trading_Dashboard_App/main}"
  DIR="${PORTFOLIO_DIR:-$HOME/portfolio-manager}"

  # ── prerequisites ───────────────────────────────────────────────────────
  say "Checking Docker"

  command -v docker >/dev/null 2>&1 || die \
"Docker isn't installed.

  Raspberry Pi:     curl -fsSL https://get.docker.com | sh
                    sudo usermod -aG docker \$USER    (then log out and back in)
  Windows / Mac:    install Docker Desktop from docker.com

Then run this installer again."

  docker compose version >/dev/null 2>&1 || die \
"Docker is installed but Docker Compose v2 is missing.
On a Pi, 'curl -fsSL https://get.docker.com | sh' installs both."

  docker info >/dev/null 2>&1 || die \
"Docker is installed but not running, or your user can't reach it.

  Windows / Mac:    start Docker Desktop and wait for it to say Running.
  Raspberry Pi:     sudo usermod -aG docker \$USER, then log out and back in."

  # ── folders ─────────────────────────────────────────────────────────────
  say "Setting up $DIR"
  mkdir -p "$DIR/data" "$DIR/bridge-state/reauth_inbox" "$DIR/bridge-state/task_inbox"
  cd "$DIR"

  # ── compose file ────────────────────────────────────────────────────────
  say "Downloading the compose file"
  curl -fsSL "$REPO_RAW/docker-compose.release.yml" -o docker-compose.yml \
    || die "Couldn't download the compose file. Check your internet connection."

  # ── settings ────────────────────────────────────────────────────────────
  if [ -f .env ]; then
    say "Keeping your existing .env"
  else
    say "Writing settings (.env)"
    # Fall back sensibly on machines where these aren't available.
    TZ_GUESS="$( (timedatectl show -p Timezone --value 2>/dev/null) \
              || (readlink /etc/localtime 2>/dev/null | sed 's|.*/zoneinfo/||') \
              || true )"
    [ -n "${TZ_GUESS:-}" ] || TZ_GUESS="America/Denver"

    cat > .env <<ENV
# Portfolio Manager settings. No secrets live here — your Schwab App Key and
# Secret are entered on the dashboard's Settings page and stored in
# bridge-state/credentials.env, which only the bridge reads.

TZ=$TZ_GUESS

# Run the containers as you, so files they write stay editable from your shell.
UID=$(id -u)
GID=$(id -g)

# Change if something else already uses port 3000.
DASHBOARD_PORT=3000

# Pin to a released version instead of the newest build, e.g. IMAGE_TAG=v1.2.0
IMAGE_TAG=latest
ENV
  fi

  # ── start ───────────────────────────────────────────────────────────────
  say "Pulling images and starting (about a minute)"
  docker compose pull
  docker compose up -d

  # An existing .env may not have DASHBOARD_PORT at all; that's fine.
  PORT="$(grep -E '^DASHBOARD_PORT=' .env | cut -d= -f2 | tr -d '[:space:]' || true)"
  PORT="${PORT:-3000}"

  cat <<DONE

  ────────────────────────────────────────────────────────────
   Running.

   Open   http://localhost:$PORT

   The dashboard fills in with example data straight away. To see
   your own account, go to Settings and paste your Schwab App Key
   and Secret.

   Installed in:  $DIR
   Check on it:   cd $DIR && docker compose ps
   Read the logs: cd $DIR && docker compose logs -f
   Update later:  cd $DIR && docker compose pull && docker compose up -d
  ────────────────────────────────────────────────────────────

DONE

  if ! docker compose ps --status running --quiet | grep -q .; then
    warn "Containers aren't reporting as running yet. Give it a few seconds, then:
      cd $DIR && docker compose ps && docker compose logs"
  fi
}

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
warn() { printf '\n\033[1;33m!!\033[0m %s\n' "$1"; }
die()  { printf '\n\033[1;31mxx\033[0m %s\n\n' "$1" >&2; exit 1; }

main "$@"
