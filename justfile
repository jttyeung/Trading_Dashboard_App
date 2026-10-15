# OptionsDashboard -- deploy shortcuts. The Pi build/rsync recipe lives in
# OptionsEvaluator (it owns the Pi paths and the daemon), so these call into
# the sibling repo's justfile.
pi_host := env_var_or_default("PI_HOST", "pi")

default:
    @just --list

# Build for the Pi (standalone) and ship it, then do a plain local build last:
# `next start` refuses a standalone .next, so this leaves the Mac startable.
# `sudo -v` first because the Pi restart needs sudo with no tty inside ssh.
# The Pi build refuses to run unless this repo is on staging.

# Build here, then deploy the dashboard to the Pi
deploy:
    ssh -t {{pi_host}} sudo -v
    just --justfile ../OptionsEvaluator/justfile deploy-pi-dashboard
    rm -rf .next && npm run build

# Deploy every app to the Pi, in dependency order: gateway, 0DTE trader, then
# OptionsEvaluator (daemon + dashboard). Identical in all four repos so it can
# be run from any of them; each app deploys through its own justfile.

# Deploy all apps to the Pi
deploy-all:
    ssh -t {{pi_host}} sudo -v
    just --justfile ../options-api-gateway/justfile deploy
    just --justfile ../0dte-spx-trader/justfile deploy
    just --justfile ../OptionsEvaluator/justfile deploy
