// Κοινές συναρτήσεις άντλησης δεδομένων για τις λίστες ταξινομήσεων &
// μεταβιβάσεων (εκτυπώσιμες σελίδες). Χρησιμοποιούν το ίδιο `buildCaseWhere`
// με τη λίστα υποθέσεων, ώστε τα φίλτρα να συμπεριφέρονται πανομοιότυπα.

import type { CaseFilterParams } from "./case-filters";
import { buildCaseWhere } from "./case-filters";
import { prisma } from "./prisma";

const PLATE_LABELS: Record<string, string> = {
  EVEN: "Ζυγό",
  ODD: "Μονό",
  SPECIAL: "Ειδικό",
};

const num = (d: unknown): number => (d == null ? 0 : Number(d));

function contactName(c: { lastName: string; firstName: string | null }): string {
  return c.firstName ? `${c.lastName} ${c.firstName}` : c.lastName;
}

export type RegistrationRow = {
  no: number;
  date: Date;
  referrer: string;
  buyer: string;
  delivery: string;
  parvolo: number; // παράβολο (τέλος άδειας, χωρίς προμήθεια τράπεζας)
  circulation: number; // τέλη κυκλοφορίας
  emissions: number | null; // ρύποι CO₂
  urgent: boolean;
  regNo: string; // αριθμός κυκλοφορίας
  vin: string; // πλαίσιο
  platePref: string; // ζυγό/μονό/ειδικό
  retention: boolean; // παρακράτηση κυριότητας
};

// Ταξινομήσεις: τύποι που εκδίδουν πινακίδες· επείγοντα πρώτα, μετά χρονολογικά.
export async function registrationRows(
  params: CaseFilterParams,
): Promise<RegistrationRow[]> {
  const where = await buildCaseWhere(params);
  const cases = await prisma.case.findMany({
    where: { ...where, caseType: { issuesPlates: true } },
    orderBy: [{ urgent: "desc" }, { openedAt: "asc" }],
    include: {
      vehicle: true,
      parties: { include: { contact: true } },
      expenses: { select: { type: true, amount: true } },
    },
  });

  return cases.map((c, i) => {
    const sumOf = (t: string) =>
      c.expenses.filter((e) => e.type === t).reduce((s, e) => s + num(e.amount), 0);
    const buyer = c.parties.find((p) => ["BUYER", "OWNER"].includes(p.role));
    const referrer = c.parties.find((p) => p.role === "REFERRER");
    const platePref = c.platePreference
      ? c.platePreference === "SPECIAL"
        ? `Ειδικό${c.plateRequest ? ` (${c.plateRequest})` : ""}`
        : (PLATE_LABELS[c.platePreference] ?? "")
      : "";

    return {
      no: i + 1,
      date: c.openedAt,
      referrer: referrer ? contactName(referrer.contact) : "",
      buyer: buyer ? contactName(buyer.contact) : "",
      delivery: c.delivery ?? "",
      parvolo: sumOf("LICENSE"),
      circulation: sumOf("CIRCULATION"),
      emissions: c.vehicle?.emissions ?? null,
      urgent: c.urgent,
      regNo: c.vehicle?.plate ?? "",
      vin: c.vehicle?.vin ?? "",
      platePref,
      retention: c.vehicle?.hasOwnershipRetention ?? false,
    };
  });
}

export type OtherRow = {
  no: number;
  date: Date;
  type: string; // όνομα τύπου εργασίας (ετερογενής λίστα)
  referrer: string;
  client: string;
  vehicle: string; // πινακίδα ή πλαίσιο, αν υπάρχει όχημα
  delivery: string;
};

// Λοιπές εργασίες: κατηγορία OTHER (ό,τι δεν είναι ταξινόμηση/μεταβίβαση/ΦΙΧ).
// Ομαδοποίηση κατά τύπο εργασίας, μετά χρονολογικά.
export async function otherRows(params: CaseFilterParams): Promise<OtherRow[]> {
  const where = await buildCaseWhere(params);
  const cases = await prisma.case.findMany({
    where: { ...where, caseType: { category: "OTHER" } },
    orderBy: [{ caseType: { name: "asc" } }, { openedAt: "asc" }],
    include: {
      caseType: { select: { name: true } },
      vehicle: true,
      parties: { include: { contact: true } },
    },
  });

  return cases.map((c, i) => {
    const client = c.parties.find((p) =>
      ["BUYER", "OWNER", "SELLER"].includes(p.role),
    );
    const referrer = c.parties.find((p) => p.role === "REFERRER");
    const vehicle = c.vehicle
      ? [c.vehicle.make, c.vehicle.plate ?? c.vehicle.vin].filter(Boolean).join(" · ")
      : "";
    return {
      no: i + 1,
      date: c.openedAt,
      type: c.caseType.name,
      referrer: referrer ? contactName(referrer.contact) : "",
      client: client ? contactName(client.contact) : "",
      vehicle,
      delivery: c.delivery ?? "",
    };
  });
}

export type TransferRow = {
  no: number;
  date: Date;
  referrer: string;
  buyer: string;
  delivery: string;
};

// Μεταβιβάσεις (κατηγορία TRANSFER)· χρονολογικά (διεκπεραιώνονται αυθημερόν).
export async function transferRows(
  params: CaseFilterParams,
): Promise<TransferRow[]> {
  const where = await buildCaseWhere(params);
  const cases = await prisma.case.findMany({
    where: { ...where, caseType: { category: "TRANSFER" } },
    orderBy: { openedAt: "asc" },
    include: { parties: { include: { contact: true } } },
  });

  return cases.map((c, i) => {
    const buyer = c.parties.find((p) => ["BUYER", "OWNER"].includes(p.role));
    const referrer = c.parties.find((p) => p.role === "REFERRER");
    return {
      no: i + 1,
      date: c.openedAt,
      referrer: referrer ? contactName(referrer.contact) : "",
      buyer: buyer ? contactName(buyer.contact) : "",
      delivery: c.delivery ?? "",
    };
  });
}
