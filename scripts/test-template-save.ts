import "dotenv/config";

// Prisma adapter fails TLS verification on this machine; strip sslmode and
// let the pg adapter connect the same way scripts/db-fix.ts does.
const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");

  const branch = await prisma.branch.findFirst({ select: { id: true } });
  if (!branch) throw new Error("No branch found");

  const created = await prisma.emailTemplate.create({
    data: {
      branchId: branch.id,
      name: "__migration_test__",
      subject: "test",
      body: "test",
      category: "HVAC",
    },
  });
  console.log("CREATE OK:", created.id, "isActive =", created.isActive);

  const found = await prisma.emailTemplate.findFirst({ where: { id: created.id } });
  console.log("READ OK:", found?.name, "isActive =", found?.isActive);

  await prisma.emailTemplate.delete({ where: { id: created.id } });
  console.log("DELETE OK — full roundtrip passed");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
