import "dotenv/config";
import { APPROVED_TEMPLATES } from "../lib/email/templates";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

// Seeds the approved template library into every branch (idempotent:
// existing template names are skipped). Usage:
//   npx tsx scripts/seed-email-templates.ts
async function main() {
  const { prisma } = await import("../lib/prisma");

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  if (branches.length === 0) throw new Error("No branches found");

  let created = 0;
  let skipped = 0;
  for (const branch of branches) {
    for (const t of APPROVED_TEMPLATES) {
      const existing = await prisma.emailTemplate.findFirst({
        where: { branchId: branch.id, name: t.name },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.emailTemplate.create({
        data: { branchId: branch.id, name: t.name, subject: t.subject, body: t.body, category: t.category },
      });
      created++;
    }
  }

  await prisma.$disconnect();
  console.log(`DONE: ${created} created, ${skipped} already existed`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
