// lib/auth.ts
import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcrypt';

export const authOptions: NextAuthOptions = {
  // 8 hours session (JWT strategy)
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },

  providers: [
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase();
        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        // Keep only what we need in the token
        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],

  pages: { signIn: '/admin/login' },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Persist id/role into the JWT
        token.sub = (user as any).id as string;
        (token as any).role = (user as any).role ?? 'admin';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub as string;
        (session.user as any).role = (token as any).role as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
