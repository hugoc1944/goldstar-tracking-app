// middleware.ts (Edge-safe)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  // never block the login page
  if (nextUrl.pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // protect /admin/*
  if (nextUrl.pathname.startsWith('/admin')) {
    // Example: if you set a cookie like `auth=true` after login
    const hasSession = cookies.get('next-auth.session-token') || cookies.get('__Secure-next-auth.session-token');
    if (!hasSession) {
      const url = new URL('/admin/login', nextUrl);
      url.searchParams.set('next', nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
