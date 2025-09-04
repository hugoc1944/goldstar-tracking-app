import NextAuth, { type NextAuthOptions } from 'next-auth';
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export const runtime = 'nodejs'; 

const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' }, // or 'database' if that’s your choice
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/admin/login',
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // find admin user
        const user = await prisma.adminUser.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;

        // compare password with stored hash
        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        // return minimal user object for session/jwt
        return {
          id: user.id,
          email: user.email,
          name: user.email.split("@")[0], // or user.name if you add a field
          role: user.role,
        };
      },
    }),
  ],
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
