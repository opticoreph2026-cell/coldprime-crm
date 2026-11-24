import { NextResponse, NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Next.js 16 renamed the middleware file convention to `proxy` (Node.js runtime).
// This file is intentionally optimistic: it only checks for a session cookie and
// rate-limits credential sign-in. Authorization still runs in every route handler.

const publicPaths = ["/login", "/api/auth"];

const LOGIN_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit credential sign-in attempts by IP (shared store, all instances)
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const result = await checkRateLimit("login", clientIp(request), LOGIN_LIMIT);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
      );
    }
  }

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Vercel cron calls the reply-check endpoint with a Bearer secret, no session cookie
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (pathname === "/api/emails/check-replies" && cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("authjs.session-token")?.value
    || request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
