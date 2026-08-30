import Link from "next/link";
import type { CaseState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCaseWhere, filterQueryString } from "@/lib/case-filters";

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

const eur = (n: number) =>
  n.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  " €";

const dmy = (d: Date) =>
  new Date(d).toLocaleDateString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const num = (d: unknown): number => (d == null ? 0 : Number(d));

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

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  color: "var(--text-muted)",
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    state?: string;
    assigned?: string;
    referrer?: string;
    urgent?: string;
    unpaid?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { type, state, assigned, referrer, urgent, unpaid, from, to } = params;

  const where = await buildCaseWhere(params);
  // Το export link κρατάει τα φίλτρα αλλά ΟΧΙ τη σελίδα (θέλουμε όλα).
  const { page: _p, ...filterOnly } = params;
  const exportQs = filterQueryString(filterOnly);

  const PAGE_SIZE = 50;
  const page = Math.max(1, Number(params.page) || 1);

  const [cases, caseTypes, users, referrers, total, caseSums, expSum, paySum, byType] =
    await Promise.all([
      prisma.case.findMany({
        where,
        orderBy: { openedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          caseType: true,
          vehicle: true,
          parties: { include: { contact: true } },
          expenses: { select: { amount: true } },
          payments: { select: { amount: true } },
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
      prisma.contact.findMany({
        where: { isReferrer: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, lastName: true, firstName: true },
      }),
      prisma.case.count({ where }),
      prisma.case.aggregate({
        where,
        _sum: { fee: true, urgentFee: true, plateFee: true },
      }),
      prisma.caseExpense.aggregate({ where: { case: where }, _sum: { amount: true } }),
      prisma.casePayment.aggregate({ where: { case: where }, _sum: { amount: true } }),
      // Ανάλυση ανά τύπο (για τιμολόγηση ομοειδών υποθέσεων)
      prisma.case.groupBy({
        by: ["caseTypeId"],
        where,
        _count: { _all: true },
        _sum: { fee: true, urgentFee: true, plateFee: true },
      }),
    ]);

  // Σύνολα πάνω σε ΟΛΟ το φιλτραρισμένο σύνολο (όχι μόνο στη σελίδα)
  const officeRevenue =
    num(caseSums._sum.fee) +
    num(caseSums._sum.urgentFee) +
    num(caseSums._sum.plateFee);
  const totalExpenses = num(expSum._sum.amount);
  const totalCharged = totalExpenses + officeRevenue;
  const totalPaid = num(paySum._sum.amount);
  const totalBalance = totalCharged - totalPaid;

  const hasFilters = !!(
    type ||
    state ||
    assigned ||
    referrer ||
    urgent ||
    unpaid ||
    from ||
    to
  );

  // Ανάλυση ανά τύπο — αμοιβή γραφείου (αυτό που τιμολογείται)
  const typeName = new Map(caseTypes.map((t) => [t.id, t.name]));
  const byTypeRows = byType
    .map((g) => ({
      name: typeName.get(g.caseTypeId) ?? "—",
      count: g._count._all,
      revenue:
        num(g._sum.fee) + num(g._sum.urgentFee) + num(g._sum.plateFee),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = (page - 1) * PAGE_SIZE + cases.length;
  const pageLink = (p: number) => {
    const qs = new URLSearchParams(filterQueryString(filterOnly));
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `/cases${s ? `?${s}` : ""}`;
  };

  const selectedReferrer = referrer
    ? referrers.find((r) => r.id === referrer)
    : null;
  const referrerName = selectedReferrer
    ? selectedReferrer.firstName
      ? `${selectedReferrer.lastName} ${selectedReferrer.firstName}`
      : selectedReferrer.lastName
    : null;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Υποθέσεις</h1>
        <div
          style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
        >
          <a
            href={`/print/registrations${exportQs ? `?${exportQs}` : ""}`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost"
            title="Εκτυπώσιμη λίστα ταξινομήσεων (επείγοντα πρώτα, αριθμημένα)"
          >
            🖨 Ταξινομήσεις
          </a>
          <a
            href={`/print/transfers${exportQs ? `?${exportQs}` : ""}`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost"
            title="Εκτυπώσιμη λίστα μεταβιβάσεων"
          >
            🖨 Μεταβιβάσεις
          </a>
          <a
            href={`/print/other${exportQs ? `?${exportQs}` : ""}`}
            target="_blank"
            rel="noopener"
            className="btn btn-ghost"
            title="Εκτυπώσιμη λίστα λοιπών εργασιών (πλην ταξινομήσεων/μεταβιβάσεων/ΦΙΧ)"
          >
            🖨 Λοιπές
          </a>
          <a
            href={`/api/cases/export${exportQs ? `?${exportQs}` : ""}`}
            className="btn btn-ghost"
            title="Κατέβασμα της φιλτραρισμένης λίστας σε CSV (Excel)"
          >
            ⬇ Όλες
          </a>
          <Link href="/cases/new" className="btn">
            + Νέα υπόθεση
          </Link>
        </div>
      </div>

      {/* Σύνοψη / αναφορά */}
      <section
        className="card"
        style={{
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 16,
        }}
      >
        <Stat label="Υποθέσεις" value={total} />
        <Stat label="Έσοδα γραφείου" value={eur(officeRevenue)} />
        <Stat label="Έξοδα (pass-through)" value={eur(totalExpenses)} />
        <Stat label="Χρέωση πελατών" value={eur(totalCharged)} />
        <Stat label="Εισπραχθέν" value={eur(totalPaid)} />
        <Stat
          label="Υπόλοιπο"
          value={
            <span
              style={{
                color: totalBalance > 0 ? "var(--danger)" : "var(--success)",
              }}
            >
              {eur(totalBalance)}
            </span>
          }
        />
      </section>

      {/* Τιμολόγηση: ανάλυση ανά τύπο για τον επιλεγμένο προμηθευτή */}
      {referrerName && (
        <section className="card" style={{ padding: 18, overflow: "hidden" }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>
            Προς τιμολόγηση — {referrerName}
          </h2>
          <table>
            <thead>
              <tr>
                <th>Τύπος υπόθεσης</th>
                <th style={{ textAlign: "right" }}>Πλήθος</th>
                <th style={{ textAlign: "right" }}>Αμοιβή (σύνολο)</th>
              </tr>
            </thead>
            <tbody>
              {byTypeRows.map((r) => (
                <tr key={r.name}>
                  <td>
                    <a
                      href={`/cases?referrer=${referrer}&type=${
                        caseTypes.find((t) => t.name === r.name)?.id ?? ""
                      }`}
                    >
                      {r.name}
                    </a>
                  </td>
                  <td style={{ textAlign: "right" }}>{r.count}</td>
                  <td style={{ textAlign: "right" }}>{eur(r.revenue)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 500 }}>Σύνολο</td>
                <td style={{ textAlign: "right", fontWeight: 500 }}>{total}</td>
                <td style={{ textAlign: "right", fontWeight: 500 }}>
                  {eur(officeRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Κάνε κλικ σε τύπο για να δεις/εξάγεις μόνο τις ομοειδείς υποθέσεις
            αυτού του προμηθευτή.
          </p>
        </section>
      )}

      <form
        method="get"
        className="card"
        style={{
          padding: 12,
          display: "flex",
          gap: 10,
          flexWrap: "nowrap",
          overflowX: "auto",
          alignItems: "flex-end",
        }}
      >
        <label style={labelStyle}>
          Τύπος
          <select name="type" defaultValue={type ?? ""} style={{ width: 165 }}>
            <option value="">Όλοι</option>
            {caseTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Κατάσταση
          <select name="state" defaultValue={state ?? ""} style={{ width: 118 }}>
            <option value="">Όλες</option>
            <option value="OPEN">Σε εξέλιξη</option>
            <option value="COMPLETED">Ολοκληρωμένη</option>
            <option value="CANCELLED">Ακυρωμένη</option>
          </select>
        </label>

        <label style={labelStyle}>
          Υπεύθυνος
          <select name="assigned" defaultValue={assigned ?? ""} style={{ width: 130 }}>
            <option value="">Όλοι</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Προμηθευτής
          <select name="referrer" defaultValue={referrer ?? ""} style={{ width: 160 }}>
            <option value="">Όλοι</option>
            {referrers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.firstName ? `${r.lastName} ${r.firstName}` : r.lastName}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Από
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            style={{ width: 130 }}
          />
        </label>

        <label style={labelStyle}>
          Έως
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            style={{ width: 130 }}
          />
        </label>

        <label
          style={{
            display: "flex",
            gap: 5,
            alignItems: "center",
            fontSize: 13,
            whiteSpace: "nowrap",
            paddingBottom: 8,
          }}
        >
          <input
            type="checkbox"
            name="urgent"
            value="1"
            defaultChecked={urgent === "1"}
          />
          Επείγοντα
        </label>

        <label
          style={{
            display: "flex",
            gap: 5,
            alignItems: "center",
            fontSize: 13,
            whiteSpace: "nowrap",
            paddingBottom: 8,
          }}
        >
          <input
            type="checkbox"
            name="unpaid"
            value="1"
            defaultChecked={unpaid === "1"}
          />
          Ανεξόφλητα
        </label>

        <button
          className="btn btn-ghost"
          type="submit"
          style={{ whiteSpace: "nowrap" }}
        >
          Φιλτράρισμα
        </button>
        {hasFilters && (
          <Link
            href="/cases"
            style={{ fontSize: 13, whiteSpace: "nowrap", paddingBottom: 10 }}
          >
            Καθαρισμός
          </Link>
        )}
      </form>

      <div className="card" style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>Κωδικός</th>
              <th>Ημ/νία</th>
              <th>Τύπος</th>
              <th>Όχημα</th>
              <th>Πελάτης</th>
              <th>Προμηθευτής</th>
              <th>Κατάσταση</th>
              <th style={{ textAlign: "right" }}>Υπόλοιπο</th>
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
            {cases.map((c) => {
              const balance =
                c.expenses.reduce((s, e) => s + num(e.amount), 0) +
                num(c.fee) +
                num(c.urgentFee) +
                num(c.plateFee) -
                c.payments.reduce((s, p) => s + num(p.amount), 0);
              return (
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
                    {dmy(c.openedAt)}
                  </td>
                  <td>{c.caseType.name}</td>
                  <td>
                    {c.vehicle ? c.vehicle.plate ?? c.vehicle.vin ?? "—" : "—"}
                  </td>
                  <td>{partyName(c.parties, ["BUYER", "OWNER", "SELLER"])}</td>
                  <td>{partyName(c.parties, ["REFERRER"])}</td>
                  <td>
                    <span className="badge" style={{ color: STATE_COLORS[c.state] }}>
                      {STATE_LABELS[c.state]}
                    </span>
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      color: balance > 0 ? "var(--danger)" : "var(--text-muted)",
                    }}
                  >
                    {eur(balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {pageStart}–{pageEnd} από {total} (σελίδα {page} / {totalPages})
          </span>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {page > 1 ? (
                <Link href={pageLink(page - 1)} className="btn btn-ghost">
                  ← Προηγούμενη
                </Link>
              ) : (
                <span className="btn btn-ghost" style={{ opacity: 0.5 }}>
                  ← Προηγούμενη
                </span>
              )}
              {page < totalPages ? (
                <Link href={pageLink(page + 1)} className="btn btn-ghost">
                  Επόμενη →
                </Link>
              ) : (
                <span className="btn btn-ghost" style={{ opacity: 0.5 }}>
                  Επόμενη →
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
