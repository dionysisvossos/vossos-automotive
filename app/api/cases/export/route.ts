import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCaseWhere, parseCaseFilterParams } from "@/lib/case-filters";
import { csvDate, csvNumber, csvResponse, toCsv } from "@/lib/csv";

const STATE_LABELS: Record<string, string> = {
  OPEN: "Σε εξέλιξη",
  COMPLETED: "Ολοκληρωμένη",
  CANCELLED: "Ακυρωμένη",
};

const num = (d: unknown): number => (d == null ? 0 : Number(d));

function contactName(c: { lastName: string; firstName: string | null }): string {
  return c.firstName ? `${c.lastName} ${c.firstName}` : c.lastName;
}

export async function GET(req: Request) {
  // Τα /api routes δεν περνούν από το middleware — έλεγχος εδώ.
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const params = parseCaseFilterParams(new URL(req.url).searchParams);
  const where = await buildCaseWhere(params);

  const cases = await prisma.case.findMany({
    where,
    orderBy: { openedAt: "desc" },
    include: {
      caseType: true,
      vehicle: true,
      assignedUser: true,
      regionalService: true,
      currentStage: true,
      parties: { include: { contact: true } },
      expenses: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const headers = [
    "Κωδικός",
    "Ημερομηνία",
    "Τύπος",
    "Κατάσταση",
    "Επείγον",
    "Στάδιο",
    "Υπεύθυνος",
    "Πελάτης",
    "Προμηθευτής",
    "Πινακίδα",
    "Αρ. πλαισίου",
    "Μάρκα",
    "Υπηρεσία",
    "Έξοδα",
    "Αμοιβή",
    "Επείγον (€)",
    "Ειδική πινακίδα (€)",
    "Χρέωση",
    "Εισπραχθέν",
    "Υπόλοιπο",
  ];

  const rows = cases.map((c) => {
    const expenses = c.expenses.reduce((s, e) => s + num(e.amount), 0);
    const fee = num(c.fee);
    const urgentFee = num(c.urgentFee);
    const plateFee = num(c.plateFee);
    const charged = expenses + fee + urgentFee + plateFee;
    const paid = c.payments.reduce((s, p) => s + num(p.amount), 0);

    const client = c.parties.find((p) =>
      ["BUYER", "OWNER", "SELLER"].includes(p.role),
    );
    const referrer = c.parties.find((p) => p.role === "REFERRER");

    return [
      c.code,
      csvDate(c.openedAt),
      c.caseType.name,
      STATE_LABELS[c.state] ?? c.state,
      c.urgent ? "Ναι" : "",
      c.currentStage?.name ?? "",
      c.assignedUser?.fullName ?? "",
      client ? contactName(client.contact) : "",
      referrer ? contactName(referrer.contact) : "",
      c.vehicle?.plate ?? "",
      c.vehicle?.vin ?? "",
      c.vehicle?.make ?? "",
      c.regionalService?.name ?? "",
      csvNumber(expenses),
      csvNumber(fee),
      csvNumber(urgentFee),
      csvNumber(plateFee),
      csvNumber(charged),
      csvNumber(paid),
      csvNumber(charged - paid),
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(headers, rows), `ypotheseis-${stamp}.csv`);
}
