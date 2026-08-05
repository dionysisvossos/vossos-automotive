// Δημιουργία CSV για ελληνικό Excel: διαχωριστικό ";" και υποδιαστολή ",".
const DELIM = ";";

// UTF-8 BOM — χωρίς αυτό το Excel δείχνει τα ελληνικά αλαμπουρνέζικα.
export const CSV_BOM = "﻿";

function escape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Αριθμός με υποδιαστολή κόμμα, ώστε το ελληνικό Excel να τον διαβάζει ως αριθμό.
export function csvNumber(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function csvDate(d: Date): string {
  return new Date(d).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escape).join(DELIM)];
  for (const r of rows) lines.push(r.map(escape).join(DELIM));
  return lines.join("\r\n");
}

// Κοινές επικεφαλίδες απόκρισης για κατέβασμα αρχείου.
export function csvResponse(csv: string, filename: string): Response {
  return new Response(CSV_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
