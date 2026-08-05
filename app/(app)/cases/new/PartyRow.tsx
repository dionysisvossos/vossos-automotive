"use client";

import { useEffect, useState } from "react";
import { searchContacts, type ContactMatch } from "../actions";

export type PartyValue = {
  role: string;
  contactId?: string;
  contactType: string;
  lastName: string;
  firstName: string;
  fatherName: string;
  afm: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
};

type Option = { readonly value: string; readonly label: string };

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 13,
  color: "var(--text-muted)",
};

function displayName(c: ContactMatch): string {
  return c.firstName ? `${c.lastName} ${c.firstName}` : c.lastName;
}

export default function PartyRow({
  value,
  roleOptions,
  contactTypeOptions,
  onChange,
  onRemove,
  canRemove,
  hideRole = false,
}: {
  value: PartyValue;
  roleOptions: readonly Option[];
  contactTypeOptions: readonly Option[];
  onChange: (patch: Partial<PartyValue>) => void;
  onRemove: () => void;
  canRemove: boolean;
  hideRole?: boolean;
}) {
  const [results, setResults] = useState<ContactMatch[]>([]);
  const [open, setOpen] = useState(false);

  const query = [value.lastName, value.firstName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (value.contactId) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      try {
        const r = await searchContacts(query);
        if (active) {
          setResults(r);
          setOpen(r.length > 0);
        }
      } catch {
        /* αγνόησε σφάλματα αναζήτησης */
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, value.contactId]);

  function pick(c: ContactMatch) {
    onChange({
      contactId: c.id,
      contactType: c.type,
      lastName: c.lastName,
      firstName: c.firstName ?? "",
      fatherName: c.fatherName ?? "",
      afm: c.afm ?? "",
      idNumber: c.idNumber ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
    });
    setOpen(false);
  }

  const header = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      {hideRole ? (
        <div />
      ) : (
        <label style={labelStyle}>
          Ρόλος
          <select
            value={value.role}
            onChange={(e) => onChange({ role: e.target.value })}
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div />
      <button
        type="button"
        className="btn btn-ghost"
        disabled={!canRemove}
        onClick={onRemove}
        title={hideRole ? "Καθαρισμός" : "Αφαίρεση εμπλεκομένου"}
        style={{ height: 38, justifySelf: "end" }}
      >
        ✕
      </button>
    </div>
  );

  // Επιλεγμένος υπάρχων πελάτης — κλειδωμένη προβολή.
  if (value.contactId) {
    return (
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        {header}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "8px 10px",
            background: "#f0f6f1",
          }}
        >
          <span style={{ color: "var(--success)" }}>
            ✓ {value.lastName}
            {value.firstName ? ` ${value.firstName}` : ""}
            {value.afm ? ` · ΑΦΜ ${value.afm}` : ""}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange({ contactId: undefined })}
          >
            Αλλαγή
          </button>
        </div>
      </div>
    );
  }

  // Νέος / αναζήτηση.
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      {header}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <label style={labelStyle}>
          Είδος
          <select
            value={value.contactType}
            onChange={(e) => onChange({ contactType: e.target.value })}
          >
            {contactTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Επώνυμο / Επωνυμία
          <div style={{ position: "relative" }}>
            <input
              value={value.lastName}
              onChange={(e) => onChange({ lastName: e.target.value })}
              onFocus={() => results.length > 0 && setOpen(true)}
              autoComplete="off"
              style={{ width: "100%" }}
            />
            {open && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 2px)",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  maxHeight: 220,
                  overflow: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 10px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    {displayName(c)}
                    {c.afm ? (
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · ΑΦΜ {c.afm}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label style={labelStyle}>
          Όνομα
          <input
            value={value.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Όνομα πατέρα
          <input
            value={value.fatherName}
            onChange={(e) => onChange({ fatherName: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          ΑΦΜ
          <input
            value={value.afm}
            onChange={(e) => onChange({ afm: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Αρ. ταυτότητας
          <input
            value={value.idNumber}
            onChange={(e) => onChange({ idNumber: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Τηλέφωνο
          <input
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Email
          <input
            value={value.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </label>
        <label style={labelStyle}>
          Διεύθυνση
          <input
            value={value.address}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
