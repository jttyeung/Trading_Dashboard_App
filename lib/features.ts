// Feature switches. Each is off unless the environment says otherwise, so a
// release never surprises anyone; flip one on by adding the variable to the
// stack's .env (compose passes it to the dashboard) and restarting.
//
//   WHEEL_CAMPAIGNS=1   the wheel-campaign view (Options page preview and
//                       /options/wheel). Parked 2026-10-01; the code stays.
export const WHEEL_CAMPAIGNS = (process.env.WHEEL_CAMPAIGNS || "").trim() === "1";
