// middleware.ts  (Edge-safe)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Protect only admin pages, but allow the login page itself.
export const config = {
  matcher: ['/admin/:path*'],
};

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow the login page through the middleware
  if (pathname === '/admin/login') return NextResponse.next();

  // Read session token using the Edge-compatible helper
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) return NextResponse.next();

  // Not authenticated → redirect to /admin/login and preserve "from"
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('from', pathname + search);
  return NextResponse.redirect(url);
}
