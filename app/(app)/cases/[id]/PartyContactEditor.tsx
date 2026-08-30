"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContact, type UpdateContactInput } from "../actions";

export type EditableContact = {
  id: string;
  type: string;
  lastName: string;
  firstName: string | null;
  fatherName: string | null;
  afm: string | null;
  doy: string | null;
  idNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  fontSize: 12,
  color: "var(--text-muted)",
};

export default function PartyContactEditor({
  caseId,
  roleLabel,
  contact,
}: {
  caseId: string;
  roleLabel: string;
  contact: EditableContact;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [contactType, setContactType] = useState(contact.type);
  const [lastName, setLastName] = useState(contact.lastName);
  const [firstName, setFirstName] = useState(contact.firstName ?? "");
  const [fatherName, setFatherName] = useState(contact.fatherName ?? "");
  const [afm, setAfm] = useState(contact.afm ?? "");
  const [doy, setDoy] = useState(contact.doy ?? "");
  const [idNumber, setIdNumber] = useState(contact.idNumber ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [address, setAddress] = useState(contact.address ?? "");

  function save() {
    setError(null);
    if (!lastName.trim()) {
      setError("Το επώνυμο είναι υποχρεωτικό.");
      return;
    }
    startTransition(async () => {
      try {
        await updateContact({
          contactId: contact.id,
          caseId,
          contactType: contactType as UpdateContactInput["contactType"],
          lastName: lastName.trim(),
          firstName: firstName.trim() || undefined,
          fatherName: fatherName.trim() || undefined,
          afm: afm.trim() || undefined,
          doy: doy.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
        });
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Κάτι πήγε στραβά.");
      }
    });
  }

  if (!editing) {
    const details: [string, string | null][] = [
      ["ΑΦΜ", contact.afm],
      ["Ταυτότητα", contact.idNumber],
      ["Πατρώνυμο", contact.fatherName],
      ["Τηλ", contact.phone],
      ["Email", contact.email],
      ["Διεύθυνση", contact.address],
    ];
    const shown = details.filter(([, v]) => v);
    return (
      <div style={{ display: "grid", gap: 4 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 500 }}>
            {contact.firstName
              ? `${contact.lastName} ${contact.firstName}`
              : contact.lastName}
          </span>
          <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="badge">{roleLabel}</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
              }}
            >
              Επεξεργασία
            </button>
          </span>
        </div>
        {shown.length > 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {shown.map(([label, v]) => `${label}: ${v}`).join(" · ")}
          </div>
        )}
      </div>
    );
  }

  const input = (
    value: string,
    onChange: (v: string) => void,
  ): React.ReactNode => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%" }}
    />
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 12,
      }}
    >
      <strong style={{ fontSize: 13 }}>Επεξεργασία επαφής · {roleLabel}</strong>
      {error && (
        <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 8,
        }}
      >
        <label style={labelStyle}>
          Είδος
          <select
            value={contactType}
            onChange={(e) => setContactType(e.target.value)}
          >
            <option value="PERSON">Φυσικό πρόσωπο</option>
            <option value="COMPANY">Νομικό πρόσωπο</option>
          </select>
        </label>
        <label style={labelStyle}>Επώνυμο / Επωνυμία{input(lastName, setLastName)}</label>
        <label style={labelStyle}>Όνομα{input(firstName, setFirstName)}</label>
        <label style={labelStyle}>Όνομα πατέρα{input(fatherName, setFatherName)}</label>
        <label style={labelStyle}>ΑΦΜ{input(afm, setAfm)}</label>
        <label style={labelStyle}>ΔΟΥ{input(doy, setDoy)}</label>
        <label style={labelStyle}>Αρ. ταυτότητας{input(idNumber, setIdNumber)}</label>
        <label style={labelStyle}>Τηλέφωνο{input(phone, setPhone)}</label>
        <label style={labelStyle}>Email{input(email, setEmail)}</label>
        <label style={labelStyle}>Διεύθυνση{input(address, setAddress)}</label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn" onClick={save} disabled={pending}>
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
        >
          Άκυρο
        </button>
      </div>
    </div>
  );
}
