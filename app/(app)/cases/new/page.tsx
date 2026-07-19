import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewCaseForm from "./NewCaseForm";

export default async function NewCasePage() {
  const [caseTypes, regionalServices] = await Promise.all([
    prisma.caseType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        requiresVehicle: true,
        isFreeform: true,
        issuesPlates: true,
        supportsImport: true,
      },
    }),
    prisma.regionalService.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <Link href="/cases" style={{ fontSize: 13 }}>
          ← Πίσω στις υποθέσεις
        </Link>
        <h1 style={{ margin: "8px 0 0", fontSize: 22 }}>Νέα υπόθεση</h1>
      </div>

      <NewCaseForm caseTypes={caseTypes} regionalServices={regionalServices} />
    </div>
  );
}
