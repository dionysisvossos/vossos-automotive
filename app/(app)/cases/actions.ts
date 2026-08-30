"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  Prisma,
  CasePartyRole,
  ContactType,
  VehicleCategory,
  VehicleCondition,
  PlatePreference,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOperator } from "@/lib/auth-guard";

const partySchema = z.object({
  role: z.nativeEnum(CasePartyRole),
  // Αν δοθεί, συνδέεται υπάρχον Contact· αλλιώς δημιουργείται νέο.
  contactId: z.string().optional(),
  contactType: z.nativeEnum(ContactType),
  lastName: z.string().trim().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  firstName: z.string().trim().optional(),
  fatherName: z.string().trim().optional(), // όνομα πατέρα (αίτηση μεταβίβασης)
  afm: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

const vehicleSchema = z.object({
  category: z.nativeEnum(VehicleCategory),
  condition: z.nativeEnum(VehicleCondition),
  vin: z.string().trim().optional(),
  plate: z.string().trim().optional(),
  make: z.string().trim().optional(),
  emissions: z.number().int().nonnegative().optional(), // ρύποι CO₂ (g/km)
  cc: z.number().int().nonnegative().optional(), // κυβικά
  hasOwnershipRetention: z.boolean().default(false),
});

// Ο προμηθευτής είναι όμοιος με party αλλά χωρίς ρόλο (πάντα REFERRER).
const referrerSchema = partySchema.omit({ role: true });

const createCaseSchema = z.object({
  caseTypeId: z.string().min(1),
  regionalServiceId: z.string().optional(),
  notes: z.string().trim().optional(),
  delivery: z.string().trim().optional(),
  urgent: z.boolean().default(false),
  isImport: z.boolean().default(false),
  urgentFee: z.number().nonnegative().optional(),
  platePreference: z.nativeEnum(PlatePreference).optional(),
  plateRequest: z.string().trim().optional(),
  plateFee: z.number().nonnegative().optional(),
  vehicle: vehicleSchema.optional(),
  parties: z.array(partySchema).min(1, "Χρειάζεται τουλάχιστον ένας εμπλεκόμενος"),
  referrer: referrerSchema.optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

async function nextCaseCode(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.case.count({
    where: { code: { startsWith: `${year}-` } },
  });
  return `${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function createCase(input: CreateCaseInput): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error("Απαιτείται σύνδεση");

  const data = createCaseSchema.parse(input);

  const caseType = await prisma.caseType.findUnique({
    where: { id: data.caseTypeId },
    include: { stageTemplates: { orderBy: { position: "asc" } } },
  });
  if (!caseType || !caseType.active) throw new Error("Άκυρος τύπος υπόθεσης");

  if (caseType.requiresVehicle && !data.vehicle) {
    throw new Error("Ο τύπος αυτός απαιτεί στοιχεία οχήματος");
  }

  const code = await nextCaseCode();

  const created = await prisma.$transaction(async (tx) => {
    let vehicleId: string | undefined;
    if (caseType.requiresVehicle && data.vehicle) {
      const vehicle = await tx.vehicle.create({
        data: {
          category: data.vehicle.category,
          condition: data.vehicle.condition,
          vin: data.vehicle.vin || null,
          plate: data.vehicle.plate || null,
          make: data.vehicle.make || null,
          emissions: data.vehicle.emissions ?? null,
          cc: data.vehicle.cc ?? null,
          hasOwnershipRetention: data.vehicle.hasOwnershipRetention,
        },
      });
      vehicleId = vehicle.id;
    }

    // Ο προμηθευτής (αν υπάρχει) μπαίνει ως ξεχωριστός ρόλος REFERRER —
    // μπορεί να είναι το ίδιο Contact με αγοραστή/πωλητή (dedupe κατά ΑΦΜ).
    const allParties = [
      ...data.parties,
      ...(data.referrer
        ? [{ ...data.referrer, role: CasePartyRole.REFERRER }]
        : []),
    ];

    // Ανάλυση εμπλεκομένων: υπάρχον Contact (contactId) → σύνδεση·
    // αλλιώς dedupe κατά ΑΦΜ· αλλιώς δημιουργία νέου.
    const partyLinks: { role: CasePartyRole; contactId: string }[] = [];
    for (const p of allParties) {
      let contactId = p.contactId;

      if (!contactId && p.afm) {
        const existing = await tx.contact.findFirst({
          where: { afm: p.afm },
          select: { id: true },
        });
        if (existing) contactId = existing.id;
      }

      if (contactId) {
        if (p.role === CasePartyRole.REFERRER) {
          await tx.contact.update({
            where: { id: contactId },
            data: { isReferrer: true },
          });
        }
      } else {
        const contact = await tx.contact.create({
          data: {
            type: p.contactType,
            lastName: p.lastName,
            firstName: p.firstName || null,
            fatherName: p.fatherName || null,
            afm: p.afm || null,
            idNumber: p.idNumber || null,
            phone: p.phone || null,
            email: p.email || null,
            address: p.address || null,
            isReferrer: p.role === CasePartyRole.REFERRER,
          },
        });
        contactId = contact.id;
      }

      // Αποφυγή διπλού ίδιου (contact, ρόλος) — @@unique([caseId, contactId, role])
      if (
        !partyLinks.some((l) => l.contactId === contactId && l.role === p.role)
      ) {
        partyLinks.push({ role: p.role, contactId });
      }
    }

    const newCase = await tx.case.create({
      data: {
        code,
        caseTypeId: caseType.id,
        vehicleId,
        urgent: data.urgent,
        isImport: data.isImport,
        urgentFee: data.urgent ? data.urgentFee ?? null : null,
        platePreference: data.platePreference ?? null,
        plateRequest:
          data.platePreference === PlatePreference.SPECIAL
            ? data.plateRequest || null
            : null,
        plateFee:
          data.platePreference === PlatePreference.SPECIAL
            ? data.plateFee ?? null
            : null,
        regionalServiceId: data.regionalServiceId || null,
        // Αυτόματη ανάθεση στον χειριστή που καταχωρεί (συνδεδεμένος χρήστης).
        assignedUserId: session.user.id,
        delivery: data.delivery || null,
        notes: data.notes || null,
        parties: {
          create: partyLinks.map((l) => ({
            role: l.role,
            contactId: l.contactId,
          })),
        },
        stages: {
          create: caseType.stageTemplates.map((st) => ({
            stageTemplateId: st.id,
            name: st.name,
            position: st.position,
            state: st.position === 1 ? "IN_PROGRESS" : "PENDING",
          })),
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });

    const firstStage = newCase.stages[0];
    if (firstStage) {
      await tx.case.update({
        where: { id: newCase.id },
        data: { currentStageId: firstStage.id },
      });
    }

    return newCase;
  });

  revalidatePath("/cases");
  // Η πλοήγηση γίνεται από τον client (ώστε να μπορεί προαιρετικά να ανοίξει
  // και την αίτηση σε νέα καρτέλα στο ίδιο βήμα).
  return created.id;
}

export type ContactMatch = {
  id: string;
  type: ContactType;
  lastName: string;
  firstName: string | null;
  fatherName: string | null;
  afm: string | null;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

// Αναζήτηση υπάρχοντος πελάτη κατά ονοματεπώνυμο, ΑΦΜ ή αρ. ταυτότητας.
export async function searchContacts(query: string): Promise<ContactMatch[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Απαιτείται σύνδεση");

  const q = query.trim();
  if (q.length < 2) return [];

  // Escape των wildcards του LIKE (% _ \). Default escape char = "\".
  const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");
  const like = `%${esc(q)}%`;

  // Κάθε λέξη πρέπει να ταιριάζει (AND), ώστε "Παπα Γεωρ" να βρίσκει
  // "Παπαδόπουλος Γεώργιος" ανεξάρτητα από τη σειρά επωνύμου/ονόματος.
  const nameExpr = Prisma.sql`f_unaccent(trim(coalesce("lastName", '') || ' ' || coalesce("firstName", '')))`;
  const tokens = q.split(/\s+/).filter(Boolean).map(esc);
  const nameMatch = Prisma.join(
    tokens.map((t) => Prisma.sql`${nameExpr} ILIKE f_unaccent(${`%${t}%`})`),
    " AND ",
  );

  // f_unaccent(): immutable wrapper → accent-insensitive ταίριασμα που
  // αξιοποιεί το GIN trigram index.
  return prisma.$queryRaw<ContactMatch[]>`
    SELECT id, type, "lastName", "firstName", "fatherName", afm, "idNumber", phone, email, address
    FROM "Contact"
    WHERE (${nameMatch})
       OR afm ILIKE ${like}
       OR "idNumber" ILIKE ${like}
    ORDER BY "lastName" ASC, "firstName" ASC
    LIMIT 8
  `;
}

// Επεξεργασία στοιχείων υπάρχουσας επαφής (π.χ. συμπλήρωση πατρώνυμου σε
// παλιό πελάτη). Καλείται inline από την καρτέλα υπόθεσης.
const updateContactSchema = z.object({
  contactId: z.string().min(1),
  caseId: z.string().min(1), // για revalidation της καρτέλας
  contactType: z.nativeEnum(ContactType),
  lastName: z.string().trim().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  firstName: z.string().trim().optional(),
  fatherName: z.string().trim().optional(),
  afm: z.string().trim().optional(),
  doy: z.string().trim().optional(),
  idNumber: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export async function updateContact(input: UpdateContactInput): Promise<void> {
  await requireOperator(); // ADMIN/EMPLOYEE — ο VIEWER δεν επεξεργάζεται
  const d = updateContactSchema.parse(input);

  await prisma.contact.update({
    where: { id: d.contactId },
    data: {
      type: d.contactType,
      lastName: d.lastName,
      firstName: d.firstName || null,
      fatherName: d.fatherName || null,
      afm: d.afm || null,
      doy: d.doy || null,
      idNumber: d.idNumber || null,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
    },
  });

  revalidatePath(`/cases/${d.caseId}`);
}
