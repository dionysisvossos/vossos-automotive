"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateSecret, verifyToken } from "@/lib/totp";

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}

async function currentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Απαιτείται σύνδεση");
  return session.user.id;
}

// Ξεκινά το setup: παράγει μυστικό (χωρίς ενεργοποίηση ακόμη).
export async function startTwoFactorSetup() {
  const id = await currentUserId();
  await prisma.user.update({
    where: { id },
    data: { twoFactorSecret: generateSecret(), twoFactorEnabled: false },
  });
  revalidatePath("/profile");
}

// Επιβεβαίωση με κωδικό από την εφαρμογή → ενεργοποίηση.
export async function confirmTwoFactor(fd: FormData) {
  const id = await currentUserId();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.twoFactorSecret) redirect("/profile?error=nostart");
  if (!(await verifyToken(str(fd, "otp"), user.twoFactorSecret))) {
    redirect("/profile?error=code");
  }
  await prisma.user.update({
    where: { id },
    data: { twoFactorEnabled: true },
  });
  redirect("/profile?ok=enabled");
}

// Ακύρωση setup (πριν την επιβεβαίωση).
export async function cancelTwoFactorSetup() {
  const id = await currentUserId();
  await prisma.user.update({
    where: { id },
    data: { twoFactorSecret: null, twoFactorEnabled: false },
  });
  revalidatePath("/profile");
}

// Απενεργοποίηση — απαιτείται έγκυρος τρέχων κωδικός.
export async function disableOwnTwoFactor(fd: FormData) {
  const id = await currentUserId();
  const user = await prisma.user.findUnique({ where: { id } });
  if (user?.twoFactorEnabled && user.twoFactorSecret) {
    if (!(await verifyToken(str(fd, "otp"), user.twoFactorSecret))) {
      redirect("/profile?error=code");
    }
  }
  await prisma.user.update({
    where: { id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  redirect("/profile?ok=disabled");
}
