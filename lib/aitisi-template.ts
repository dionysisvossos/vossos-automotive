// Καθαρή λογική επιλογής εντύπου αίτησης — χωρίς server-only εξαρτήσεις
// (pdf-lib/fs), ώστε να μπορεί να χρησιμοποιηθεί ΚΑΙ σε client components
// (φόρμα νέας υπόθεσης) ΚΑΙ στο server (route, καρτέλα).

export type AitisiTemplate =
  | "metavivasi" // Μ-ΤΑΚ02 — μεταβίβαση
  | "taxinomisiImport" // Μ-ΤΑΚ01 — ταξινόμηση εξωτερικού
  | "taxinomisiFix" // Μ-ΤΑΚ04 — ταξινόμηση & μεταβίβαση ΦΙΧ
  | "symvolaioFix" // Μ-ΤΑΚ08 — συμβόλαιο ΦΙΧ
  | "akinisiaFix" // Μ-ΤΑΚ11 — ακινησία ΦΙΧ
  | "antikatastasiPlates"; // Μ-ΤΑΚ10 — αντικατάσταση πινακίδων

// Επιλέγει το κατάλληλο έντυπο βάσει τύπου υπόθεσης (ή null αν δεν υπάρχει).
export function aitisiTemplateFor(
  caseType: { category: string; issuesPlates: boolean; name: string },
  isImport: boolean,
): AitisiTemplate | null {
  const cat = caseType.category;
  // Accent/case-insensitive όνομα τύπου, για ταίριασμα ανά κλειδί.
  const n = caseType.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  if (cat === "TRANSFER") return "metavivasi";
  if (cat === "REGISTRATION" && isImport) return "taxinomisiImport";
  if (cat === "TRUCK") {
    if (n.includes("ακινησ")) return "akinisiaFix"; // Ακινησία ΦΙΧ
    if (n.includes("συμβολ")) return "symvolaioFix"; // Συμβόλαιο ΦΙΧ (Μ-ΤΑΚ08)
    // Ταξινόμηση & Μεταβίβαση ΦΙΧ: ίδιο έντυπο χορήγησης άδειας (Μ-ΤΑΚ04).
    if (caseType.issuesPlates || n.includes("μεταβιβ")) return "taxinomisiFix";
  }
  if (cat === "OTHER") {
    if (n.includes("αντικατ")) return "antikatastasiPlates"; // Μ-ΤΑΚ10
  }
  return null;
}
