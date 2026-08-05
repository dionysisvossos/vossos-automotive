"use client";

// Κουμπί εκτύπωσης — ανοίγει τον διάλογο εκτύπωσης του browser (ο χρήστης
// εκτυπώνει σε χαρτί ή «Αποθήκευση ως PDF»). Κρύβεται στην εκτύπωση.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: "8px 14px",
        border: "1px solid #1f5fa8",
        borderRadius: 6,
        background: "#1f5fa8",
        color: "#fff",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      🖨 Εκτύπωση
    </button>
  );
}
