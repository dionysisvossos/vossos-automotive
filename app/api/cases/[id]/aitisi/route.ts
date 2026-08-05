import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fillAitisi, aitisiTemplateFor, type AitisiData } from "@/lib/aitisi";

// Παράγει τη συμπληρωμένη αίτηση της υπόθεσης σε PDF.
//   • Μεταβίβαση            → Μ-ΤΑΚ02 (αριθμός κυκλοφορίας)
//   • Ταξινόμηση εξωτερικού → Μ-ΤΑΚ01 (αριθμός πλαισίου + μάρκα)
//   • Ταξινόμηση ΦΙΧ        → Μ-ΤΑΚ04 (περιγραφή οχήματος)
//   • Ακινησία ΦΙΧ          → Μ-ΤΑΚ11 (αριθμός κυκλοφορίας ×2)
// Αιτών = αγοραστής (ή κάτοχος). Τα στοιχεία αντλούνται από την καρτέλα του.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      vehicle: true,
      caseType: true,
      parties: { include: { contact: true } },
    },
  });
  if (!c) return new Response("Not found", { status: 404 });

  const template = aitisiTemplateFor(c.caseType, c.isImport);

  if (!template) {
    return new Response("Δεν υπάρχει διαθέσιμη αίτηση για αυτόν τον τύπο", {
      status: 400,
    });
  }

  const buyer =
    c.parties.find((p) => p.role === "BUYER") ??
    c.parties.find((p) => p.role === "OWNER");
  const contact = buyer?.contact;

  // Ελεύθερη περιγραφή οχήματος για το σώμα της αίτησης ΦΙΧ.
  const bodyParts = [
    c.vehicle?.make ? `εργοστασίου κατασκευής ${c.vehicle.make}` : null,
    c.vehicle?.vin ? `με αριθμό πλαισίου ${c.vehicle.vin}` : null,
    c.vehicle?.plate ? `αριθμός κυκλοφορίας ${c.vehicle.plate}` : null,
  ].filter(Boolean);

  const data: AitisiData = {
    firstName: contact?.firstName,
    lastName: contact?.lastName,
    fatherName: contact?.fatherName,
    idNumber: contact?.idNumber,
    afm: contact?.afm,
    address: contact?.address,
    phone: contact?.phone,
    email: contact?.email,
    plate: c.vehicle?.plate,
    vin: c.vehicle?.vin,
    make: c.vehicle?.make,
    body: bodyParts.length ? bodyParts.join(", ") : undefined,
  };

  const pdf = await fillAitisi(template, data);
  const prefix = {
    metavivasi: "metavivasi",
    taxinomisiImport: "taxinomisi",
    taxinomisiFix: "taxinomisi-fix",
    symvolaioFix: "symvolaio",
    akinisiaFix: "akinisia",
    antikatastasiPlates: "antikatastasi-pinakidon",
  }[template];

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: ανοίγει σε νέα καρτέλα για προεπισκόπηση/αποθήκευση/εκτύπωση.
      "Content-Disposition": `inline; filename="aitisi-${prefix}-${c.code}.pdf"`,
    },
  });
}
