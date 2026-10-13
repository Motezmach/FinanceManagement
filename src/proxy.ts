import { NextResponse, type NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decryptSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!session) {
    if (isPublic) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session.mustChangePassword && pathname !== "/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Signed in: keep away from the login page and the root.
  // /change-password is deliberately not redirected here: the page itself checks the
  // database and sends users on if no change is needed, so a stale cookie can never loop.
  if (isPublic || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
