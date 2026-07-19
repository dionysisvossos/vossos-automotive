import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/totp";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Κωδικός", type: "password" },
        otp: { label: "Κωδικός 2FA", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, otp } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Βήμα 2FA: αν είναι ενεργό, απαιτείται έγκυρος κωδικός OTP.
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!otp || !(await verifyToken(otp, user.twoFactorSecret))) {
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
