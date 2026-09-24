import { NextResponse, NextRequest } from "next/server";

const publicPaths = ["/login", "/api/auth"];

// Simple in-memory login rate limit (per serverless instance — best-effort).
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (loginAttempts.size > 10000) loginAttempts.clear();
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate-limit credential sign-in attempts by IP
  if (pathname === "/api/auth/callback/credentials" && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    if (isLoginRateLimited(ip)) {
      return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
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
