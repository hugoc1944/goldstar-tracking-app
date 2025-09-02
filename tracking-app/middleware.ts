// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isLogin = pathname.startsWith("/admin/login");

  if (!isAdminArea) return NextResponse.next();

  // Read NextAuth session (JWT) at the edge
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Block access to /admin/* when not logged in (except the login page)
  if (!token && !isLogin) {
    const url = new URL("/admin/login", req.url);
    // preserve target so we can come back after login
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  // If already authenticated and visiting /admin/login, send to /admin
  if (token && isLogin) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

// Apply only to /admin/*
export const config = { matcher: ["/admin/:path*"] };
