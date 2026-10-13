import { NextResponse, type NextRequest } from "next/server";
import {
  decryptSession,
  encryptSession,
  SESSION_COOKIE,
  SESSION_REFRESH_AFTER_SEC,
  sessionCookieOptions,
} from "@/lib/auth/session";

// Pages that work without a session. /login/verify is the 2FA step.
const PUBLIC_PATHS = ["/login", "/register"];
const IS_DEV = process.env.NODE_ENV === "development";

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    // Nonce + strict-dynamic: only scripts we emitted (and what they load) may run.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by Tailwind utilities, Recharts and animations.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${IS_DEV ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(IS_DEV ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function securityHeaders(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  if (!IS_DEV) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next.js reads the nonce from this request header and stamps its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    return securityHeaders(NextResponse.redirect(url), csp);
  };

  // /logout clears a cookie that is signed but no longer accepted; it must stay reachable.
  if (pathname === "/logout") return securityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);

  // Anonymous: only the public pages are reachable.
  if (!session) return isPublic ? securityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp) : redirectTo("/login");

  // Signed in: skip the auth pages and the root.
  if (isPublic || pathname === "/") return redirectTo("/dashboard");

  const response = securityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);

  // Sliding expiry: re-sign the cookie once it is a few hours old so active
  // users stay signed in, while abandoned sessions still expire.
  const ageSec = Math.floor(Date.now() / 1000) - session.issuedAt;
  if (ageSec > SESSION_REFRESH_AFTER_SEC) {
    const token = await encryptSession({ userId: session.userId, name: session.name, sv: session.sv });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  }

  return response;
}

export const config = {
  matcher: [
    {
      // Everything except Next internals and static assets; skip router prefetches.
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
