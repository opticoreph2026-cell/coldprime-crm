import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");

  await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar`);
  await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_email varchar`);
  console.log("users.phone + users.signature_email ensured");

  await prisma.$disconnect();
  console.log("DONE");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
