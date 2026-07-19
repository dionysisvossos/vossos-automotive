import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateUser,
  resetUserPassword,
  disableTwoFactor,
} from "../../user-actions";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const { error, ok } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      active: true,
      twoFactorEnabled: true,
    },
  });
  if (!user) notFound();

  const notice =
    error === "self"
      ? "Δεν μπορείτε να αφαιρέσετε τα δικαιώματα ή να απενεργοποιήσετε τον εαυτό σας."
      : error === "email"
        ? "Υπάρχει ήδη χρήστης με αυτό το email."
        : error === "pass"
          ? "Ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες."
          : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <Link href="/admin/users" style={{ fontSize: 13 }}>
          ← Πίσω στους χρήστες
        </Link>
        <h1 style={{ margin: "8px 0 0", fontSize: 20 }}>{user.fullName}</h1>
      </div>

      {notice && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          {notice}
        </div>
      )}
      {ok === "pass" && (
        <div
          style={{
            color: "var(--success)",
            background: "#eaf5ee",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          Ο κωδικός ενημερώθηκε.
        </div>
      )}

      <form
        action={updateUser}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}
      >
        <input type="hidden" name="id" value={user.id} />
        <h2 style={{ margin: 0, fontSize: 16 }}>Στοιχεία</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Ονοματεπώνυμο
          <input name="fullName" defaultValue={user.fullName} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Email
          <input name="email" type="email" defaultValue={user.email} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Ρόλος
          <select name="role" defaultValue={user.role}>
            <option value="ADMIN">Διαχειριστής</option>
            <option value="EMPLOYEE">Υπάλληλος</option>
            <option value="VIEWER">Προβολή (μόνο ανάγνωση)</option>
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="active" defaultChecked={user.active} />
          Ενεργός
        </label>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>
          Αποθήκευση
        </button>
      </form>

      <form
        action={resetUserPassword}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}
      >
        <input type="hidden" name="id" value={user.id} />
        <h2 style={{ margin: 0, fontSize: 16 }}>Επαναφορά κωδικού</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Νέος κωδικός (≥ 6 χαρακτήρες)
          <input name="password" type="password" required minLength={6} />
        </label>
        <button
          className="btn btn-ghost"
          type="submit"
          style={{ justifySelf: "start" }}
        >
          Επαναφορά κωδικού
        </button>
      </form>

      <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Έλεγχος δύο παραγόντων (2FA)</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
          Κατάσταση: {user.twoFactorEnabled ? "Ενεργό" : "Ανενεργό"}
        </p>
        {user.twoFactorEnabled && (
          <form action={disableTwoFactor}>
            <input type="hidden" name="id" value={user.id} />
            <button
              className="btn btn-ghost"
              type="submit"
              style={{ color: "var(--danger)" }}
            >
              Απενεργοποίηση 2FA
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
