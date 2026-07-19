import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { otpauthUrl, qrDataUrl } from "@/lib/totp";
import {
  startTwoFactorSetup,
  confirmTwoFactor,
  cancelTwoFactorSetup,
  disableOwnTwoFactor,
} from "./actions";

const cardStyle: React.CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 12,
  maxWidth: 560,
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
    },
  });
  if (!user) redirect("/login");

  const setupInProgress = !user.twoFactorEnabled && !!user.twoFactorSecret;
  const qr =
    setupInProgress && user.twoFactorSecret
      ? await qrDataUrl(otpauthUrl(user.email, user.twoFactorSecret))
      : null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Το προφίλ μου</h1>

      <section className="card" style={cardStyle}>
        <div>
          <div style={{ fontWeight: 500 }}>{user.fullName}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {user.email}
          </div>
        </div>
      </section>

      {error === "code" && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            maxWidth: 560,
          }}
        >
          Λάθος κωδικός. Δοκίμασε ξανά.
        </div>
      )}
      {ok === "enabled" && (
        <div
          style={{
            color: "var(--success)",
            background: "#eaf5ee",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            maxWidth: 560,
          }}
        >
          Το 2FA ενεργοποιήθηκε.
        </div>
      )}
      {ok === "disabled" && (
        <div
          style={{
            color: "var(--text-muted)",
            background: "var(--bg)",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            maxWidth: 560,
          }}
        >
          Το 2FA απενεργοποιήθηκε.
        </div>
      )}

      <section className="card" style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Έλεγχος δύο παραγόντων (2FA)</h2>

        {user.twoFactorEnabled ? (
          <>
            <p style={{ margin: 0, color: "var(--success)" }}>✓ Ενεργό</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Για απενεργοποίηση, συμπλήρωσε έναν τρέχοντα κωδικό από την
              εφαρμογή authenticator.
            </p>
            <form
              action={disableOwnTwoFactor}
              style={{ display: "flex", gap: 8, alignItems: "end" }}
            >
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Κωδικός 2FA
                <input name="otp" inputMode="numeric" required style={{ width: 140 }} />
              </label>
              <button
                className="btn btn-ghost"
                type="submit"
                style={{ color: "var(--danger)" }}
              >
                Απενεργοποίηση
              </button>
            </form>
          </>
        ) : setupInProgress ? (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              1. Σκάναρε το QR με μια εφαρμογή authenticator (Google
              Authenticator, Authy, κ.λπ.).
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code 2FA"
                width={180}
                height={180}
                style={{ border: "1px solid var(--border)", borderRadius: 8 }}
              />
            )}
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Ή πληκτρολόγησε χειροκίνητα το κλειδί:{" "}
              <code style={{ userSelect: "all" }}>{user.twoFactorSecret}</code>
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              2. Συμπλήρωσε τον 6ψήφιο κωδικό για επιβεβαίωση:
            </p>
            <form
              action={confirmTwoFactor}
              style={{ display: "flex", gap: 8, alignItems: "end" }}
            >
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                Κωδικός
                <input name="otp" inputMode="numeric" required style={{ width: 140 }} />
              </label>
              <button className="btn" type="submit">
                Επιβεβαίωση
              </button>
            </form>
            <form action={cancelTwoFactorSetup}>
              <button className="btn btn-ghost" type="submit">
                Ακύρωση
              </button>
            </form>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
              Πρόσθεσε ένα επιπλέον επίπεδο ασφάλειας για την απομακρυσμένη
              σύνδεση.
            </p>
            <form action={startTwoFactorSetup}>
              <button className="btn" type="submit">
                Ενεργοποίηση 2FA
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
