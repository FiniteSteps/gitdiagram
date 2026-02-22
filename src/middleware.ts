import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware – protects the /admin routes.
 *
 * Authentication is a simple shared-secret check via the `ADMIN_SECRET` env var.
 * The secret can be presented in any of these ways (checked in order):
 *   1. `x-admin-secret` request header
 *   2. `admin_secret` cookie
 *   3. `secret` query parameter (auto-sets cookie then strips from URL)
 *
 * If the secret is missing or wrong the middleware returns 401.
 */

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Gate /admin pages and /api/admin/* routes
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) {
    // If ADMIN_SECRET is not configured, block all admin access in production
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Admin access is not configured.", {
        status: 503,
      });
    }
    // In development, allow access without a secret for convenience
    return NextResponse.next();
  }

  // 1. Header
  const headerSecret = request.headers.get("x-admin-secret");
  if (headerSecret === expectedSecret) {
    return NextResponse.next();
  }

  // 2. Cookie
  const cookieSecret = request.cookies.get("admin_secret")?.value;
  if (cookieSecret === expectedSecret) {
    return NextResponse.next();
  }

  // 3. Query parameter – set cookie and redirect to clean URL
  const querySecret = searchParams.get("secret");
  if (querySecret === expectedSecret) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("secret");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set("admin_secret", expectedSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/admin",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  }

  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
