import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Stamps the current pathname onto a request header so the root layout
// (a Server Component, no useRouter/usePathname available) can tell
// whether to render the mobile phone-frame chrome or not — specifically,
// /desktop skips it entirely. Everything else about the request passes
// through unchanged.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}
