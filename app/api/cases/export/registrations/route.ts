import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCaseWhere, parseCaseFilterParams } from "@/lib/case-filters";
import { csvDate, csvNumber, csvResponse, toCsv } from "@/lib/csv";

const PLATE_LABELS: Record<string, string> = {
  EVEN: "Ζυγό",
  ODD: "Μονό",
  SPECIAL: "Ειδικό",
};

const num = (d: unknown): number => (d == null ? 0 : Number(d));

function contactName(c: { lastName: string; firstName: string | null }): string {
  return c.firstName ? `${c.lastName} ${c.firstName}` : c.lastName;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const params = parseCaseFilterParams(new URL(req.url).searchParams);
  const where = await buildCaseWhere(params);

  const cases = await prisma.case.findMany({
    // Μόνο ταξινομήσεις: τύποι όπου εκδίδονται πινακίδες.
    where: { ...where, caseType: { issuesPlates: true } },
    // Επείγοντα πρώτα, μετά χρονολογικά.
    orderBy: [{ urgent: "desc" }, { openedAt: "asc" }],
    include: {
      vehicle: true,
      parties: { include: { contact: true } },
      expenses: { select: { type: true, amount: true } },
    },
  });

  const headers = [
    "Α/Α",
    "Ημερομηνία",
    "Προμηθευτής",
    "Αγοραστής",
    "Παράδοση",
    "Παράβολο",
    "Τέλη κυκλοφορίας",
    "Ρύποι (g/km)",
    "Επείγον",
    "Αριθ. κυκλοφορίας",
    "Πλαίσιο",
    "Πινακίδα",
    "Παρακράτηση",
  ];

  const rows = cases.map((c, i) => {
    const sumOf = (t: string) =>
      c.expenses.filter((e) => e.type === t).reduce((s, e) => s + num(e.amount), 0);

    const buyer = c.parties.find((p) => ["BUYER", "OWNER"].includes(p.role));
    const referrer = c.parties.find((p) => p.role === "REFERRER");

    const plate = c.platePreference
      ? c.platePreference === "SPECIAL"
        ? `Ειδικό${c.plateRequest ? ` (${c.plateRequest})` : ""}`
        : PLATE_LABELS[c.platePreference]
      : "";

    return [
      i + 1,
      csvDate(c.openedAt),
      referrer ? contactName(referrer.contact) : "",
      buyer ? contactName(buyer.contact) : "",
      c.delivery ?? "",
      csvNumber(sumOf("LICENSE")),
      csvNumber(sumOf("CIRCULATION")),
      c.vehicle?.emissions ?? "",
      c.urgent ? "ΝΑΙ" : "ΟΧΙ",
      c.vehicle?.plate ?? "",
      c.vehicle?.vin ?? "",
      plate,
      c.vehicle?.hasOwnershipRetention ? "ΝΑΙ" : "ΟΧΙ",
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(headers, rows), `taxinomiseis-${stamp}.csv`);
}
