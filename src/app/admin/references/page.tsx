import { ReferenceManager } from "@/components/admin/ReferenceManager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getReferences() {
  return prisma.reference.findMany({
    orderBy: [{ sortOrder: "asc" }, { companyName: "asc" }],
  });
}

export default async function AdminReferencesPage() {
  const references = await getReferences();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">References</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage company and brand references shown on the public references page.</p>
      </div>
      <ReferenceManager initialReferences={references} />
    </div>
  );
}
