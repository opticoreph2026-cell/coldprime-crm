import "dotenv/config";
import { APPROVED_STATUS_LEAD } from "../lib/status-seed";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

// Seeds the master-instructions lead status list into every branch
// (idempotent upsert on branchId+name+type). Usage:
//   npx tsx scripts/seed-lead-statuses.ts
async function main() {
  const { prisma } = await import("../lib/prisma");

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  if (branches.length === 0) throw new Error("No branches found");

  let created = 0;
  let existing = 0;
  for (const branch of branches) {
    for (const name of APPROVED_STATUS_LEAD) {
      const found = await prisma.statusDefinition.findFirst({
        where: { branchId: branch.id, type: "lead", name },
        select: { id: true },
      });
      if (found) {
        existing++;
        continue;
      }
      await prisma.statusDefinition.create({
        data: { branchId: branch.id, type: "lead", name, isActive: true },
      });
      created++;
    }
  }

  await prisma.$disconnect();
  console.log(`DONE: ${created} created, ${existing} already existed`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
