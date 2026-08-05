"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCase, type CreateCaseInput } from "../actions";
import { aitisiTemplateFor } from "@/lib/aitisi-template";
import PartyRow, { type PartyValue } from "./PartyRow";

type CaseTypeOption = {
  id: string;
  name: string;
  category: string;
  requiresVehicle: boolean;
  isFreeform: boolean;
  issuesPlates: boolean;
  supportsImport: boolean;
};

// "12,50" ή "12.50" → number· undefined αν κενό/άκυρο.
const parseAmount = (s: string): number | undefined => {
  const v = s.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined;
};

type Lookup = { id: string; name: string };

const CATEGORY_BUTTONS = [
  { value: "REGISTRATION", label: "Ταξινόμηση" },
  { value: "TRANSFER", label: "Μεταβίβαση" },
  { value: "TRUCK", label: "ΦΙΧ" },
  { value: "OTHER", label: "Λοιπές" },
] as const;

const ROLE_OPTIONS = [
  { value: "BUYER", label: "Αγοραστής" },
  { value: "SELLER", label: "Πωλητής" },
  { value: "OWNER", label: "Κάτοχος" },
] as const;

const CONTACT_TYPE_OPTIONS = [
  { value: "PERSON", label: "Φυσικό πρόσωπο" },
  { value: "COMPANY", label: "Νομικό πρόσωπο" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "PASSENGER", label: "Επιβατικό" },
  { value: "TRUCK", label: "Φορτηγό" },
  { value: "MOTORCYCLE", label: "Δίκυκλο" },
  { value: "BUS", label: "Λεωφορείο" },
  { value: "TRAILER", label: "Ρυμουλκούμενο" },
  { value: "OTHER", label: "Άλλο" },
] as const;

const CONDITION_OPTIONS = [
  { value: "NEW", label: "Καινούργιο" },
  { value: "USED", label: "Μεταχειρισμένο" },
] as const;

const emptyParty: PartyValue = {
  role: "BUYER",
  contactType: "PERSON",
  lastName: "",
  firstName: "",
  fatherName: "",
  afm: "",
  idNumber: "",
  phone: "",
  email: "",
  address: "",
};

const emptyReferrer: PartyValue = { ...emptyParty, role: "REFERRER" };

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 13,
  color: "var(--text-muted)",
};

// Accent/case-insensitive έλεγχος για την «ανάριθμη» μεταβίβαση.
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function NewCaseForm({
  caseTypes,
  regionalServices,
}: {
  caseTypes: CaseTypeOption[];
  regionalServices: Lookup[];
}) {
  const typesOf = (cat: string) => caseTypes.filter((t) => t.category === cat);

  const registrationTypes = typesOf("REGISTRATION");
  const transferTypes = typesOf("TRANSFER");
  const truckTypes = typesOf("TRUCK");
  const otherTypes = typesOf("OTHER");

  const anarithmiType = registrationTypes.find((t) =>
    norm(t.name).includes("αριθμ"),
  );
  const registrationBase =
    registrationTypes.find((t) => t !== anarithmiType) ?? registrationTypes[0];

  const availableCategories = CATEGORY_BUTTONS.filter(
    (b) => typesOf(b.value).length > 0,
  );
  const initialCategory =
    availableCategories.find((c) => c.value === "REGISTRATION")?.value ??
    availableCategories[0]?.value ??
    "OTHER";

  const [category, setCategory] = useState<string>(initialCategory);
  const [anarithmi, setAnarithmi] = useState(false);
  const [isImport, setIsImport] = useState(false);
  const [subTypeId, setSubTypeId] = useState("");

  const [regionalServiceId, setRegionalServiceId] = useState("");
  const [delivery, setDelivery] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [urgentFee, setUrgentFee] = useState("");
  const [platePref, setPlatePref] = useState(""); // "" | EVEN | ODD | SPECIAL
  const [plateRequest, setPlateRequest] = useState("");
  const [plateFee, setPlateFee] = useState("");
  const [notes, setNotes] = useState("");

  const [vehCategory, setVehCategory] = useState("PASSENGER");
  const [condition, setCondition] = useState("USED");
  const [vin, setVin] = useState("");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [emissions, setEmissions] = useState("");
  const [cc, setCc] = useState("");
  const [hasOwnershipRetention, setHasOwnershipRetention] = useState(false);

  const [parties, setParties] = useState<PartyValue[]>([{ ...emptyParty }]);
  const [referrer, setReferrer] = useState<PartyValue>({ ...emptyReferrer });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Όταν αλλάζει κατηγορία, μηδένισε το dropdown (ΦΙΧ/Λοιπές).
  useEffect(() => {
    const list = category === "TRUCK" ? truckTypes : otherTypes;
    setSubTypeId(list[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const caseTypeId = useMemo(() => {
    if (category === "REGISTRATION") {
      return (anarithmi ? anarithmiType?.id : registrationBase?.id) ?? "";
    }
    if (category === "TRANSFER") return transferTypes[0]?.id ?? "";
    const list = category === "TRUCK" ? truckTypes : otherTypes;
    return subTypeId && list.some((t) => t.id === subTypeId)
      ? subTypeId
      : (list[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, anarithmi, subTypeId]);

  const selectedType = caseTypes.find((t) => t.id === caseTypeId);
  const requiresVehicle = selectedType?.requiresVehicle ?? false;

  // Έχει αυτός ο τύπος διαθέσιμη αίτηση; (για το κουμπί «Δημιουργία & Αίτηση»)
  const effectiveImport = (selectedType?.supportsImport ?? false) && isImport;
  const hasAitisi = selectedType
    ? aitisiTemplateFor(
        {
          category: selectedType.category,
          issuesPlates: selectedType.issuesPlates,
          name: selectedType.name,
        },
        effectiveImport,
      ) !== null
    : false;

  function updateParty(i: number, patch: Partial<PartyValue>) {
    setParties((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  }

  function submit(withAitisi = false) {
    setError(null);
    if (!caseTypeId) {
      setError("Επίλεξε τύπο υπόθεσης.");
      return;
    }

    type Vehicle = NonNullable<CreateCaseInput["vehicle"]>;
    type Party = CreateCaseInput["parties"][number];
    type Ref = NonNullable<CreateCaseInput["referrer"]>;

    const hasReferrer = !!(referrer.contactId || referrer.lastName.trim());

    type Plate = NonNullable<CreateCaseInput["platePreference"]>;
    const showPlates = selectedType?.issuesPlates ?? false;

    const input: CreateCaseInput = {
      caseTypeId,
      urgent,
      isImport: selectedType?.supportsImport ? isImport : false,
      urgentFee: urgent ? parseAmount(urgentFee) : undefined,
      platePreference:
        showPlates && platePref ? (platePref as Plate) : undefined,
      plateRequest:
        showPlates && platePref === "SPECIAL"
          ? plateRequest.trim() || undefined
          : undefined,
      plateFee:
        showPlates && platePref === "SPECIAL"
          ? parseAmount(plateFee)
          : undefined,
      regionalServiceId: regionalServiceId || undefined,
      delivery: delivery.trim() || undefined,
      notes: notes.trim() || undefined,
      vehicle: requiresVehicle
        ? {
            category: vehCategory as Vehicle["category"],
            condition: condition as Vehicle["condition"],
            vin: vin.trim() || undefined,
            plate: plate.trim() || undefined,
            make: make.trim() || undefined,
            emissions: /^\d+$/.test(emissions.trim())
              ? Number(emissions.trim())
              : undefined,
            cc: /^\d+$/.test(cc.trim()) ? Number(cc.trim()) : undefined,
            hasOwnershipRetention,
          }
        : undefined,
      parties: parties.map((p) => ({
        role: p.role as Party["role"],
        contactId: p.contactId || undefined,
        contactType: p.contactType as Party["contactType"],
        lastName: p.lastName.trim(),
        firstName: p.firstName.trim() || undefined,
        fatherName: p.fatherName.trim() || undefined,
        afm: p.afm.trim() || undefined,
        idNumber: p.idNumber.trim() || undefined,
        phone: p.phone.trim() || undefined,
        email: p.email.trim() || undefined,
        address: p.address.trim() || undefined,
      })),
      referrer: hasReferrer
        ? {
            contactId: referrer.contactId || undefined,
            contactType: referrer.contactType as Ref["contactType"],
            lastName: referrer.lastName.trim(),
            firstName: referrer.firstName.trim() || undefined,
            afm: referrer.afm.trim() || undefined,
            idNumber: referrer.idNumber.trim() || undefined,
            phone: referrer.phone.trim() || undefined,
            email: referrer.email.trim() || undefined,
            address: referrer.address.trim() || undefined,
          }
        : undefined,
    };

    if (input.parties.some((p) => !p.lastName)) {
      setError("Συμπλήρωσε το επώνυμο σε κάθε εμπλεκόμενο.");
      return;
    }

    // Η νέα καρτέλα για την αίτηση πρέπει να ανοίξει ΣΥΓΧΡΟΝΑ μέσα στο click
    // (αλλιώς την μπλοκάρει ο popup blocker)· τη γεμίζουμε μόλις έχουμε το id.
    const aitisiWin = withAitisi ? window.open("", "_blank") : null;

    startTransition(async () => {
      try {
        const id = await createCase(input);
        if (aitisiWin) aitisiWin.location.href = `/api/cases/${id}/aitisi`;
        router.push(`/cases/${id}#financials`);
      } catch (e) {
        aitisiWin?.close();
        setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
      }
    });
  }

  const subTypeList = category === "TRUCK" ? truckTypes : otherTypes;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <section
          className="card"
          style={{ padding: 18, display: "grid", gap: 14 }}
        >
        <h2 style={{ margin: 0, fontSize: 16 }}>Κατηγορία</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {availableCategories.map((b) => {
            const activeBtn = category === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setCategory(b.value)}
                className={activeBtn ? "btn" : "btn btn-ghost"}
                style={{ minWidth: 120 }}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {/* Υπο-επιλογή ανά κατηγορία */}
        {category === "REGISTRATION" && (
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={anarithmi}
              onChange={(e) => setAnarithmi(e.target.checked)}
              disabled={!anarithmiType}
            />
            Ανάριθμη μεταβίβαση
          </label>
        )}

        {selectedType?.supportsImport && (
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isImport}
              onChange={(e) => setIsImport(e.target.checked)}
            />
            Εισαγωγή από εξωτερικό (μεταχειρισμένο)
          </label>
        )}

        {(category === "TRUCK" || category === "OTHER") && (
          <label style={labelStyle}>
            Εργασία
            <select
              value={caseTypeId}
              onChange={(e) => setSubTypeId(e.target.value)}
            >
              {subTypeList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Επιλεγμένος τύπος: <strong>{selectedType?.name ?? "—"}</strong>
        </p>
      </section>

      <section className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Στοιχεία υπόθεσης</h2>
        <label style={{ ...labelStyle, maxWidth: 320 }}>
          Υπηρεσία περιφέρειας
          <select
            value={regionalServiceId}
            onChange={(e) => setRegionalServiceId(e.target.value)}
          >
            <option value="">—</option>
            {regionalServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ ...labelStyle, maxWidth: 320 }}>
          Παράδοση (πού παραδίδεται)
          <input
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            placeholder="π.χ. αντιπροσωπεία, πελάτης…"
          />
        </label>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            color: urgent ? "var(--danger)" : undefined,
          }}
        >
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
          />
          Επείγον (αυθημερόν)
        </label>

        {urgent && (
          <label style={{ ...labelStyle, maxWidth: 200 }}>
            Κόστος επείγοντος (€)
            <input
              value={urgentFee}
              onChange={(e) => setUrgentFee(e.target.value)}
              inputMode="decimal"
            />
          </label>
        )}

        {selectedType?.issuesPlates && (
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Πινακίδες
            </span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                ["EVEN", "Ζυγό"],
                ["ODD", "Μονό"],
                ["SPECIAL", "Ειδικό"],
              ].map(([v, l]) => (
                <label
                  key={v}
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <input
                    type="radio"
                    name="platePref"
                    checked={platePref === v}
                    onChange={() => setPlatePref(v)}
                  />
                  {l}
                </label>
              ))}
            </div>
            {platePref === "SPECIAL" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                <label style={labelStyle}>
                  Ζητούμενο νούμερο
                  <input
                    value={plateRequest}
                    onChange={(e) => setPlateRequest(e.target.value)}
                  />
                </label>
                <label style={labelStyle}>
                  Χρέωση ειδικής πινακίδας (€)
                  <input
                    value={plateFee}
                    onChange={(e) => setPlateFee(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {selectedType?.isFreeform && (
          <label style={labelStyle}>
            Σημειώσεις (ελεύθερη περιγραφή)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                font: "inherit",
                resize: "vertical",
              }}
            />
          </label>
        )}
        </section>
      </div>

      {requiresVehicle && (
        <section
          className="card"
          style={{ padding: 18, display: "grid", gap: 14 }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Όχημα</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <label style={labelStyle}>
              Κατηγορία
              <select
                value={vehCategory}
                onChange={(e) => setVehCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Κατάσταση
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {CONDITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Αρ. πλαισίου (VIN)
              <input value={vin} onChange={(e) => setVin(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Πινακίδα
              <input value={plate} onChange={(e) => setPlate(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Μάρκα
              <input value={make} onChange={(e) => setMake(e.target.value)} />
            </label>
            <label style={labelStyle}>
              Ρύποι (CO₂ g/km)
              <input
                value={emissions}
                onChange={(e) => setEmissions(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label style={labelStyle}>
              Κυβικά (cc)
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={hasOwnershipRetention}
              onChange={(e) => setHasOwnershipRetention(e.target.checked)}
            />
            Παρακράτηση κυριότητας
          </label>
        </section>
      )}

      <section className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Προμηθευτής</h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Ποιος έφερε την υπόθεση (προαιρετικό). Μπορεί να είναι ο ίδιος με
          αγοραστή/πωλητή ή τρίτος.
        </p>
        <PartyRow
          value={referrer}
          roleOptions={ROLE_OPTIONS}
          contactTypeOptions={CONTACT_TYPE_OPTIONS}
          onChange={(patch) => setReferrer((r) => ({ ...r, ...patch }))}
          onRemove={() => setReferrer({ ...emptyReferrer })}
          canRemove
          hideRole
        />
      </section>

      <section className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Εμπλεκόμενοι</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setParties((p) => [...p, { ...emptyParty }])}
          >
            + Προσθήκη
          </button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {parties.map((p, i) => (
            <PartyRow
              key={i}
              value={p}
              roleOptions={ROLE_OPTIONS}
              contactTypeOptions={CONTACT_TYPE_OPTIONS}
              onChange={(patch) => updateParty(i, patch)}
              onRemove={() =>
                setParties((prev) => prev.filter((_, idx) => idx !== i))
              }
              canRemove={parties.length > 1}
            />
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Πληκτρολόγησε επώνυμο ή ΑΦΜ για αναζήτηση υπάρχοντος πελάτη· αλλιώς
          συμπλήρωσε τα στοιχεία για νέο.
        </p>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          onClick={() => submit(false)}
          disabled={pending}
        >
          {pending ? "Δημιουργία…" : "Δημιουργία υπόθεσης"}
        </button>
        {hasAitisi && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => submit(true)}
            disabled={pending}
            title="Δημιουργία υπόθεσης και άνοιγμα της αίτησης σε νέα καρτέλα"
          >
            📄 Δημιουργία & Αίτηση
          </button>
        )}
      </div>
    </div>
  );
}
