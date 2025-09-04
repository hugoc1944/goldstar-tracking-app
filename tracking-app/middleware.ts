// middleware.ts  (at the app root)
import { withAuth } from "next-auth/middleware";

// Protect only the admin area; everything else bypasses middleware.
export default withAuth({
  pages: { signIn: "/admin/login" },
});

export const config = {
  matcher: ["/admin/:path*"], // <- do NOT match /, /favicon.*, /_next/*, APIs, etc.
};
