import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");

  await prisma.$executeRawUnsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS outreach_status varchar`);
  await prisma.$executeRawUnsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_emailed_at timestamp(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_replied_at timestamp(3)`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "companies_branchId_outreachStatus_idx" ON companies (branch_id, outreach_status)`
  );
  console.log("companies.outreach_status + last_emailed_at + last_replied_at ensured");

  const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'companies' AND column_name IN ('outreach_status','last_emailed_at','last_replied_at') ORDER BY 1`
  );
  console.log("columns present:", cols.map((c) => c.column_name).join(", "));

  await prisma.$disconnect();
  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
