import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      otp: formData.get("otp"),
      redirectTo: "/cases",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error; // re-throw το NEXT_REDIRECT της επιτυχίας
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        action={login}
        className="card"
        style={{ width: 340, padding: 28, display: "grid", gap: 14 }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Vossos Automotive</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
            Σύνδεση στη διαχείριση υποθέσεων
          </p>
        </div>

        {error && (
          <div
            style={{
              color: "var(--danger)",
              background: "#fdecea",
              padding: "8px 10px",
              borderRadius: "var(--radius)",
              fontSize: 14,
            }}
          >
            Λάθος email ή κωδικός.
          </div>
        )}

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Email</span>
          <input type="email" name="email" required autoComplete="email" />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Κωδικός</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Κωδικός 2FA (αν έχει ενεργοποιηθεί)
          </span>
          <input
            type="text"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6ψήφιος κωδικός"
          />
        </label>

        <button className="btn" type="submit">
          Σύνδεση
        </button>
      </form>
    </main>
  );
}
