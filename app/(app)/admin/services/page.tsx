import { prisma } from "@/lib/prisma";
import {
  createRegionalService,
  updateRegionalService,
  deleteRegionalService,
} from "../actions";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const services = await prisma.regionalService.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: true } } },
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Υπηρεσίες περιφέρειας</h1>

      {error === "inuse" && (
        <div
          style={{
            color: "var(--danger)",
            background: "#fdecea",
            padding: "10px 12px",
            borderRadius: "var(--radius)",
          }}
        >
          Η υπηρεσία δεν διαγράφεται γιατί υπάρχουν υποθέσεις που τη χρησιμοποιούν.
        </div>
      )}

      <div className="card" style={{ padding: 8 }}>
        {services.length === 0 && (
          <p style={{ color: "var(--text-muted)", margin: 8 }}>
            Καμία υπηρεσία ακόμη.
          </p>
        )}
        {services.map((s) => (
          <form
            key={s.id}
            action={updateRegionalService}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "6px 4px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <input type="hidden" name="id" value={s.id} />
            <input name="name" defaultValue={s.name} style={{ flex: 2 }} />
            <input
              name="region"
              defaultValue={s.region ?? ""}
              placeholder="Περιφέρεια / Π.Ε."
              style={{ flex: 1 }}
            />
            <label
              style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}
            >
              <input type="checkbox" name="active" defaultChecked={s.active} />
              Ενεργή
            </label>
            <span
              style={{ fontSize: 12, color: "var(--text-muted)", width: 70 }}
              title="Υποθέσεις"
            >
              {s._count.cases} υποθ.
            </span>
            <button className="btn btn-ghost" type="submit">
              Αποθήκευση
            </button>
            <button
              className="btn btn-ghost"
              type="submit"
              formAction={deleteRegionalService}
              title="Διαγραφή"
              style={{ color: "var(--danger)" }}
            >
              ✕
            </button>
          </form>
        ))}
      </div>

      <form
        action={createRegionalService}
        className="card"
        style={{ padding: 16, display: "grid", gap: 12, maxWidth: 520 }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Νέα υπηρεσία</h2>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Όνομα
          <input name="name" required placeholder="π.χ. Δ/νση Μεταφορών Π.Ε. …" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Περιφέρεια / Περιφερειακή ενότητα
          <input name="region" />
        </label>
        <button className="btn" type="submit" style={{ justifySelf: "start" }}>
          Δημιουργία
        </button>
      </form>
    </div>
  );
}
