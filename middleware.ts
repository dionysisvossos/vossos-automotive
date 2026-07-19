import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Προστατεύει τα πάντα εκτός από static assets & το NextAuth API.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
