"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/auth-guard";

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}

// Σημαδεύει το στάδιο (DONE/SKIPPED) εντός transaction και προχωράει στο
// επόμενο· αν δεν υπάρχει επόμενο, ολοκληρώνει την υπόθεση.
async function advanceInTx(
  tx: Prisma.TransactionClient,
  caseId: string,
  stage: { id: string; position: number },
  newState: "DONE" | "SKIPPED",
  userId: string,
) {
  await tx.caseStage.update({
    where: { id: stage.id },
    data: { state: newState, completedById: userId, completedAt: new Date() },
  });

  const next = await tx.caseStage.findFirst({
    where: {
      caseId,
      position: { gt: stage.position },
      state: { in: ["PENDING", "IN_PROGRESS"] },
    },
    orderBy: { position: "asc" },
  });

  if (next) {
    await tx.caseStage.update({
      where: { id: next.id },
      data: { state: "IN_PROGRESS" },
    });
    await tx.case.update({
      where: { id: caseId },
      data: { currentStageId: next.id, state: "OPEN", closedAt: null },
    });
  } else {
    await tx.case.update({
      where: { id: caseId },
      data: { currentStageId: null, state: "COMPLETED", closedAt: new Date() },
    });
  }
}

async function markAndAdvance(
  caseId: string,
  stageId: string,
  newState: "DONE" | "SKIPPED",
  userId: string,
) {
  const stage = await prisma.caseStage.findUnique({ where: { id: stageId } });
  if (!stage || stage.caseId !== caseId) throw new Error("Άκυρο στάδιο");
  await prisma.$transaction((tx) =>
    advanceInTx(tx, caseId, stage, newState, userId),
  );
  revalidatePath(`/cases/${caseId}`);
}

// Πλήρης φάκελος: σημαδεύει όλα τα δικαιολογητικά ως παραληφθέντα και
// προχωράει το τρέχον στάδιο (ένα κλικ).
export async function markFileComplete(fd: FormData) {
  const session = await requireOperator();
  const caseId = str(fd, "caseId");
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: { currentStageId: true },
  });
  if (!c) throw new Error("Η υπόθεση δεν βρέθηκε");

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: { documentsComplete: true },
    });
    if (c.currentStageId) {
      const stage = await tx.caseStage.findUnique({
        where: { id: c.currentStageId },
      });
      if (stage) {
        await advanceInTx(tx, caseId, stage, "DONE", session.user.id);
      }
    }
  });

  revalidatePath(`/cases/${caseId}`);
}

// Αναίρεση πλήρους φακέλου (δεν επαναφέρει το στάδιο).
export async function unmarkFileComplete(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  await prisma.case.update({
    where: { id: caseId },
    data: { documentsComplete: false },
  });
  revalidatePath(`/cases/${caseId}`);
}

// Πού παραδίδεται η υπόθεση.
export async function setDelivery(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  await prisma.case.update({
    where: { id: caseId },
    data: { delivery: str(fd, "delivery") || null },
  });
  revalidatePath(`/cases/${caseId}`);
}

// Toggle «Εισαγωγή από εξωτερικό» — εμφανίζει τα επιπλέον δικαιολογητικά.
export async function setImport(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  await prisma.case.update({
    where: { id: caseId },
    data: { isImport: str(fd, "value") === "1" },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function completeStage(fd: FormData) {
  const session = await requireOperator();
  await markAndAdvance(str(fd, "caseId"), str(fd, "stageId"), "DONE", session.user.id);
}

export async function skipStage(fd: FormData) {
  const session = await requireOperator();
  await markAndAdvance(str(fd, "caseId"), str(fd, "stageId"), "SKIPPED", session.user.id);
}

// Επαναφέρει ένα στάδιο ως τρέχον και μηδενίζει τα επόμενα (PENDING).
export async function reopenStage(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  const stageId = str(fd, "stageId");
  const stage = await prisma.caseStage.findUnique({ where: { id: stageId } });
  if (!stage || stage.caseId !== caseId) throw new Error("Άκυρο στάδιο");

  await prisma.$transaction(async (tx) => {
    await tx.caseStage.update({
      where: { id: stageId },
      data: { state: "IN_PROGRESS", completedById: null, completedAt: null },
    });
    await tx.caseStage.updateMany({
      where: { caseId, position: { gt: stage.position } },
      data: { state: "PENDING", completedById: null, completedAt: null },
    });
    await tx.case.update({
      where: { id: caseId },
      data: { currentStageId: stageId, state: "OPEN", closedAt: null },
    });
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function cancelCase(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  await prisma.case.update({
    where: { id: caseId },
    data: { state: "CANCELLED", closedAt: new Date() },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function reopenCase(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  await prisma.case.update({
    where: { id: caseId },
    data: { state: "OPEN", closedAt: null },
  });
  revalidatePath(`/cases/${caseId}`);
}
