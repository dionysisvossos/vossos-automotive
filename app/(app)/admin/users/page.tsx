import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createUser } from "../user-actions";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Διαχειριστής",
  EMPLOYEE: "Υπάλληλος",
  VIEWER: "Προβολή",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      active: true,
      twoFactorEnabled: true,
    },
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Χρήστες</h1>

      {error === "email" && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          Υπάρχει ήδη χρήστης με αυτό το email.
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Όνομα</th>
              <th>Email</th>
              <th>Ρόλος</th>
              <th>2FA</th>
              <th>Ενεργός</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`}>{u.fullName}</Link>
                </td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                <td>{u.twoFactorEnabled ? "Ναι" : "—"}</td>
                <td>{u.active ? "Ναι" : "Όχι"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        action={createUser}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Νέος χρήστης</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Ονοματεπώνυμο
          <input name="fullName" required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Email
          <input name="email" type="email" required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Ρόλος
          <select name="role" defaultValue="EMPLOYEE">
            <option value="ADMIN">Διαχειριστής</option>
            <option value="EMPLOYEE">Υπάλληλος</option>
            <option value="VIEWER">Προβολή (μόνο ανάγνωση)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Κωδικός (≥ 6 χαρακτήρες)
          <input name="password" type="password" required minLength={6} />
        </label>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>
          Δημιουργία
        </button>
      </form>
    </div>
  );
}
