import Link from "next/link";
import { notFound } from "next/navigation";
import type { CaseStageState, CaseState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { aitisiTemplateFor } from "@/lib/aitisi";
import PartyContactEditor from "./PartyContactEditor";
import {
  licenseFee,
  transferFee,
  circulationTax,
  BANK_COMMISSION,
} from "@/lib/vehicle-tax";
import {
  setFee,
  addExpense,
  deleteExpense,
  addPayment,
  deletePayment,
  addSuggestedExpenses,
} from "../financial-actions";
import {
  completeStage,
  skipStage,
  reopenStage,
  cancelCase,
  reopenCase,
  markFileComplete,
  unmarkFileComplete,
  setImport,
  setDelivery,
} from "../stage-actions";

const ROLE_LABELS: Record<string, string> = {
  SELLER: "Πωλητής",
  BUYER: "Αγοραστής",
  OWNER: "Κάτοχος",
  REFERRER: "Προμηθευτής",
};

const CASE_STATE_LABELS: Record<CaseState, string> = {
  OPEN: "Σε εξέλιξη",
  COMPLETED: "Ολοκληρωμένη",
  CANCELLED: "Ακυρωμένη",
};

const CASE_STATE_COLORS: Record<CaseState, string> = {
  OPEN: "var(--warning)",
  COMPLETED: "var(--success)",
  CANCELLED: "var(--danger)",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  LICENSE: "Τέλος άδειας",
  BANK: "Προμήθεια τράπεζας",
  CIRCULATION: "Τέλη κυκλοφορίας",
  TRANSFER: "Τέλος μεταβίβασης",
  TAX: "Τέλος",
  STAMP: "Παράβολο",
  KTEO: "ΚΤΕΟ",
  CUSTOMS: "Τελωνείο",
  OTHER: "Άλλο",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Μετρητά",
  CARD: "Κάρτα",
  TRANSFER: "Κατάθεση",
  OTHER: "Άλλο",
};

const eur = (n: number) =>
  n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " €";

const dmy = (d: Date) =>
  new Date(d).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const STAGE_STATE_LABELS: Record<CaseStageState, string> = {
  PENDING: "Εκκρεμεί",
  IN_PROGRESS: "Σε εξέλιξη",
  DONE: "Ολοκληρώθηκε",
  SKIPPED: "Παρακάμφθηκε",
};

const STAGE_STATE_COLORS: Record<CaseStageState, string> = {
  PENDING: "var(--text-muted)",
  IN_PROGRESS: "var(--warning)",
  DONE: "var(--success)",
  SKIPPED: "var(--text-muted)",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span>{value ?? "—"}</span>
    </div>
  );
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      caseType: true,
      vehicle: true,
      assignedUser: true,
      regionalService: true,
      parties: { include: { contact: true } },
      stages: { orderBy: { position: "asc" }, include: { completedBy: true } },
      documents: { include: { docRequirement: true }, orderBy: { uploadedAt: "desc" } },
      expenses: { orderBy: { incurredAt: "asc" } },
      payments: { orderBy: { receivedAt: "asc" } },
    },
  });

  if (!c) notFound();

  const fee = c.fee ? Number(c.fee) : 0;
  const urgentFee = c.urgentFee ? Number(c.urgentFee) : 0;
  const plateFee = c.plateFee ? Number(c.plateFee) : 0;
  const totalExpenses = c.expenses.reduce((s, e) => s + Number(e.amount), 0);
  // Χρέωση πελάτη: έξοδα (pass-through) + αμοιβή + επείγον + ειδική πινακίδα
  const totalCharged = totalExpenses + fee + urgentFee + plateFee;
  const totalPaid = c.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totalCharged - totalPaid;

  const PLATE_LABELS: Record<string, string> = {
    EVEN: "Ζυγό",
    ODD: "Μονό",
    SPECIAL: "Ειδικό",
  };

  // Προτεινόμενα έξοδα βάσει των flags του τύπου + στοιχείων οχήματος.
  const isMotorcycle = c.vehicle?.category === "MOTORCYCLE";
  const suggestions: string[] = [];
  if (c.caseType.hasLicenseFee) {
    suggestions.push(`Τέλος άδειας ${eur(licenseFee(isMotorcycle))}`);
    suggestions.push(`Προμήθεια τράπεζας ${eur(BANK_COMMISSION)}`);
  }
  if (c.caseType.hasTransferFee && c.vehicle?.cc) {
    suggestions.push(`Τέλος μεταβίβασης ${eur(transferFee(c.vehicle.cc))}`);
  }
  if (c.caseType.hasCirculationTax) {
    const circ = circulationTax(
      c.vehicle?.emissions ?? null,
      c.vehicle?.cc ?? null,
    );
    if (circ && circ.amount > 0)
      suggestions.push(`Τέλη κυκλοφορίας ${eur(circ.amount)}`);
  }

  const requirements = await prisma.docRequirement.findMany({
    where: { caseTypeId: c.caseTypeId },
    orderBy: [{ mandatory: "desc" }, { name: "asc" }],
  });

  // Τα δικαιολογητικά εισαγωγής εμφανίζονται μόνο όταν isImport.
  const visibleReqs = requirements.filter((r) => !r.importOnly || c.isImport);

  const uploadedReqIds = new Set(
    c.documents.map((d) => d.docRequirementId).filter(Boolean),
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div>
        <Link href="/cases" style={{ fontSize: 13 }}>
          ← Πίσω στις υποθέσεις
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>
              {c.code}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                · {c.caseType.name}
              </span>
            </span>
            {c.urgent && (
              <span
                className="badge"
                style={{
                  color: "var(--danger)",
                  borderColor: "var(--danger)",
                  fontWeight: 500,
                }}
              >
                Επείγον
              </span>
            )}
            <span
              className="badge"
              style={{ color: CASE_STATE_COLORS[c.state], fontWeight: 500 }}
            >
              {CASE_STATE_LABELS[c.state]}
            </span>
          </h1>
          {aitisiTemplateFor(c.caseType, c.isImport) && (
            <a
              href={`/api/cases/${c.id}/aitisi`}
              target="_blank"
              rel="noopener"
              className="btn btn-ghost"
              style={{ whiteSpace: "nowrap", fontSize: 14 }}
            >
              📄 Αίτηση (PDF)
            </a>
          )}
        </div>
      </div>

      <section
        className="card"
        style={{
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <Field
          label="Όχημα"
          value={
            c.vehicle
              ? [c.vehicle.make, c.vehicle.plate ?? c.vehicle.vin]
                  .filter(Boolean)
                  .join(" · ")
              : "—"
          }
        />
        {c.vehicle && (
          <Field
            label="Ρύποι (CO₂)"
            value={c.vehicle.emissions ? `${c.vehicle.emissions} g/km` : "—"}
          />
        )}
        {c.vehicle && (
          <Field
            label="Κυβικά"
            value={c.vehicle.cc ? `${c.vehicle.cc} cc` : "—"}
          />
        )}
        {c.vehicle && (
          <Field
            label="Παρακράτηση κυριότητας"
            value={c.vehicle.hasOwnershipRetention ? "Ναι" : "Όχι"}
          />
        )}
        {c.platePreference && (
          <Field
            label="Πινακίδες"
            value={
              PLATE_LABELS[c.platePreference] +
              (c.plateRequest ? ` (${c.plateRequest})` : "")
            }
          />
        )}
        <Field
          label="Καταχωρήθηκε"
          value={new Date(c.openedAt).toLocaleDateString("el-GR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        />
        <Field label="Υπεύθυνος" value={c.assignedUser?.fullName} />
        <Field label="Υπηρεσία περιφέρειας" value={c.regionalService?.name} />
        <form action={setDelivery} style={{ display: "grid", gap: 4 }}>
          <input type="hidden" name="caseId" value={c.id} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Παράδοση</span>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              name="delivery"
              defaultValue={c.delivery ?? ""}
              placeholder="—"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn btn-ghost" type="submit" title="Αποθήκευση">
              ✓
            </button>
          </div>
        </form>
        <Field
          label="Υπόλοιπο"
          value={
            <span
              style={{
                color: balance > 0 ? "var(--danger)" : "var(--success)",
                fontWeight: 500,
              }}
            >
              {eur(balance)}
            </span>
          }
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Εμπλεκόμενοι</h2>
          {c.parties.length === 0 && (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>—</p>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {c.parties.map((p) => (
              <PartyContactEditor
                key={p.id}
                caseId={c.id}
                roleLabel={ROLE_LABELS[p.role] ?? p.role}
                contact={p.contact}
              />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Δικαιολογητικά</h2>
            <div
              style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              {c.caseType.supportsImport && c.state !== "CANCELLED" && (
                <form action={setImport}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <input type="hidden" name="value" value={c.isImport ? "0" : "1"} />
                  <button
                    className={c.isImport ? "btn" : "btn btn-ghost"}
                    type="submit"
                  >
                    {c.isImport ? "Εισαγωγή ✓" : "Εισαγωγή από εξωτερικό"}
                  </button>
                </form>
              )}
              {visibleReqs.length > 0 &&
                (c.documentsComplete ? (
                  <form action={unmarkFileComplete}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <span
                      className="badge"
                      style={{
                        color: "var(--success)",
                        borderColor: "var(--success)",
                        marginRight: 6,
                      }}
                    >
                      ✓ Πλήρης φάκελος
                    </span>
                    <button className="btn btn-ghost" type="submit">
                      Αναίρεση
                    </button>
                  </form>
                ) : (
                  c.state !== "CANCELLED" && (
                    <form action={markFileComplete}>
                      <input type="hidden" name="caseId" value={c.id} />
                      <button className="btn" type="submit">
                        Πλήρης φάκελος
                      </button>
                    </form>
                  )
                ))}
            </div>
          </div>
          {visibleReqs.length === 0 && (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              Ελεύθερη συμπλήρωση (τύπος χωρίς προκαθορισμένα).
            </p>
          )}
          <div style={{ display: "grid", gap: 6 }}>
            {visibleReqs.map((r) => {
              const done = c.documentsComplete || uploadedReqIds.has(r.id);
              return (
                <div
                  key={r.id}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    {r.name}
                    {r.mandatory && (
                      <span style={{ color: "var(--danger)" }}> *</span>
                    )}
                  </span>
                  <span style={{ color: done ? "var(--success)" : "var(--text-muted)" }}>
                    {done ? "✓" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="financials"
        className="card"
        style={{ padding: 18, display: "grid", gap: 16, scrollMarginTop: 70 }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Οικονομικά</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
          }}
        >
          <Field label="Αμοιβή" value={eur(fee)} />
          {urgentFee > 0 && <Field label="Επείγον" value={eur(urgentFee)} />}
          {plateFee > 0 && (
            <Field label="Ειδική πινακίδα" value={eur(plateFee)} />
          )}
          <Field label="Σύνολο εξόδων" value={eur(totalExpenses)} />
          <Field label="Χρέωση πελάτη" value={eur(totalCharged)} />
          <Field label="Εισπραχθέν" value={eur(totalPaid)} />
          <Field
            label="Υπόλοιπο"
            value={
              <span
                style={{
                  color: balance > 0 ? "var(--danger)" : "var(--success)",
                  fontWeight: 500,
                }}
              >
                {eur(balance)}
              </span>
            }
          />
        </div>

        <form
          action={setFee}
          style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
        >
          <input type="hidden" name="caseId" value={c.id} />
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            Αμοιβή (€)
            <input
              name="fee"
              inputMode="decimal"
              defaultValue={c.fee ? Number(c.fee).toString() : ""}
              style={{ width: 120 }}
            />
          </label>
          {c.urgent && (
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Επείγον (€)
              <input
                name="urgentFee"
                inputMode="decimal"
                defaultValue={c.urgentFee ? Number(c.urgentFee).toString() : ""}
                style={{ width: 120 }}
              />
            </label>
          )}
          {c.platePreference === "SPECIAL" && (
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              Ειδική πινακίδα (€)
              <input
                name="plateFee"
                inputMode="decimal"
                defaultValue={c.plateFee ? Number(c.plateFee).toString() : ""}
                style={{ width: 120 }}
              />
            </label>
          )}
          <button className="btn btn-ghost" type="submit">
            Αποθήκευση χρεώσεων
          </button>
        </form>

        {suggestions.length > 0 && (
          <form
            action={addSuggestedExpenses}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
            }}
          >
            <input type="hidden" name="caseId" value={c.id} />
            <button className="btn" type="submit">
              + Προτεινόμενα έξοδα
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {suggestions.join(" · ")}
            </span>
          </form>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {/* Έξοδα */}
          <div style={{ display: "grid", gap: 8 }}>
            <strong style={{ fontWeight: 500 }}>Έξοδα (χρεώνονται στον πελάτη)</strong>
            {c.expenses.length === 0 && (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>—</p>
            )}
            {c.expenses.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 4,
                }}
              >
                <span style={{ flex: 1, fontSize: 14 }}>
                  {dmy(e.incurredAt)} · {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                  {e.description ? ` · ${e.description}` : ""}
                </span>
                <span style={{ fontWeight: 500 }}>{eur(Number(e.amount))}</span>
                <form action={deleteExpense}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn btn-ghost" type="submit" title="Διαγραφή">
                    ✕
                  </button>
                </form>
              </div>
            ))}
            <form action={addExpense} style={{ display: "grid", gap: 6 }}>
              <input type="hidden" name="caseId" value={c.id} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select name="type" defaultValue="LICENSE">
                  <option value="LICENSE">Τέλος άδειας</option>
                  <option value="BANK">Προμήθεια τράπεζας</option>
                  <option value="CIRCULATION">Τέλη κυκλοφορίας</option>
                  <option value="TRANSFER">Τέλος μεταβίβασης</option>
                  <option value="STAMP">Παράβολο</option>
                  <option value="KTEO">ΚΤΕΟ</option>
                  <option value="CUSTOMS">Τελωνείο</option>
                  <option value="TAX">Άλλο τέλος</option>
                  <option value="OTHER">Άλλο</option>
                </select>
                <input
                  name="amount"
                  placeholder="Ποσό €"
                  inputMode="decimal"
                  style={{ width: 90 }}
                  required
                />
                <button className="btn" type="submit">
                  + Έξοδο
                </button>
              </div>
              <input name="description" placeholder="Περιγραφή (προαιρετικά)" />
            </form>
          </div>

          {/* Εισπράξεις */}
          <div style={{ display: "grid", gap: 8 }}>
            <strong style={{ fontWeight: 500 }}>Εισπράξεις από πελάτη</strong>
            {c.payments.length === 0 && (
              <p style={{ color: "var(--text-muted)", margin: 0 }}>—</p>
            )}
            {c.payments.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 4,
                }}
              >
                <span style={{ flex: 1, fontSize: 14 }}>
                  {dmy(p.receivedAt)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span style={{ fontWeight: 500, color: "var(--success)" }}>
                  {eur(Number(p.amount))}
                </span>
                <form action={deletePayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-ghost" type="submit" title="Διαγραφή">
                    ✕
                  </button>
                </form>
              </div>
            ))}
            <form action={addPayment} style={{ display: "grid", gap: 6 }}>
              <input type="hidden" name="caseId" value={c.id} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <select name="method" defaultValue="CASH">
                  <option value="CASH">Μετρητά</option>
                  <option value="CARD">Κάρτα</option>
                  <option value="TRANSFER">Κατάθεση</option>
                  <option value="OTHER">Άλλο</option>
                </select>
                <input
                  name="amount"
                  placeholder="Ποσό €"
                  inputMode="decimal"
                  style={{ width: 90 }}
                  required
                />
                <button className="btn" type="submit">
                  + Είσπραξη
                </button>
              </div>
              <input name="note" placeholder="Σημείωση (προαιρετικά)" />
            </form>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Στάδια</h2>
          {c.state === "CANCELLED" ? (
            <form action={reopenCase}>
              <input type="hidden" name="caseId" value={c.id} />
              <button className="btn btn-ghost" type="submit">
                Επαναφορά υπόθεσης
              </button>
            </form>
          ) : (
            <form action={cancelCase}>
              <input type="hidden" name="caseId" value={c.id} />
              <button
                className="btn btn-ghost"
                type="submit"
                style={{ color: "var(--danger)" }}
              >
                Ακύρωση υπόθεσης
              </button>
            </form>
          )}
        </div>

        {c.stages.length === 0 && (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Δεν έχουν οριστεί στάδια.
          </p>
        )}
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {c.stages.map((s) => {
            const isCurrent = c.currentStageId === s.id;
            const canAct = c.state !== "CANCELLED";
            return (
              <li
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--border)",
                  background: isCurrent ? "#eef3fb" : undefined,
                  borderRadius: isCurrent ? "var(--radius)" : undefined,
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `1px solid ${STAGE_STATE_COLORS[s.state]}`,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    color: STAGE_STATE_COLORS[s.state],
                    flexShrink: 0,
                  }}
                >
                  {s.state === "DONE" ? "✓" : s.position}
                </span>
                <div style={{ flex: 1 }}>
                  <div>{s.name}</div>
                  {s.completedAt && s.completedBy && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {dmy(s.completedAt)} · {s.completedBy.fullName}
                    </div>
                  )}
                </div>
                <span
                  className="badge"
                  style={{ color: STAGE_STATE_COLORS[s.state] }}
                >
                  {STAGE_STATE_LABELS[s.state]}
                </span>
                {canAct && s.state === "IN_PROGRESS" && (
                  <>
                    <form action={completeStage}>
                      <input type="hidden" name="caseId" value={c.id} />
                      <input type="hidden" name="stageId" value={s.id} />
                      <button className="btn" type="submit">
                        Ολοκλήρωση
                      </button>
                    </form>
                    <form action={skipStage}>
                      <input type="hidden" name="caseId" value={c.id} />
                      <input type="hidden" name="stageId" value={s.id} />
                      <button className="btn btn-ghost" type="submit">
                        Παράκαμψη
                      </button>
                    </form>
                  </>
                )}
                {canAct && (s.state === "DONE" || s.state === "SKIPPED") && (
                  <form action={reopenStage}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="stageId" value={s.id} />
                    <button className="btn btn-ghost" type="submit">
                      Επαναφορά
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
