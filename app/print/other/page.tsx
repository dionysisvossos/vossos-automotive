import { parseCaseFilterParams } from "@/lib/case-filters";
import { otherRows } from "@/lib/case-lists";
import PrintFrame from "../PrintFrame";

const dmy = (d: Date) =>
  new Date(d).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default async function OtherPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") usp.set(k, v);
  const params = parseCaseFilterParams(usp);
  const rows = await otherRows(params);

  return (
    <PrintFrame title="Λίστα Λοιπών Εργασιών" orientation="portrait" count={rows.length}>
      <table className="list">
        <thead>
          <tr>
            <th className="num">Α/Α</th>
            <th>Ημ/νία</th>
            <th>Τύπος εργασίας</th>
            <th>Προμηθευτής</th>
            <th>Πελάτης</th>
            <th>Όχημα</th>
            <th>Παράδοση</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.no}>
              <td className="num">{r.no}</td>
              <td>{dmy(r.date)}</td>
              <td>{r.type}</td>
              <td>{r.referrer}</td>
              <td>{r.client}</td>
              <td>{r.vehicle}</td>
              <td>{r.delivery}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="c" style={{ color: "#777" }}>
                Καμία εγγραφή για τα επιλεγμένα φίλτρα.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </PrintFrame>
  );
}
