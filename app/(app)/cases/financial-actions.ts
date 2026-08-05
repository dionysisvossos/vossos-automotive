"use server";

import { revalidatePath } from "next/cache";
import { ExpenseType, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOperator } from "@/lib/auth-guard";
import {
  licenseFee,
  transferFee,
  circulationTax,
  BANK_COMMISSION,
} from "@/lib/vehicle-tax";

function str(fd: FormData, key: string): string {
  return (fd.get(key)?.toString() ?? "").trim();
}

// Δέχεται "12,50" ή "12.50" → number· null αν άκυρο/μη θετικό.
function amount(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function enumVal<T extends Record<string, string>>(
  e: T,
  v: string,
  fallback: T[keyof T],
): T[keyof T] {
  return (Object.values(e) as string[]).includes(v)
    ? (v as T[keyof T])
    : fallback;
}

// Ποσό ≥ 0 ή null (κενό/άκυρο). Δέχεται "12,50" ή "12.50".
function decOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export async function setFee(fd: FormData) {
  await requireOperator();
  const caseId = str(fd, "caseId");
  // Ενημερώνει μόνο τα πεδία που υποβλήθηκαν (fee / urgentFee / plateFee).
  const data: Record<string, number | null> = {};
  if (fd.has("fee")) data.fee = decOrNull(fd, "fee");
  if (fd.has("urgentFee")) data.urgentFee = decOrNull(fd, "urgentFee");
  if (fd.has("plateFee")) data.plateFee = decOrNull(fd, "plateFee");
  await prisma.case.update({ where: { id: caseId }, data });
  revalidatePath(`/cases/${caseId}`);
}

export async function addExpense(fd: FormData) {
  const session = await requireOperator();
  const caseId = str(fd, "caseId");
  const amt = amount(fd, "amount");
  if (!amt) throw new Error("Μη έγκυρο ποσό εξόδου");

  await prisma.caseExpense.create({
    data: {
      caseId,
      type: enumVal(ExpenseType, str(fd, "type"), ExpenseType.OTHER),
      description: str(fd, "description") || null,
      amount: amt,
      createdById: session.user.id,
    },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteExpense(fd: FormData) {
  await requireOperator();
  const id = str(fd, "id");
  const exp = await prisma.caseExpense.delete({ where: { id } });
  revalidatePath(`/cases/${exp.caseId}`);
}

export async function addPayment(fd: FormData) {
  const session = await requireOperator();
  const caseId = str(fd, "caseId");
  const amt = amount(fd, "amount");
  if (!amt) throw new Error("Μη έγκυρο ποσό είσπραξης");

  await prisma.casePayment.create({
    data: {
      caseId,
      amount: amt,
      method: enumVal(PaymentMethod, str(fd, "method"), PaymentMethod.CASH),
      note: str(fd, "note") || null,
      createdById: session.user.id,
    },
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deletePayment(fd: FormData) {
  await requireOperator();
  const id = str(fd, "id");
  const pay = await prisma.casePayment.delete({ where: { id } });
  revalidatePath(`/cases/${pay.caseId}`);
}

// Προτεινόμενα έξοδα: πάγιο τέλος ταξινόμησης (75€) + τέλη κυκλοφορίας από
// ρύπους/κυβικά. Δεν διπλοεγγράφει (παραλείπει όσα υπάρχουν ήδη).
export async function addSuggestedExpenses(fd: FormData) {
  const session = await requireOperator();
  const caseId = str(fd, "caseId");

  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: { caseType: true, vehicle: true, expenses: true },
  });
  if (!c) throw new Error("Η υπόθεση δεν βρέθηκε");

  const existing = new Set(c.expenses.map((e) => e.description ?? ""));
  const toCreate: {
    caseId: string;
    type: ExpenseType;
    description: string;
    amount: number;
    createdById: string;
  }[] = [];

  const add = (type: ExpenseType, description: string, amount: number) => {
    if (amount > 0 && !existing.has(description)) {
      toCreate.push({
        caseId,
        type,
        description,
        amount,
        createdById: session.user.id,
      });
    }
  };

  const isMotorcycle = c.vehicle?.category === "MOTORCYCLE";

  // Τέλος άδειας (75€ / 9€ μοτο) + προμήθεια τράπεζας — ξεχωριστές γραμμές,
  // ώστε το «καθαρό» παράβολο να ξεχωρίζει στις αναφορές.
  if (c.caseType.hasLicenseFee) {
    add(ExpenseType.LICENSE, "Τέλος άδειας", licenseFee(isMotorcycle));
    add(ExpenseType.BANK, "Προμήθεια τράπεζας", BANK_COMMISSION);
  }

  // Τέλος μεταβίβασης (βάσει κυβικών) — στους τύπους με το flag.
  if (c.caseType.hasTransferFee && c.vehicle?.cc) {
    add(ExpenseType.TRANSFER, "Τέλος μεταβίβασης", transferFee(c.vehicle.cc));
  }

  // Τέλη κυκλοφορίας (ρύποι ή κυβικά) — στους τύπους με το flag.
  if (c.caseType.hasCirculationTax) {
    const circ = circulationTax(
      c.vehicle?.emissions ?? null,
      c.vehicle?.cc ?? null,
    );
    if (circ) add(ExpenseType.CIRCULATION, "Τέλη κυκλοφορίας", circ.amount);
  }

  if (toCreate.length > 0) {
    await prisma.caseExpense.createMany({ data: toCreate });
  }
  revalidatePath(`/cases/${caseId}`);
}
