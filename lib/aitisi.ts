// Αυτόματη συμπλήρωση αιτήσεων (Υπεύθυνη Δήλωση / Αίτηση) σε PDF, με overlay
// των στοιχείων της υπόθεσης πάνω στα επίσημα υποδείγματα, ώστε να διατηρείται
// ακριβώς η μορφή του εντύπου. Υποστηριζόμενα έντυπα:
//   • metavivasi        — Μ-ΤΑΚ02, μεταβίβαση Ε.Ι.Χ./Δ.Ι.Χ.
//   • taxinomisiImport  — χορήγηση άδειας & πινακίδων ανάριθμου/αταξινόμητου
//
// Origin: κάτω-αριστερά (pdf-lib). Τα `yTop` είναι στο σύστημα του εντύπου
// (πάνω-αριστερά), οπότε μετατρέπονται με `y = H - yTop + BASELINE_ADJ`.
// Τα x/πλάτη τοποθετούν την τιμή ΜΕΣΑ στο κενό κελί (δεξιά της κατακόρυφης
// γραμμής του πίνακα) — προέκυψαν από το vector grid των υποδειγμάτων.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { AitisiTemplate } from "./aitisi-template";

// Επανεξαγωγή για συμβατότητα με τους υπάρχοντες importers (route, καρτέλα).
export { aitisiTemplateFor, type AitisiTemplate } from "./aitisi-template";

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

// Γραμματοσειρά με ελληνικά — αλυσίδα εναλλακτικών ώστε να μη χρειάζεται να
// διανείμουμε proprietary font στο repo. Ο χειριστής μπορεί να αφήσει ελεύθερη
// γραμματοσειρά στο templates/aitisi-font.ttf για full portability.
const FONT_CANDIDATES = [
  path.join(TEMPLATES_DIR, "aitisi-font.ttf"),
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/Library/Fonts/Arial.ttf",
];

const BASELINE_ADJ = 2;
// Χρώμα «στυλό» για να ξεχωρίζουν τα συμπληρωμένα στοιχεία από το έντυπο.
const INK = rgb(0.04, 0.12, 0.45);

export type AitisiData = {
  firstName?: string | null;
  lastName?: string | null;
  fatherName?: string | null;
  idNumber?: string | null;
  afm?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  plate?: string | null; // αριθμός κυκλοφορίας (μεταβίβαση)
  vin?: string | null; // αριθμός πλαισίου (ταξινόμηση ανάριθμου)
  make?: string | null; // εργοστάσιο κατασκευής (ταξινόμηση ανάριθμου)
  body?: string | null; // ελεύθερη περιγραφή οχήματος (ΦΙΧ — μία γραμμή)
};

type Field = { x: number; yTop: number; size: number; maxWidth: number };
// Ένα πεδίο μπορεί να συμπληρώνεται σε πολλές θέσεις (π.χ. η πινακίδα
// εμφανίζεται 2 φορές στην αίτηση ακινησίας).
type FieldMap = Partial<Record<keyof AitisiData, Field | Field[]>>;

// Το μπλοκ «ΣΤΟΙΧΕΙΑ ΑΙΤΟΥΝΤΟΣ» εμφανίζεται σε δύο παραλλαγές πλέγματος:
//   • Grid A (Μ-ΤΑΚ02/01/11): labels στην ΚΑΤΩ γραμμή του κελιού.
//   • Grid B (Μ-ΤΑΚ04/08): labels στην ΠΑΝΩ γραμμή, στενότερα κελιά.
// Και στις δύο αλλάζουν μόνο τα y (yTop) των γραμμών.
function applicantFields(y: {
  name: number;
  father: number;
  id: number;
  address: number;
  phone: number;
  emailX?: number;
}): FieldMap {
  return {
    firstName: { x: 108, yTop: y.name, size: 9, maxWidth: 155 },
    lastName: { x: 333, yTop: y.name, size: 9, maxWidth: 218 },
    fatherName: { x: 108, yTop: y.father, size: 9, maxWidth: 155 },
    idNumber: { x: 172, yTop: y.id, size: 9, maxWidth: 116 },
    afm: { x: 341, yTop: y.id, size: 9, maxWidth: 210 },
    address: { x: 135, yTop: y.address, size: 9, maxWidth: 128 },
    phone: { x: 135, yTop: y.phone, size: 9, maxWidth: 83 },
    email: {
      x: y.emailX ?? 367,
      yTop: y.phone,
      size: 9,
      maxWidth: 555 - (y.emailX ?? 367) - 3,
    },
  };
}

// Grid B — Μ-ΤΑΚ04 (Ταξινόμηση/Μεταβίβαση ΦΙΧ) & Μ-ΤΑΚ08 (Συμβόλαιο ΦΙΧ).
function applicantFieldsB(y: {
  name: number;
  father: number;
  id: number;
  address: number;
  phone: number;
  emailX?: number;
}): FieldMap {
  const ex = y.emailX ?? 446;
  return {
    firstName: { x: 110, yTop: y.name, size: 9, maxWidth: 153 },
    lastName: { x: 352, yTop: y.name, size: 9, maxWidth: 200 },
    fatherName: { x: 110, yTop: y.father, size: 9, maxWidth: 153 },
    idNumber: { x: 151, yTop: y.id, size: 9, maxWidth: 68 },
    afm: { x: 341, yTop: y.id, size: 9, maxWidth: 210 },
    address: { x: 135, yTop: y.address, size: 9, maxWidth: 85 },
    phone: { x: 135, yTop: y.phone, size: 9, maxWidth: 85 },
    email: { x: ex, yTop: y.phone, size: 9, maxWidth: 555 - ex - 3 },
  };
}

const TEMPLATES = {
  metavivasi: {
    file: "metavivasi.pdf",
    fields: {
      ...applicantFields({
        name: 321.8,
        father: 353.2,
        id: 410.1,
        address: 457.5,
        phone: 481.2,
      }),
      plate: { x: 366, yTop: 499.0, size: 11, maxWidth: 180 },
    } as FieldMap,
  },
  taxinomisiImport: {
    file: "taxinomisi-eksoterikou.pdf",
    fields: {
      ...applicantFields({
        name: 315.1,
        father: 336.8,
        id: 380.1,
        address: 437.6,
        phone: 471.2,
        emailX: 447, // το label «(Email)» φτάνει έως ~443
      }),
      vin: { x: 222, yTop: 508.0, size: 11, maxWidth: 210 }, // «αριθμό πλαισίου …»
      make: { x: 108, yTop: 522.0, size: 11, maxWidth: 430 }, // «εργοστασίου κατασκευής …»
    } as FieldMap,
  },
  taxinomisiFix: {
    // Μ-ΤΑΚ04 — χορήγηση άδειας κυκλοφορίας Φ.Ι.Χ. (Ταξινόμηση & Μεταβίβαση).
    // Το σώμα είναι ελεύθερες γραμμές: γράφουμε την περιγραφή οχήματος (body).
    file: "taxinomisi-fix.pdf",
    fields: {
      ...applicantFieldsB({
        name: 291.3,
        father: 313.0,
        id: 356.5,
        address: 413.8,
        phone: 447.6,
      }),
      body: { x: 48, yTop: 478.0, size: 11, maxWidth: 500 }, // 1η κενή γραμμή σώματος
    } as FieldMap,
  },
  symvolaioFix: {
    // Μ-ΤΑΚ08 — επικύρωση συμφωνίας μεταβίβασης Φ.Ι.Χ./Λ.Ι.Χ. Ίδιο grid (B),
    // σώμα με έναν αριθμό κυκλοφορίας.
    file: "symvolaio-fix.pdf",
    fields: {
      ...applicantFieldsB({
        name: 289.5,
        father: 311.1,
        id: 354.5,
        address: 411.9,
        phone: 445.6,
      }),
      plate: { x: 340, yTop: 460.0, size: 11, maxWidth: 128 }, // «αριθμό κυκλοφορίας …»
    } as FieldMap,
  },
  akinisiaFix: {
    // Μ-ΤΑΚ11 — βεβαίωση ακινησίας ΦΙΧ/ΛΙΧ. Ίδιο grid με Μ-ΤΑΚ02, αλλά η
    // πινακίδα εμφανίζεται 2 φορές στο σώμα (κατάθεση + υπεύθυνη δήλωση).
    file: "akinisia-fix.pdf",
    fields: {
      ...applicantFields({
        name: 314.6,
        father: 336.3,
        id: 379.7,
        address: 432.8, // «Τόπος έδρας»
        phone: 466.4,
        emailX: 420, // το label «(Email)» φτάνει έως ~416
      }),
      plate: [
        { x: 52, yTop: 499.0, size: 11, maxWidth: 165 }, // «αριθμό κυκλοφορίας …»
        { x: 52, yTop: 554.0, size: 11, maxWidth: 235 }, // «το αριθμ. …» (δήλωση)
      ],
    } as FieldMap,
  },
  antikatastasiPlates: {
    // Μ-ΤΑΚ10 — αντικατάσταση πινακίδων ΕΙΧ/ΔΙΧ (απώλεια/φθορά/κλοπή). Grid A,
    // μετατοπισμένο χαμηλότερα (μεγάλος τίτλος). Χωρίς Fax· η πινακίδα τυλίγει
    // στην επόμενη γραμμή του σώματος.
    file: "antikatastasi-pinakidon.pdf",
    fields: {
      ...applicantFields({
        name: 331.9,
        father: 353.6,
        id: 396.9,
        address: 450.0,
        phone: 483.7,
        emailX: 422, // το label «(Email)» φτάνει έως ~418
      }),
      plate: { x: 48, yTop: 515.0, size: 11, maxWidth: 88 }, // «αριθμό κυκλοφορίας …»
    } as FieldMap,
  },
} as const;

async function loadFont(): Promise<Buffer> {
  for (const p of FONT_CANDIDATES) {
    try {
      return await readFile(p);
    } catch {
      // δοκίμασε την επόμενη
    }
  }
  throw new Error(
    "Δεν βρέθηκε γραμματοσειρά για την αίτηση — τοποθετήστε αρχείο στο templates/aitisi-font.ttf",
  );
}

// Μειώνει το μέγεθος ώστε να χωράει στο διαθέσιμο πλάτος (χωρίς overflow).
function fit(font: PDFFont, text: string, size: number, maxWidth: number): number {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

export async function fillAitisi(
  template: AitisiTemplate,
  data: AitisiData,
): Promise<Uint8Array> {
  const spec = TEMPLATES[template];
  const [tplBytes, fontBytes] = await Promise.all([
    readFile(path.join(TEMPLATES_DIR, spec.file)),
    loadFont(),
  ]);

  const pdf = await PDFDocument.load(tplBytes);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });

  const page = pdf.getPages()[0];
  const H = page.getHeight();

  for (const key of Object.keys(spec.fields) as (keyof AitisiData)[]) {
    const f = spec.fields[key];
    if (!f) continue;
    const raw = data[key];
    if (!raw) continue;
    const value = String(raw).trim();
    if (!value) continue;

    for (const pos of Array.isArray(f) ? f : [f]) {
      const size = fit(font, value, pos.size, pos.maxWidth);
      page.drawText(value, {
        x: pos.x,
        y: H - pos.yTop + BASELINE_ADJ,
        size,
        font,
        color: INK,
      });
    }
  }

  return pdf.save();
}
