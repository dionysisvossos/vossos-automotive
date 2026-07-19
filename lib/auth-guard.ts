import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Επιστρέφει το session αν ο χρήστης είναι ADMIN, αλλιώς ανακατευθύνει.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/cases");
  return session;
}

// Χειριστής (ADMIN ή EMPLOYEE) — μπορεί να κάνει αλλαγές· ο VIEWER όχι.
export async function requireOperator() {
  const session = await auth();
  if (!session?.user) throw new Error("Απαιτείται σύνδεση");
  if (session.user.role === "VIEWER") {
    throw new Error("Δεν έχετε δικαίωμα για αυτή την ενέργεια");
  }
  return session;
}
