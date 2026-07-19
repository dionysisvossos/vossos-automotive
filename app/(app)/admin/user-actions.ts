"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) != null;
}
function role(fd: FormData): UserRole {
  const v = str(fd, "role");
  return (Object.values(UserRole) as string[]).includes(v)
    ? (v as UserRole)
    : UserRole.EMPLOYEE;
}

export async function createUser(fd: FormData) {
  await requireAdmin();
  const fullName = str(fd, "fullName");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!fullName || !email) throw new Error("Όνομα και email είναι υποχρεωτικά");
  if (password.length < 6) throw new Error("Ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες");

  let created;
  try {
    created = await prisma.user.create({
      data: {
        fullName,
        email,
        role: role(fd),
        passwordHash: await bcrypt.hash(password, 10),
        active: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect("/admin/users?error=email");
    }
    throw e;
  }
  revalidatePath("/admin/users");
  redirect(`/admin/users/${created.id}`);
}

export async function updateUser(fd: FormData) {
  const session = await requireAdmin();
  const id = str(fd, "id");
  const newRole = role(fd);
  const active = bool(fd, "active");

  // Προστασία από αυτο-κλείδωμα: ο admin δεν αφαιρεί δικαιώματα/δεν
  // απενεργοποιεί τον εαυτό του.
  if (id === session.user.id && (newRole !== UserRole.ADMIN || !active)) {
    redirect(`/admin/users/${id}?error=self`);
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        fullName: str(fd, "fullName"),
        email: str(fd, "email").toLowerCase(),
        role: newRole,
        active,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`/admin/users/${id}?error=email`);
    }
    throw e;
  }
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}

export async function resetUserPassword(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const password = str(fd, "password");
  if (password.length < 6) {
    redirect(`/admin/users/${id}?error=pass`);
  }
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  redirect(`/admin/users/${id}?ok=pass`);
}

// Απενεργοποίηση 2FA (ανάκτηση από τον admin).
export async function disableTwoFactor(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  await prisma.user.update({
    where: { id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  revalidatePath(`/admin/users/${id}`);
}
