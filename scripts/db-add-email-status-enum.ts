import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");

  // Create the enum type Prisma expects (schema order: SENT, FAILED, PENDING)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'PENDING');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('type "EmailStatus" ensured');

  // Convert varchar column → enum, with schema default
  await prisma.$executeRawUnsafe(`ALTER TABLE email_logs ALTER COLUMN status DROP DEFAULT`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE email_logs ALTER COLUMN status TYPE "EmailStatus" USING status::"EmailStatus"`
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE email_logs ALTER COLUMN status SET DEFAULT 'PENDING'::"EmailStatus"`);
  console.log("email_logs.status converted to EmailStatus");

  await prisma.$executeRawUnsafe(`UPDATE email_logs SET status = 'PENDING' WHERE status IS NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE email_logs ALTER COLUMN status SET NOT NULL`);
  console.log("status NOT NULL enforced");

  const types = await prisma.$queryRawUnsafe<{ typname: string }[]>(
    `SELECT typname FROM pg_type WHERE typname IN ('EmailStatus', 'UserRole') ORDER BY 1`
  );
  console.log("enum types present:", types.map((t) => t.typname).join(", "));

  // Roundtrip: emailLog.create with status, then delete
  const branch = await prisma.branch.findFirst({ select: { id: true } });
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (branch && user) {
    const log = await prisma.emailLog.create({
      data: {
        branchId: branch.id,
        fromUserId: user.id,
        toEmail: "roundtrip-test@example.com",
        subject: "__enum_test__",
        status: "SENT",
      },
    });
    await prisma.emailLog.delete({ where: { id: log.id } });
    console.log("emailLog.create/delete roundtrip OK (status =", log.status + ")");
  }

  await prisma.$disconnect();
  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
