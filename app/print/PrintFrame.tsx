import PrintButton from "./PrintButton";

// Κοινό «έγγραφο» εκτύπωσης: στυλ, μπάρα εργαλείων (κρύβεται στην εκτύπωση),
// τίτλος και το περιεχόμενο (πίνακας). Η προσανατολισμός (portrait/landscape)
// ορίζεται ανά σελίδα, αφού κάθε λίστα είναι ξεχωριστό έγγραφο/route.
export default function PrintFrame({
  title,
  orientation,
  count,
  children,
}: {
  title: string;
  orientation: "portrait" | "landscape";
  count: number;
  children: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const css = `
    @page { size: A4 ${orientation}; margin: 10mm; }
    html, body { background: #fff; color: #000; }
    .print-doc {
      font-family: system-ui, "Segoe UI", Arial, sans-serif;
      color: #111;
      padding: 16px;
    }
    .print-doc h1 { font-size: 18px; margin: 0 0 2px; }
    .print-doc .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
    table.list { border-collapse: collapse; width: 100%; }
    table.list th, table.list td {
      border: 1px solid #555; padding: 3px 6px; font-size: 11px;
      text-align: left; vertical-align: top;
    }
    table.list th { background: #eee; font-weight: 600; }
    table.list td.num, table.list th.num { text-align: right; white-space: nowrap; }
    table.list td.c, table.list th.c { text-align: center; }
    table.list tr.urgent td { background: #fff3f2; }
    .toolbar {
      display: flex; gap: 12px; align-items: center;
      margin-bottom: 14px; flex-wrap: wrap;
    }
    @media screen {
      body { background: #f4f5f7; }
      .print-doc {
        max-width: ${orientation === "landscape" ? "1180px" : "820px"};
        margin: 18px auto; background: #fff;
        border: 1px solid #ddd; border-radius: 8px;
      }
    }
    @media print { .no-print { display: none !important; } }
  `;

  return (
    <div className="print-doc">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="toolbar no-print">
        <PrintButton />
        <span style={{ fontSize: 13, color: "#555" }}>
          {count} εγγραφές · {today}
        </span>
        <a href="/cases" style={{ fontSize: 13 }}>
          ← Πίσω στις υποθέσεις
        </a>
      </div>
      <h1>{title}</h1>
      <div className="meta">Ημερομηνία εκτύπωσης: {today} · Σύνολο: {count}</div>
      {children}
    </div>
  );
}
