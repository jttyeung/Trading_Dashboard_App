# ─────────────────────────────────────────────────────────────────────────────
#  Trading dashboard — Next.js 16 production build
#  Commit as:  Trading_Dashboard_App/Dockerfile
#
#  Unlike the bridge, the dashboard's source IS baked in: Next has to compile,
#  and compiling on every container start would cost minutes on a Pi. Updating
#  the dashboard is therefore:
#
#      git pull && docker compose up -d --build dashboard
#
#  Built deliberately WITHOUT `output: "standalone"` so this works against the
#  repo exactly as it stands today, with no change to next.config.ts. See the
#  note at the bottom for the smaller-image version once you're green.
# ─────────────────────────────────────────────────────────────────────────────

# ---- deps ----------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` needs the lockfile to match package.json exactly. If this fails,
# run `npm install` locally and commit the updated package-lock.json.
RUN npm ci

# ---- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# data/ is gitignored and .dockerignore'd, but make sure the build never sees a
# stale snapshot: the app falls back to lib/example.ts when data/ is empty,
# which is exactly the first-run experience we want.
RUN rm -rf data && mkdir -p data \
 && npm run build

# ---- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY --from=build /app/public       ./public
COPY package.json next.config.ts ./

# data/ and /bridge are bind-mounted by compose at runtime. Creating the
# mountpoints here keeps ownership sane when they're mounted.
# Owned by uid/gid 1000 (the image's `node` user) because compose runs the
# container as your user, and Next writes .next/cache at runtime. The two
# mountpoints take the host's ownership once mounted.
RUN mkdir -p /app/data /bridge \
 && chown -R 1000:1000 /app /bridge

EXPOSE 3000

# -H 0.0.0.0 so the container is reachable from your LAN and over Tailscale.
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]

# ─────────────────────────────────────────────────────────────────────────────
#  Optional, once the build is green: add
#
#      output: "standalone",
#
#  to next.config.ts, then replace the runtime stage's three COPY lines with:
#
#      COPY --from=build /app/.next/standalone ./
#      COPY --from=build /app/.next/static     ./.next/static
#      COPY --from=build /app/public           ./public
#      CMD ["node", "server.js"]
#
#  That drops the image from roughly 1.2 GB to under 250 MB, which matters on a
#  32 GB SD card. Do it as a second step, not a first one — it changes how the
#  app is started and is easier to debug once you know the plain build works.
# ─────────────────────────────────────────────────────────────────────────────
