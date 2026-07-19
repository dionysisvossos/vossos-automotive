import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 8,
        }}
      >
        <strong style={{ fontWeight: 500 }}>Διαχείριση</strong>
        <Link href="/admin/case-types">Τύποι υποθέσεων</Link>
        <Link href="/admin/services">Υπηρεσίες περιφέρειας</Link>
        <Link href="/admin/users">Χρήστες</Link>
      </div>
      {children}
    </div>
  );
}
