import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Προστατεύει τα πάντα εκτός από: το NextAuth API, τα _next assets, και
  // στατικά αρχεία (εικόνες/λογότυπο/favicon) — αλλιώς το middleware θα έκανε
  // redirect στο /login και οι δημόσιες εικόνες (π.χ. /logo.png στη σελίδα
  // σύνδεσης) δεν θα φόρτωναν.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)",
  ],
};
