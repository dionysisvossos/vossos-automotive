import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────
// Αρχικά πρότυπα workflow ανά τύπο υπόθεσης.
//
// ΠΡΟΣΟΧΗ: Αυτά είναι ΑΦΕΤΗΡΙΑ — ο διαχειριστής τα προσαρμόζει
// μέσα από το app. Τα στάδια είναι σειριακά (position 1..n) και το
// τελευταίο είναι isTerminal. Οι υπάρχουσες υποθέσεις ΔΕΝ επηρεάζονται
// από αλλαγές εδώ, γιατί κρατούν snapshot στο CaseStage.
// ─────────────────────────────────────────────────────────────

type SeedType = {
  name: string;
  description: string;
  category?: "REGISTRATION" | "TRANSFER" | "TRUCK" | "OTHER"; // default OTHER
  requiresVehicle: boolean;
  isFreeform?: boolean; // τύπος "Άλλο": ελεύθερη συμπλήρωση, χωρίς σταθερά στάδια
  fees?: ("license" | "circulation" | "transfer")[]; // προτεινόμενα πάγια τέλη
  issuesPlates?: boolean; // εκδίδονται πινακίδες (ζυγό/μονό/ειδικό)
  supportsImport?: boolean; // toggle «Εισαγωγή από εξωτερικό»
  stages: string[]; // με σειρά· το τελευταίο γίνεται isTerminal
  documents: { name: string; mandatory: boolean; importOnly?: boolean }[];
};

const caseTypes: SeedType[] = [
  {
    name: "Ταξινόμηση καινούργιου",
    description: "Ταξινόμηση καινούργιου επιβατικού οχήματος",
    category: "REGISTRATION",
    requiresVehicle: true,
    fees: ["license", "circulation"],
    issuesPlates: true,
    supportsImport: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Έλεγχος πιστοποιητικού συμμόρφωσης & τιμολογίου",
      "Καταβολή τέλους ταξινόμησης (τελωνείο)",
      "Έκδοση άδειας κυκλοφορίας",
      "Χορήγηση πινακίδων",
      "Παράδοση στον πελάτη",
    ],
    documents: [
      { name: "Πιστοποιητικό ταξινόμησης", mandatory: true },
      { name: "Πιστοποιητικό συμμόρφωσης", mandatory: true },
      { name: "Τιμολόγιο αγοράς", mandatory: true },
      // Πρόσθετα — εμφανίζονται μόνο με το toggle «Εισαγωγή από εξωτερικό»
      { name: "Ξένη άδεια κυκλοφορίας", mandatory: true, importOnly: true },
      { name: "Τιμολόγιο αγοράς εξωτερικού", mandatory: true, importOnly: true },
      { name: "ΔΑΟ – Δήλωση Άφιξης Οχήματος", mandatory: true, importOnly: true },
      {
        name: "Ξένο ΚΤΕΟ (αν απαιτείται λόγω ηλικίας)",
        mandatory: false,
        importOnly: true,
      },
    ],
  },
  {
    name: "Ανάριθμη μεταβίβαση",
    description:
      "Μεταφορά κυριότητας καινούργιου οχήματος σε νέο κάτοχο, χωρίς ταξινόμηση (γίνεται από αυτόν μεταγενέστερα)",
    category: "REGISTRATION",
    requiresVehicle: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Έλεγχος τιμολογίου & πιστοποιητικού συμμόρφωσης",
      "Συμπλήρωση εντύπων & υπεύθυνων δηλώσεων",
      "Καταβολή παραβόλων",
      "Έκδοση πράξης ανάριθμης μεταβίβασης",
      "Παράδοση στον νέο κάτοχο",
    ],
    documents: [
      { name: "Πιστοποιητικό συμμόρφωσης (CoC)", mandatory: true },
      { name: "Τιμολόγιο αγοράς", mandatory: true },
      { name: "Ταυτότητα πωλητή", mandatory: true },
      { name: "Ταυτότητα νέου κατόχου", mandatory: true },
      { name: "ΑΦΜ πωλητή & νέου κατόχου", mandatory: true },
      { name: "Υπεύθυνες δηλώσεις", mandatory: true },
    ],
  },
  {
    name: "Μεταβίβαση μεταχειρισμένου",
    description: "Μεταβίβαση μεταχειρισμένου επιβατικού οχήματος",
    category: "TRANSFER",
    requiresVehicle: true,
    fees: ["license", "transfer"],
    stages: [
      "Παραλαβή δικαιολογητικών (πωλητή & αγοραστή)",
      "Έλεγχος εκκρεμοτήτων (τέλη, ΚΤΕΟ, βάρη)",
      "Συμπλήρωση εντύπων & υπεύθυνων δηλώσεων",
      "Καταβολή τέλους μεταβίβασης & παραβόλων",
      "Κατάθεση στη Δ/νση Μεταφορών & έκδοση άδειας",
      "Παράδοση νέας άδειας στον αγοραστή",
    ],
    documents: [
      { name: "Άδεια κυκλοφορίας", mandatory: true },
      { name: "Βεβαίωση μη οφειλής τελών κυκλοφορίας", mandatory: true },
      { name: "Εξουσιοδότηση πωλητή", mandatory: true },
      { name: "Εξουσιοδότηση αγοραστή", mandatory: true },
      { name: "Δελτίο ΚΤΕΟ", mandatory: true },
      { name: "Τιμολόγιο", mandatory: true },
    ],
  },
  {
    name: "Ταξινόμηση ΦΙΧ",
    description: "Ταξινόμηση φορτηγού ιδιωτικής χρήσης",
    category: "TRUCK",
    requiresVehicle: true,
    fees: ["license", "circulation"],
    issuesPlates: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Έλεγχος δικαιώματος & δραστηριότητας",
      "Έλεγχος βαρών (ζυγολόγιο)",
      "Καταβολή τελών & εισφορών",
      "Κατάθεση στη Δ/νση Μεταφορών & έκδοση άδειας",
      "Χορήγηση πινακίδων & παράδοση",
    ],
    documents: [
      { name: "Πιστοποιητικό συμμόρφωσης / τιμολόγιο", mandatory: true },
      { name: "Ζυγολόγιο / βεβαίωση βαρών", mandatory: true },
      { name: "Βεβαίωση έναρξης/δραστηριότητας", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ κατόχου", mandatory: true },
      { name: "Αποδεικτικό ασφάλισης", mandatory: false },
    ],
  },
  {
    name: "Μεταβίβαση ΦΙΧ",
    description: "Μεταβίβαση φορτηγού ιδιωτικής χρήσης",
    category: "TRUCK",
    requiresVehicle: true,
    fees: ["license"],
    stages: [
      "Παραλαβή δικαιολογητικών (πωλητή & αγοραστή)",
      "Έλεγχος εκκρεμοτήτων (τέλη, ΚΤΕΟ, βάρη)",
      "Έλεγχος δικαιώματος κατοχής ΦΙΧ",
      "Καταβολή τέλους μεταβίβασης & παραβόλων",
      "Κατάθεση στη Δ/νση Μεταφορών & έκδοση άδειας",
      "Παράδοση νέας άδειας στον αγοραστή",
    ],
    documents: [
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Δελτίο ΚΤΕΟ σε ισχύ", mandatory: true },
      { name: "Ζυγολόγιο / βεβαίωση βαρών", mandatory: true },
      { name: "Βεβαίωση έναρξης/δραστηριότητας αγοραστή", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ πωλητή & αγοραστή", mandatory: true },
    ],
  },
  {
    name: "Έκδοση αντιγράφου άδειας κυκλοφορίας",
    description: "Έκδοση αντιγράφου λόγω απώλειας ή φθοράς",
    requiresVehicle: true,
    stages: [
      "Παραλαβή αίτησης & δικαιολογητικών",
      "Υπεύθυνη δήλωση απώλειας/φθοράς",
      "Καταβολή παραβόλου",
      "Κατάθεση στη Δ/νση Μεταφορών",
      "Παραλαβή & παράδοση αντιγράφου",
    ],
    documents: [
      { name: "Υπεύθυνη δήλωση απώλειας/φθοράς", mandatory: true },
      { name: "Ταυτότητα κατόχου", mandatory: true },
      { name: "Παράβολο", mandatory: true },
      { name: "Φθαρμένη άδεια (αν υπάρχει)", mandatory: false },
    ],
  },
  {
    name: "Αντικατάσταση πινακίδων κυκλοφορίας",
    description: "Αντικατάσταση λόγω απώλειας, κλοπής ή φθοράς",
    requiresVehicle: true,
    stages: [
      "Παραλαβή αίτησης & δικαιολογητικών",
      "Δήλωση απώλειας/κλοπής",
      "Καταβολή παραβόλων",
      "Κατάθεση & έκδοση νέων πινακίδων",
      "Παράδοση πινακίδων & άδειας",
    ],
    documents: [
      { name: "Υπεύθυνη δήλωση / δήλωση κλοπής", mandatory: true },
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Ταυτότητα κατόχου", mandatory: true },
      { name: "Παράβολα", mandatory: true },
      { name: "Παλιές πινακίδες (αν υπάρχουν)", mandatory: false },
    ],
  },
  {
    name: "Άρση παρακράτησης κυριότητας",
    description: "Άρση παρακράτησης μετά την εξόφληση χρηματοδότησης",
    requiresVehicle: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Βεβαίωση εξόφλησης από χρηματοδότη",
      "Καταβολή παραβόλου",
      "Κατάθεση & έκδοση νέας άδειας",
      "Παράδοση άδειας",
    ],
    documents: [
      { name: "Βεβαίωση άρσης παρακράτησης", mandatory: true },
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ κατόχου", mandatory: true },
      { name: "Παράβολο", mandatory: true },
    ],
  },
  {
    name: "Οριστική διαγραφή",
    description: "Οριστική διαγραφή οχήματος (καταστροφή/απόσυρση)",
    requiresVehicle: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Πιστοποιητικό καταστροφής (ΟΤΚΖ)",
      "Παράδοση πινακίδων & άδειας",
      "Κατάθεση & έκδοση βεβαίωσης διαγραφής",
    ],
    documents: [
      { name: "Πιστοποιητικό καταστροφής ΟΤΚΖ", mandatory: true },
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Πινακίδες κυκλοφορίας", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ κατόχου", mandatory: true },
      { name: "Υπεύθυνη δήλωση", mandatory: false },
    ],
  },
  {
    name: "Διόρθωση άδειας κυκλοφορίας",
    description: "Διόρθωση στοιχείων στην άδεια κυκλοφορίας",
    requiresVehicle: true,
    stages: [
      "Παραλαβή αίτησης & δικαιολογητικών",
      "Τεκμηρίωση διόρθωσης",
      "Καταβολή παραβόλου (αν απαιτείται)",
      "Κατάθεση & έκδοση διορθωμένης άδειας",
      "Παράδοση άδειας",
    ],
    documents: [
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Δικαιολογητικό διόρθωσης", mandatory: true },
      { name: "Ταυτότητα κατόχου", mandatory: true },
      { name: "Παράβολο", mandatory: false },
    ],
  },
  {
    name: "Ακινησία ΦΙΧ",
    description: "Δήλωση ακινησίας φορτηγού ιδιωτικής χρήσης",
    category: "TRUCK",
    requiresVehicle: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Παράδοση πινακίδων & άδειας",
      "Δήλωση ακινησίας",
      "Βεβαίωση ακινησίας & παράδοση",
    ],
    documents: [
      { name: "Άδεια κυκλοφορίας οχήματος", mandatory: true },
      { name: "Πινακίδες κυκλοφορίας", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ κατόχου", mandatory: true },
      { name: "Υπεύθυνη δήλωση ακινησίας", mandatory: true },
    ],
  },
  {
    name: "Ανανέωση άδειας οδήγησης",
    description: "Ανανέωση άδειας οδήγησης (χωρίς όχημα)",
    requiresVehicle: false,
    stages: [
      "Παραλαβή αίτησης & δικαιολογητικών",
      "Ιατρικές εξετάσεις (παθολόγος & οφθαλμίατρος)",
      "Καταβολή παραβόλων",
      "Κατάθεση στη Δ/νση Μεταφορών",
      "Παραλαβή & παράδοση νέου εντύπου",
    ],
    documents: [
      { name: "Ταυτότητα", mandatory: true },
      { name: "Ιατρικές βεβαιώσεις", mandatory: true },
      { name: "Παράβολα", mandatory: true },
      { name: "Φωτογραφίες", mandatory: true },
      { name: "Παλιά άδεια οδήγησης", mandatory: true },
    ],
  },
  {
    name: "Απώλεια άδειας οδήγησης",
    description: "Έκδοση αντιγράφου άδειας οδήγησης λόγω απώλειας",
    requiresVehicle: false,
    stages: [
      "Παραλαβή αίτησης & δικαιολογητικών",
      "Υπεύθυνη δήλωση απώλειας",
      "Καταβολή παραβόλων",
      "Κατάθεση στη Δ/νση Μεταφορών",
      "Παραλαβή & παράδοση νέου εντύπου",
    ],
    documents: [
      { name: "Υπεύθυνη δήλωση απώλειας", mandatory: true },
      { name: "Ταυτότητα", mandatory: true },
      { name: "Παράβολα", mandatory: true },
      { name: "Φωτογραφίες", mandatory: true },
    ],
  },
  {
    name: "Συμβόλαιο ΦΙΧ",
    description: "Έκδοση/σύνταξη συμβολαίου φορτηγού ιδιωτικής χρήσης",
    category: "TRUCK",
    requiresVehicle: true,
    stages: [
      "Παραλαβή δικαιολογητικών",
      "Έλεγχος δικαιώματος & δραστηριότητας",
      "Καταβολή τελών & εισφορών",
      "Κατάθεση & έκδοση συμβολαίου ΦΙΧ",
      "Παράδοση",
    ],
    documents: [
      { name: "Βεβαίωση έναρξης/δραστηριότητας", mandatory: true },
      { name: "Ταυτότητα & ΑΦΜ", mandatory: true },
      { name: "Στοιχεία οχήματος", mandatory: true },
      { name: "Παράβολα", mandatory: true },
    ],
  },
  {
    name: "Άλλο",
    description: "Υπόθεση εκτός προκαθορισμένων κατηγοριών — ελεύθερη συμπλήρωση",
    requiresVehicle: false,
    isFreeform: true,
    stages: [], // ο υπάλληλος προσθέτει στάδια ελεύθερα ανά υπόθεση
    documents: [],
  },
];

async function main() {
  // Στο Docker (πρώτη εκκίνηση) θέτουμε SEED_SKIP_IF_EXISTS=1 ώστε το seed
  // να τρέχει ΜΟΝΟ σε άδεια βάση — αλλιώς κάθε restart θα ξανάγραφε τα
  // στάδια/δικαιολογητικά, σβήνοντας τυχόν παραμετροποιήσεις του admin.
  if (process.env.SEED_SKIP_IF_EXISTS === "1") {
    const existing = await prisma.caseType.count();
    if (existing > 0) {
      console.log(
        `✓ Υπάρχουν ήδη ${existing} τύποι υποθέσεων — παράλειψη seed.`,
      );
      return;
    }
  }

  for (const t of caseTypes) {
    const caseType = await prisma.caseType.upsert({
      where: { name: t.name },
      update: {
        description: t.description,
        active: true,
        category: t.category ?? "OTHER",
        requiresVehicle: t.requiresVehicle,
        isFreeform: t.isFreeform ?? false,
        hasLicenseFee: t.fees?.includes("license") ?? false,
        hasCirculationTax: t.fees?.includes("circulation") ?? false,
        hasTransferFee: t.fees?.includes("transfer") ?? false,
        issuesPlates: t.issuesPlates ?? false,
        supportsImport: t.supportsImport ?? false,
      },
      create: {
        name: t.name,
        description: t.description,
        category: t.category ?? "OTHER",
        requiresVehicle: t.requiresVehicle,
        isFreeform: t.isFreeform ?? false,
        hasLicenseFee: t.fees?.includes("license") ?? false,
        hasCirculationTax: t.fees?.includes("circulation") ?? false,
        hasTransferFee: t.fees?.includes("transfer") ?? false,
        issuesPlates: t.issuesPlates ?? false,
        supportsImport: t.supportsImport ?? false,
      },
    });

    // Idempotent: καθαρίζουμε τα πρότυπα του τύπου και τα ξαναχτίζουμε.
    // (Οι υποθέσεις κρατούν snapshot, οπότε δεν χάνεται ιστορικό.)
    await prisma.stageTemplate.deleteMany({ where: { caseTypeId: caseType.id } });
    await prisma.docRequirement.deleteMany({ where: { caseTypeId: caseType.id } });

    await prisma.stageTemplate.createMany({
      data: t.stages.map((name, i) => ({
        caseTypeId: caseType.id,
        name,
        position: i + 1,
        isTerminal: i === t.stages.length - 1,
      })),
    });

    await prisma.docRequirement.createMany({
      data: t.documents.map((d) => ({
        caseTypeId: caseType.id,
        name: d.name,
        mandatory: d.mandatory,
        importOnly: d.importOnly ?? false,
      })),
    });

    console.log(
      `✓ ${t.name}: ${t.stages.length} στάδια, ${t.documents.length} δικαιολογητικά`,
    );
  }

  console.log(`\nΣύνολο: ${caseTypes.length} τύποι υποθέσεων`);

  // Αρχικός διαχειριστής — άλλαξε τον κωδικό μετά το πρώτο login.
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@vossos.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: "Διαχειριστής",
      role: "ADMIN",
      active: true,
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  console.log(`✓ Admin: ${adminEmail} (κωδικός: ${adminPassword})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
