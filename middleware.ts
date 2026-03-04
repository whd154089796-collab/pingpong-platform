import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "ustc_tta_session";
const PUBLIC_PATH_PREFIXES = ["/auth", "/api/csrf-token"];
const PUBLIC_FILE = /\.(.*)$/; // Allows static assets (e.g. images, fonts)

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip Next.js internals and static assets early.
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // Allow auth and CSRF endpoints for unauthenticated visitors.
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Apply middleware to all routes except Next internals and static files.
export const config = {
  matcher: ["/(.*)"],
};