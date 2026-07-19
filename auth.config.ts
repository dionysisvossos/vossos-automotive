import type { NextAuthConfig } from "next-auth";

// Edge-safe config — χωρίς Prisma/bcrypt, το χρησιμοποιεί το middleware.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        // Ήδη συνδεδεμένος; πήγαινέ τον στις υποθέσεις.
        if (isLoggedIn) return Response.redirect(new URL("/cases", nextUrl));
        return true;
      }
      // Όλα τα υπόλοιπα routes θέλουν login.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
