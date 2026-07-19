// Τέλη/παράβολα 2026 (πηγές: govupdate.gr + στοιχεία πελάτη — προς επιβεβαίωση).
// Πάγιο τέλος άδειας: 75€ (αυτοκίνητα/φορτηγά), 9€ (μοτοσυκλέτες).
export const LICENSE_FEE = 75;
export const LICENSE_FEE_MOTORCYCLE = 9;
// Προμήθεια τράπεζας για το e-παράβολο του τέλους άδειας.
export const BANK_COMMISSION = 0.3;

export function licenseFee(isMotorcycle: boolean): number {
  return isMotorcycle ? LICENSE_FEE_MOTORCYCLE : LICENSE_FEE;
}

// Τέλος μεταβίβασης μεταχειρισμένου — σταθερό ποσό ανά κλιμάκιο κυβικών.
const TRANSFER_BRACKETS: { max: number; amount: number }[] = [
  { max: 400, amount: 30 },
  { max: 800, amount: 45 },
  { max: 1300, amount: 60 },
  { max: 1600, amount: 90 },
  { max: 1900, amount: 120 },
  { max: 2500, amount: 145 },
  { max: Infinity, amount: 205 },
];

export function transferFee(cc: number): number {
  if (cc < 51) return 0;
  return TRANSFER_BRACKETS.find((x) => cc <= x.max)!.amount;
}

// Οχήματα ταξινομημένα μετά 1/11/2010 — τέλη κυκλοφορίας βάσει ρύπων CO₂ (g/km).
// Φόρος = σύνολο γραμμαρίων × συντελεστής κλιμακίου.
const EMISSIONS_BRACKETS: { max: number; rate: number }[] = [
  { max: 90, rate: 0 },
  { max: 100, rate: 0.9 },
  { max: 120, rate: 0.98 },
  { max: 140, rate: 1.2 },
  { max: 160, rate: 1.85 },
  { max: 180, rate: 2.45 },
  { max: 200, rate: 2.78 },
  { max: 250, rate: 3.05 },
  { max: Infinity, rate: 3.72 },
];

// Οχήματα έως 31/10/2010 — τέλη κυκλοφορίας βάσει κυβικών (cc).
const CC_BRACKETS: { max: number; amount: number }[] = [
  { max: 300, amount: 22 },
  { max: 785, amount: 55 },
  { max: 1071, amount: 120 },
  { max: 1357, amount: 135 },
  { max: 1548, amount: 255 },
  { max: 1738, amount: 280 },
  { max: 1928, amount: 320 },
  { max: 2357, amount: 690 },
  { max: 3000, amount: 920 },
  { max: 4000, amount: 1150 },
  { max: Infinity, amount: 1380 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emissionsTax(emissions: number): number {
  if (emissions <= 0) return 0;
  const b = EMISSIONS_BRACKETS.find((x) => emissions <= x.max)!;
  return round2(emissions * b.rate);
}

export function ccCirculationTax(cc: number): number {
  if (cc <= 0) return 0;
  return CC_BRACKETS.find((x) => cc <= x.max)!.amount;
}

// Τέλη κυκλοφορίας: ρύποι αν υπάρχουν, αλλιώς κυβικά. null αν κανένα.
export function circulationTax(
  emissions: number | null,
  cc: number | null,
): { amount: number; basis: "emissions" | "cc" } | null {
  if (emissions != null) return { amount: emissionsTax(emissions), basis: "emissions" };
  if (cc != null) return { amount: ccCirculationTax(cc), basis: "cc" };
  return null;
}
