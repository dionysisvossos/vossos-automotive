import { parseCaseFilterParams } from "@/lib/case-filters";
import { registrationRows } from "@/lib/case-lists";
import PrintFrame from "../PrintFrame";

const dmy = (d: Date) =>
  new Date(d).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const money = (n: number) =>
  n > 0
    ? n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

export default async function RegistrationsPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") usp.set(k, v);
  const params = parseCaseFilterParams(usp);
  const rows = await registrationRows(params);

  return (
    <PrintFrame title="Λίστα Ταξινομήσεων" orientation="landscape" count={rows.length}>
      <table className="list">
        <thead>
          <tr>
            <th className="num">Α/Α</th>
            <th>Ημ/νία</th>
            <th>Προμηθευτής</th>
            <th>Αγοραστής</th>
            <th>Παράδοση</th>
            <th className="num">Παράβολο</th>
            <th className="num">Τέλη κυκλ.</th>
            <th className="num">Ρύποι</th>
            <th className="c">Επείγον</th>
            <th>Αρ. κυκλ.</th>
            <th>Πλαίσιο</th>
            <th>Πινακίδα</th>
            <th className="c">Παρακρ.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no} className={r.urgent ? "urgent" : undefined}>
              <td className="num">{r.no}</td>
              <td>{dmy(r.date)}</td>
              <td>{r.referrer}</td>
              <td>{r.buyer}</td>
              <td>{r.delivery}</td>
              <td className="num">{money(r.parvolo)}</td>
              <td className="num">{money(r.circulation)}</td>
              <td className="num">{r.emissions ?? ""}</td>
              <td className="c">{r.urgent ? "ΝΑΙ" : ""}</td>
              <td>{r.regNo}</td>
              <td>{r.vin}</td>
              <td>{r.platePref}</td>
              <td className="c">{r.retention ? "ΝΑΙ" : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={13} className="c" style={{ color: "#777" }}>
                Καμία εγγραφή για τα επιλεγμένα φίλτρα.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </PrintFrame>
  );
}
