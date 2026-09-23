import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");

  const tpls = await prisma.emailTemplate.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("templates GET OK:", tpls.length, "-", tpls.map((t) => `${t.name} (${t.branchId.slice(0, 8)}...)`).join(", "));

  const logs = await prisma.emailLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 5,
    include: {
      template: { select: { name: true, subject: true } },
      fromUser: { select: { name: true } },
    },
  });
  console.log("logs GET OK:", logs.length);

  const vendors = await prisma.vendor.count();
  console.log("vendor count OK:", vendors);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
