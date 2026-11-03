import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The wide views moved under /desktop (2026-11-03). Old URLs still land in
  // the right place, so bookmarks and old notification taps keep working.
  // Temporary, not permanent: a browser must not cache them forever.
  async redirects() {
    return [
      { source: "/overview", destination: "/desktop", permanent: false },
      { source: "/bot", destination: "/desktop/bot", permanent: false },
      { source: "/bot-20-delta-safe", destination: "/desktop/bot-20-delta-safe", permanent: false },
      { source: "/bot-aggressive", destination: "/desktop/bot-aggressive", permanent: false },
    ];
  },
  // Standalone output ONLY for the Pi build, which runs `node server.js`
  // out of the rsynced .next/standalone tree (OptionsEvaluator's
  // `just deploy-pi-dashboard` sets this; deploy/optionsdashboard.service
  // is the unit). Next refuses to run `next start` against a standalone
  // build, and the Mac's LaunchAgent starts the dashboard exactly that
  // way -- with it set unconditionally, _global-error couldn't resolve
  // its chunk, so any SSR crash rendered a bare 500 instead of the error
  // UI. One config, two hosts, two run modes: the Pi opts in.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // DEV-SERVER ONLY: origins allowed to load the dev runtime (HMR/RSC/assets).
  // Has no effect on the production server (`next start`), which serves any origin.
  // Add the addresses you use to reach the dev server from other devices (e.g.
  // your phone). Examples:
  //   "192.168.1.x",             // your machine's LAN IP
  //   "my-pc.tailXXXX.ts.net",   // a specific Tailscale MagicDNS host
  allowedDevOrigins: [
    "*.ts.net", // any Tailscale MagicDNS hostname
    // The wildcard above only matches MagicDNS hostnames, not a raw
    // Tailscale IP — confirmed live (`tailscale ip`) that browsing by IP
    // is exactly what silently broke all client-side interactivity over
    // Tailscale (the page renders from the initial HTML/CSS fine, but
    // the dev server blocks the JS chunks that attach onClick handlers,
    // since the request's Origin doesn't match any allowed pattern).
    // Raw IPs (this machine's own Tailscale IP) come from .env.local, so
    // no real address is ever committed: DEV_ALLOWED_ORIGINS=100.x.y.z,...
    ...(process.env.DEV_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  ],
};

export default nextConfig;
