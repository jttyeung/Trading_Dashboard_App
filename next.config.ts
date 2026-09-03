import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    "100.125.231.78", // this machine's own Tailscale IP
  ],
};

export default nextConfig;
