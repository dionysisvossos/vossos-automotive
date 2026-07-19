import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateCaseType,
  deleteCaseType,
  addStage,
  renameStage,
  moveStage,
  toggleStageTerminal,
  deleteStage,
  addDocRequirement,
  toggleDocMandatory,
  deleteDocRequirement,
} from "../../actions";

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 0",
  borderBottom: "1px solid var(--border)",
};

export default async function CaseTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ct = await prisma.caseType.findUnique({
    where: { id },
    include: {
      stageTemplates: { orderBy: { position: "asc" } },
      docRequirements: { orderBy: { name: "asc" } },
    },
  });
  if (!ct) notFound();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <Link href="/admin/case-types" style={{ fontSize: 13 }}>
          ← Πίσω στους τύπους
        </Link>
        <h1 style={{ margin: "8px 0 0", fontSize: 20 }}>{ct.name}</h1>
      </div>

      {/* Βασικά στοιχεία */}
      <form
        action={updateCaseType}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 560 }}
      >
        <input type="hidden" name="id" value={ct.id} />
        <h2 style={{ margin: 0, fontSize: 16 }}>Στοιχεία τύπου</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Όνομα
          <input name="name" defaultValue={ct.name} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Περιγραφή
          <input name="description" defaultValue={ct.description ?? ""} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Κατηγορία
          <select name="category" defaultValue={ct.category}>
            <option value="REGISTRATION">Ταξινόμηση</option>
            <option value="TRANSFER">Μεταβίβαση</option>
            <option value="TRUCK">ΦΙΧ</option>
            <option value="OTHER">Λοιπές</option>
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="requiresVehicle"
            defaultChecked={ct.requiresVehicle}
          />
          Αφορά όχημα
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="isFreeform" defaultChecked={ct.isFreeform} />
          Ελεύθερη συμπλήρωση
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="active" defaultChecked={ct.active} />
          Ενεργός
        </label>

        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Προτεινόμενα τέλη (κουμπί «Προτεινόμενα έξοδα»)
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="hasLicenseFee"
            defaultChecked={ct.hasLicenseFee}
          />
          Τέλος άδειας (75€ / 9€ μοτο)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="hasTransferFee"
            defaultChecked={ct.hasTransferFee}
          />
          Τέλος μεταβίβασης (βάσει cc)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="hasCirculationTax"
            defaultChecked={ct.hasCirculationTax}
          />
          Τέλη κυκλοφορίας (ρύποι / cc)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="issuesPlates"
            defaultChecked={ct.issuesPlates}
          />
          Εκδίδονται πινακίδες (ζυγό/μονό/ειδικό)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="supportsImport"
            defaultChecked={ct.supportsImport}
          />
          Υποστηρίζει εισαγωγή (toggle «Εισαγωγή από εξωτερικό»)
        </label>

        <button className="btn" type="submit" style={{ justifySelf: "start" }}>
          Αποθήκευση
        </button>
      </form>

      {/* Στάδια */}
      <section className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Στάδια</h2>
        {ct.stageTemplates.length === 0 && (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Κανένα στάδιο.</p>
        )}
        <div>
          {ct.stageTemplates.map((s, i) => (
            <div key={s.id} style={rowStyle}>
              <span style={{ width: 22, color: "var(--text-muted)" }}>
                {s.position}
              </span>
              <form
                action={renameStage}
                style={{ flex: 1, display: "flex", gap: 6 }}
              >
                <input type="hidden" name="id" value={s.id} />
                <input name="name" defaultValue={s.name} style={{ flex: 1 }} />
                <button className="btn btn-ghost" type="submit">
                  ✓
                </button>
              </form>
              <form action={moveStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="up" />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  disabled={i === 0}
                  title="Πάνω"
                >
                  ↑
                </button>
              </form>
              <form action={moveStage}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="dir" value="down" />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  disabled={i === ct.stageTemplates.length - 1}
                  title="Κάτω"
                >
                  ↓
                </button>
              </form>
              <form action={toggleStageTerminal}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  title="Τελικό στάδιο"
                  style={{ color: s.isTerminal ? "var(--success)" : undefined }}
                >
                  {s.isTerminal ? "Τελικό ✓" : "Τελικό"}
                </button>
              </form>
              <form action={deleteStage}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn btn-ghost" type="submit" title="Διαγραφή">
                  ✕
                </button>
              </form>
            </div>
          ))}
        </div>
        <form action={addStage} style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input type="hidden" name="caseTypeId" value={ct.id} />
          <input name="name" placeholder="Νέο στάδιο…" style={{ flex: 1 }} />
          <button className="btn" type="submit">
            Προσθήκη
          </button>
        </form>
      </section>

      {/* Δικαιολογητικά */}
      <section className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Δικαιολογητικά</h2>
        {ct.docRequirements.length === 0 && (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Κανένα.</p>
        )}
        <div>
          {ct.docRequirements.map((d) => (
            <div key={d.id} style={rowStyle}>
              <span style={{ flex: 1 }}>{d.name}</span>
              <form action={toggleDocMandatory}>
                <input type="hidden" name="id" value={d.id} />
                <button
                  className="btn btn-ghost"
                  type="submit"
                  style={{ color: d.mandatory ? "var(--danger)" : undefined }}
                >
                  {d.mandatory ? "Υποχρεωτικό" : "Προαιρετικό"}
                </button>
              </form>
              <form action={deleteDocRequirement}>
                <input type="hidden" name="id" value={d.id} />
                <button className="btn btn-ghost" type="submit" title="Διαγραφή">
                  ✕
                </button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={addDocRequirement}
          style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}
        >
          <input type="hidden" name="caseTypeId" value={ct.id} />
          <input name="name" placeholder="Νέο δικαιολογητικό…" style={{ flex: 1 }} />
          <label
            style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}
          >
            <input type="checkbox" name="mandatory" defaultChecked />
            Υποχρεωτικό
          </label>
          <button className="btn" type="submit">
            Προσθήκη
          </button>
        </form>
      </section>

      {/* Διαγραφή τύπου */}
      <form action={deleteCaseType}>
        <input type="hidden" name="id" value={ct.id} />
        <button
          className="btn btn-ghost"
          type="submit"
          style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          Διαγραφή τύπου
        </button>
      </form>
    </div>
  );
}
