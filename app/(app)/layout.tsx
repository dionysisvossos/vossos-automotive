import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/cases"
            style={{ display: "flex", alignItems: "center" }}
            aria-label="Vossos Automotive Solutions — Αρχική"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Vossos Automotive Solutions"
              style={{ height: 46, width: "auto", display: "block" }}
            />
          </Link>
          <Link href="/cases">Υποθέσεις</Link>
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin/case-types">Διαχείριση</Link>
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {session?.user && (
            <Link
              href="/profile"
              style={{ fontSize: 13, color: "var(--text-muted)" }}
            >
              {session.user.name} · {session.user.role}
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn btn-ghost" type="submit">
              Αποσύνδεση
            </button>
          </form>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {children}
      </main>
    </div>
  );
}
