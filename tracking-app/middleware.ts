import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// OPTIONAL: if you use next-auth middleware, prefer that instead of custom logic.
// export { auth as middleware } from '@/lib/auth';
// export const config = { matcher: ['/admin/:path*'] };

export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    // allow public/auth routes to pass
    if (
      pathname.startsWith('/api/auth') ||
      pathname === '/admin/login' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/brand') ||
      pathname === '/'
    ) {
      return NextResponse.next();
    }

    // If you gate /admin here, only do light checks;
    // DO NOT call Prisma or server-only code in middleware.
    if (pathname.startsWith('/admin')) {
      // Example: read a cookie set by next-auth; don’t import next-auth server here.
      // If you need full session, use next-auth's official middleware instead.
      return NextResponse.next();
    }

    return NextResponse.next();
  } catch (err) {
    // Never let the middleware crash
    console.error('middleware error:', err);
    return NextResponse.next();
  }
}

// Limit what the middleware runs on
export const config = {
  matcher: ['/((?!_next|favicon.ico|brand).*)'],
};
