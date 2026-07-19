import Link from "next/link";
import type { CaseState, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STATE_LABELS: Record<CaseState, string> = {
  OPEN: "Σε εξέλιξη",
  COMPLETED: "Ολοκληρωμένη",
  CANCELLED: "Ακυρωμένη",
};

const STATE_COLORS: Record<CaseState, string> = {
  OPEN: "var(--warning)",
  COMPLETED: "var(--success)",
  CANCELLED: "var(--danger)",
};

function partyName(
  parties: {
    role: string;
    contact: { lastName: string; firstName: string | null };
  }[],
  roles: string[],
): string {
  const p = parties.find((x) => roles.includes(x.role));
  if (!p) return "—";
  const { lastName, firstName } = p.contact;
  return firstName ? `${lastName} ${firstName}` : lastName;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; state?: string; assigned?: string }>;
}) {
  const { type, state, assigned } = await searchParams;

  const where: Prisma.CaseWhereInput = {
    ...(type ? { caseTypeId: type } : {}),
    ...(state ? { state: state as CaseState } : {}),
    ...(assigned ? { assignedUserId: assigned } : {}),
  };

  const [cases, caseTypes, users] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { openedAt: "desc" },
      take: 100,
      include: {
        caseType: true,
        vehicle: true,
        assignedUser: true,
        regionalService: true,
        currentStage: true,
        parties: { include: { contact: true } },
      },
    }),
    prisma.caseType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Υποθέσεις</h1>
        <Link href="/cases/new" className="btn">
          + Νέα υπόθεση
        </Link>
      </div>

      <form
        method="get"
        className="card"
        style={{
          padding: 14,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Τύπος</span>
          <select name="type" defaultValue={type ?? ""}>
            <option value="">Όλοι</option>
            {caseTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Κατάσταση
          </span>
          <select name="state" defaultValue={state ?? ""}>
            <option value="">Όλες</option>
            <option value="OPEN">Σε εξέλιξη</option>
            <option value="COMPLETED">Ολοκληρωμένη</option>
            <option value="CANCELLED">Ακυρωμένη</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Υπεύθυνος
          </span>
          <select name="assigned" defaultValue={assigned ?? ""}>
            <option value="">Όλοι</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>

        <button className="btn btn-ghost" type="submit">
          Φιλτράρισμα
        </button>
      </form>

      <div className="card" style={{ overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Ημ/νία</th>
              <th>Τύπος</th>
              <th>Όχημα</th>
              <th>Πελάτης</th>
              <th>Στάδιο</th>
              <th>Κατάσταση</th>
              <th>Υπεύθυνος</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: "var(--text-muted)" }}>
                  Καμία υπόθεση.
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link href={`/cases/${c.id}`}>{c.code}</Link>
                  {c.urgent && (
                    <span
                      className="badge"
                      style={{
                        color: "var(--danger)",
                        borderColor: "var(--danger)",
                        marginLeft: 6,
                        fontSize: 11,
                      }}
                    >
                      Επείγον
                    </span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                  {new Date(c.openedAt).toLocaleDateString("el-GR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </td>
                <td>{c.caseType.name}</td>
                <td>
                  {c.vehicle
                    ? c.vehicle.plate ?? c.vehicle.vin ?? "—"
                    : "—"}
                </td>
                <td>{partyName(c.parties, ["BUYER", "OWNER", "SELLER"])}</td>
                <td style={{ color: "var(--text-muted)" }}>
                  {c.currentStage?.name ?? "—"}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{ color: STATE_COLORS[c.state] }}
                  >
                    {STATE_LABELS[c.state]}
                  </span>
                </td>
                <td>{c.assignedUser?.fullName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
