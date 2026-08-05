import type { CaseState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CaseFilterParams = {
  type?: string;
  state?: string;
  assigned?: string;
  referrer?: string; // contactId προμηθευτή (για τιμολόγηση)
  urgent?: string;
  unpaid?: string;
  from?: string;
  to?: string;
};

// Χτίζει το where της λίστας υποθέσεων. Χρησιμοποιείται από τη σελίδα και
// από την εξαγωγή CSV, ώστε να μη διαφοροποιηθούν ποτέ.
export async function buildCaseWhere(
  p: CaseFilterParams,
): Promise<Prisma.CaseWhereInput> {
  // «Ανεξόφλητες»: υπόλοιπο (χρέωση − εισπράξεις) > 0, υπολογισμένο στη βάση.
  let unpaidIds: string[] | null = null;
  if (p.unpaid === "1") {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id
      FROM "Case" c
      LEFT JOIN (
        SELECT "caseId", SUM(amount) AS s FROM "CaseExpense" GROUP BY "caseId"
      ) e ON e."caseId" = c.id
      LEFT JOIN (
        SELECT "caseId", SUM(amount) AS s FROM "CasePayment" GROUP BY "caseId"
      ) p ON p."caseId" = c.id
      WHERE COALESCE(e.s, 0) + COALESCE(c.fee, 0)
          + COALESCE(c."urgentFee", 0) + COALESCE(c."plateFee", 0)
          - COALESCE(p.s, 0) > 0
    `;
    unpaidIds = rows.map((r) => r.id);
  }

  return {
    ...(p.type ? { caseTypeId: p.type } : {}),
    ...(p.state ? { state: p.state as CaseState } : {}),
    ...(p.assigned ? { assignedUserId: p.assigned } : {}),
    ...(p.referrer
      ? { parties: { some: { role: "REFERRER", contactId: p.referrer } } }
      : {}),
    ...(p.urgent === "1" ? { urgent: true } : {}),
    ...(p.from || p.to
      ? {
          openedAt: {
            ...(p.from ? { gte: new Date(`${p.from}T00:00:00`) } : {}),
            ...(p.to ? { lte: new Date(`${p.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    ...(unpaidIds ? { id: { in: unpaidIds } } : {}),
  };
}

// Κρατά μόνο τα ενεργά φίλτρα, για να περαστούν στο link εξαγωγής.
export function filterQueryString(p: CaseFilterParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) qs.set(k, v);
  return qs.toString();
}

// Διαβάζει τα φίλτρα από query params (χρήση στα export API routes).
export function parseCaseFilterParams(sp: URLSearchParams): CaseFilterParams {
  const keys: (keyof CaseFilterParams)[] = [
    "type",
    "state",
    "assigned",
    "referrer",
    "urgent",
    "unpaid",
    "from",
    "to",
  ];
  const out: CaseFilterParams = {};
  for (const k of keys) out[k] = sp.get(k) ?? undefined;
  return out;
}
