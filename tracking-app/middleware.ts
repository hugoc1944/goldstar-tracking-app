// middleware.ts (root of the app)
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Only protect /admin/*
export const config = {
  matcher: ['/admin/:path*'],
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow the login page itself
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // Allow Next assets & static files without auth checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api') // let API routes run on their own
  ) {
    return NextResponse.next()
  }

  // Read the NextAuth JWT on Edge (no prisma, no Node APIs)
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
