// lib/auth-helpers.ts
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { getToken } from 'next-auth/jwt';

/**
 * For default (Node) API routes and server components.
 * Returns { id, email } of the logged-in admin or throws 401.
 */
export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    // Not logged in → stop request here
    throw new Response('Unauthorized', { status: 401 });
  }
  // If you ever add more roles:
  // if (session.user.role !== 'admin') throw new Response('Forbidden', { status: 403 });

  return { id: session.user.id, email: session.user.email };
}

/**
 * For Edge runtime routes (e.g. when you set `export const runtime = 'edge'`).
 * getServerSession() is not available on edge, so we read the JWT directly.
 */
export async function requireAdminFromRequestEdge(req: Request) {
  const token = await getToken({
    // `getToken` expects a NextRequest/NextApiRequest-ish object; this cast is fine.
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub || !token.email) {
    throw new Response('Unauthorized', { status: 401 });
  }
  // Optional role check:
  // if ((token as any).role !== 'admin') throw new Response('Forbidden', { status: 403 });

  return { id: token.sub as string, email: token.email as string };
}
