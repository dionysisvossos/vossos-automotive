import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCaseWhere, parseCaseFilterParams } from "@/lib/case-filters";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";

function contactName(c: { lastName: string; firstName: string | null }): string {
  return c.firstName ? `${c.lastName} ${c.firstName}` : c.lastName;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const params = parseCaseFilterParams(new URL(req.url).searchParams);
  const where = await buildCaseWhere(params);

  const cases = await prisma.case.findMany({
    // Μόνο μεταβιβάσεις (κατηγορία «Μεταβίβαση»).
    where: { ...where, caseType: { category: "TRANSFER" } },
    // Χρονολογικά — οι μεταβιβάσεις διεκπεραιώνονται συνήθως αυθημερόν,
    // οπότε δεν έχει νόημα προτεραιοποίηση «επείγοντος».
    orderBy: { openedAt: "asc" },
    include: { parties: { include: { contact: true } } },
  });

  const headers = [
    "Α/Α",
    "Ημερομηνία",
    "Προμηθευτής",
    "Αγοραστής",
    "Παράδοση",
  ];

  const rows = cases.map((c, i) => {
    const buyer = c.parties.find((p) => ["BUYER", "OWNER"].includes(p.role));
    const referrer = c.parties.find((p) => p.role === "REFERRER");
    return [
      i + 1,
      csvDate(c.openedAt),
      referrer ? contactName(referrer.contact) : "",
      buyer ? contactName(buyer.contact) : "",
      c.delivery ?? "",
    ];
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(toCsv(headers, rows), `metavivaseis-${stamp}.csv`);
}
