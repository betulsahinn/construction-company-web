import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE } from "@/lib/i18n";

const COOKIE_NAME = "admin_session";

async function verifyToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const valid = token ? await verifyToken(token) : false;

    if (!valid) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/admin/login") {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const valid = token ? await verifyToken(token) : false;
    if (valid) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  const response = NextResponse.next();
  if (!pathname.startsWith("/admin")) {
    const language = request.cookies.get(LANGUAGE_COOKIE)?.value;
    if (language !== "en" && language !== "tr") {
      response.cookies.set(LANGUAGE_COOKIE, DEFAULT_LANGUAGE, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
      });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
