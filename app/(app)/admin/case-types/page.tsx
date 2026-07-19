import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCaseType } from "../actions";

export default async function CaseTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const caseTypes = await prisma.caseType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { stageTemplates: true, docRequirements: true, cases: true } },
    },
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Τύποι υποθέσεων</h1>

      {error === "inuse" && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          Ο τύπος δεν διαγράφεται γιατί υπάρχουν υποθέσεις που τον χρησιμοποιούν.
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Όνομα</th>
              <th>Όχημα</th>
              <th>Ελεύθερο</th>
              <th>Στάδια</th>
              <th>Δικαιολογητικά</th>
              <th>Υποθέσεις</th>
              <th>Ενεργός</th>
            </tr>
          </thead>
          <tbody>
            {caseTypes.map((ct) => (
              <tr key={ct.id}>
                <td>
                  <Link href={`/admin/case-types/${ct.id}`}>{ct.name}</Link>
                </td>
                <td>{ct.requiresVehicle ? "Ναι" : "—"}</td>
                <td>{ct.isFreeform ? "Ναι" : "—"}</td>
                <td>{ct._count.stageTemplates}</td>
                <td>{ct._count.docRequirements}</td>
                <td>{ct._count.cases}</td>
                <td>{ct.active ? "Ναι" : "Όχι"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={createCaseType}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Νέος τύπος</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Όνομα
          <input name="name" required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Περιγραφή
          <input name="description" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Κατηγορία
          <select name="category" defaultValue="OTHER">
            <option value="REGISTRATION">Ταξινόμηση</option>
            <option value="TRANSFER">Μεταβίβαση</option>
            <option value="TRUCK">ΦΙΧ</option>
            <option value="OTHER">Λοιπές</option>
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="requiresVehicle" defaultChecked />
          Αφορά όχημα
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="isFreeform" />
          Ελεύθερη συμπλήρωση (χωρίς σταθερά στάδια)
        </label>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>
          Δημιουργία
        </button>
      </form>
    </div>
  );
}
