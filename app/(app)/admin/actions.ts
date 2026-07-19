"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, CaseCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) != null;
}
function category(fd: FormData): CaseCategory {
  const v = str(fd, "category");
  return (Object.values(CaseCategory) as string[]).includes(v)
    ? (v as CaseCategory)
    : CaseCategory.OTHER;
}

// ── Τύποι υποθέσεων ────────────────────────────────────────────

export async function createCaseType(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) throw new Error("Το όνομα είναι υποχρεωτικό");

  const created = await prisma.caseType.create({
    data: {
      name,
      description: str(fd, "description") || null,
      category: category(fd),
      requiresVehicle: bool(fd, "requiresVehicle"),
      isFreeform: bool(fd, "isFreeform"),
      hasLicenseFee: bool(fd, "hasLicenseFee"),
      hasCirculationTax: bool(fd, "hasCirculationTax"),
      hasTransferFee: bool(fd, "hasTransferFee"),
      issuesPlates: bool(fd, "issuesPlates"),
      supportsImport: bool(fd, "supportsImport"),
    },
  });
  revalidatePath("/admin/case-types");
  redirect(`/admin/case-types/${created.id}`);
}

export async function updateCaseType(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  await prisma.caseType.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      description: str(fd, "description") || null,
      category: category(fd),
      requiresVehicle: bool(fd, "requiresVehicle"),
      isFreeform: bool(fd, "isFreeform"),
      active: bool(fd, "active"),
      hasLicenseFee: bool(fd, "hasLicenseFee"),
      hasCirculationTax: bool(fd, "hasCirculationTax"),
      hasTransferFee: bool(fd, "hasTransferFee"),
      issuesPlates: bool(fd, "issuesPlates"),
      supportsImport: bool(fd, "supportsImport"),
    },
  });
  revalidatePath(`/admin/case-types/${id}`);
  revalidatePath("/admin/case-types");
}

export async function deleteCaseType(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  try {
    await prisma.caseType.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      redirect("/admin/case-types?error=inuse");
    }
    throw e;
  }
  revalidatePath("/admin/case-types");
  redirect("/admin/case-types");
}

// ── Πρότυπα σταδίων ────────────────────────────────────────────

export async function addStage(fd: FormData) {
  await requireAdmin();
  const caseTypeId = str(fd, "caseTypeId");
  const name = str(fd, "name");
  if (!name) throw new Error("Το όνομα σταδίου είναι υποχρεωτικό");

  const last = await prisma.stageTemplate.findFirst({
    where: { caseTypeId },
    orderBy: { position: "desc" },
  });
  await prisma.stageTemplate.create({
    data: { caseTypeId, name, position: (last?.position ?? 0) + 1 },
  });
  revalidatePath(`/admin/case-types/${caseTypeId}`);
}

export async function renameStage(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const stage = await prisma.stageTemplate.update({
    where: { id },
    data: { name: str(fd, "name") },
  });
  revalidatePath(`/admin/case-types/${stage.caseTypeId}`);
}

export async function toggleStageTerminal(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const current = await prisma.stageTemplate.findUniqueOrThrow({ where: { id } });
  await prisma.stageTemplate.update({
    where: { id },
    data: { isTerminal: !current.isTerminal },
  });
  revalidatePath(`/admin/case-types/${current.caseTypeId}`);
}

export async function deleteStage(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const stage = await prisma.stageTemplate.delete({ where: { id } });
  revalidatePath(`/admin/case-types/${stage.caseTypeId}`);
}

export async function moveStage(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const dir = str(fd, "dir"); // "up" | "down"

  const stage = await prisma.stageTemplate.findUniqueOrThrow({ where: { id } });
  const sibling = await prisma.stageTemplate.findFirst({
    where: {
      caseTypeId: stage.caseTypeId,
      position:
        dir === "up" ? { lt: stage.position } : { gt: stage.position },
    },
    orderBy: { position: dir === "up" ? "desc" : "asc" },
  });
  if (!sibling) return;

  // Swap positions χωρίς να σπάσει το unique([caseTypeId, position]).
  await prisma.$transaction([
    prisma.stageTemplate.update({ where: { id: stage.id }, data: { position: -1 } }),
    prisma.stageTemplate.update({
      where: { id: sibling.id },
      data: { position: stage.position },
    }),
    prisma.stageTemplate.update({
      where: { id: stage.id },
      data: { position: sibling.position },
    }),
  ]);
  revalidatePath(`/admin/case-types/${stage.caseTypeId}`);
}

// ── Απαιτούμενα δικαιολογητικά ─────────────────────────────────

export async function addDocRequirement(fd: FormData) {
  await requireAdmin();
  const caseTypeId = str(fd, "caseTypeId");
  const name = str(fd, "name");
  if (!name) throw new Error("Το όνομα δικαιολογητικού είναι υποχρεωτικό");
  await prisma.docRequirement.create({
    data: { caseTypeId, name, mandatory: bool(fd, "mandatory") },
  });
  revalidatePath(`/admin/case-types/${caseTypeId}`);
}

export async function toggleDocMandatory(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const current = await prisma.docRequirement.findUniqueOrThrow({ where: { id } });
  await prisma.docRequirement.update({
    where: { id },
    data: { mandatory: !current.mandatory },
  });
  revalidatePath(`/admin/case-types/${current.caseTypeId}`);
}

export async function deleteDocRequirement(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const doc = await prisma.docRequirement.delete({ where: { id } });
  revalidatePath(`/admin/case-types/${doc.caseTypeId}`);
}

// ── Υπηρεσίες περιφέρειας ──────────────────────────────────────

export async function createRegionalService(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) throw new Error("Το όνομα είναι υποχρεωτικό");
  await prisma.regionalService.create({
    data: { name, region: str(fd, "region") || null },
  });
  revalidatePath("/admin/services");
}

export async function updateRegionalService(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  await prisma.regionalService.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      region: str(fd, "region") || null,
      active: bool(fd, "active"),
    },
  });
  revalidatePath("/admin/services");
}

export async function deleteRegionalService(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  try {
    await prisma.regionalService.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      redirect("/admin/services?error=inuse");
    }
    throw e;
  }
  revalidatePath("/admin/services");
}
