import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, TWO_FACTOR_COOKIE } from "@/lib/auth/session";

/**
 * Clears auth cookies and returns to the sign-in page. Used when a cookie is
 * still validly signed but no longer accepted (revoked session, deleted
 * account), which server components cannot clear themselves.
 */
export async function GET(request: NextRequest) {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(TWO_FACTOR_COOKIE);
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
