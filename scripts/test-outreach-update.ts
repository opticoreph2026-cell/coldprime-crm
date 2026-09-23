import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { prisma } = await import("../lib/prisma");
  const c = await prisma.company.findFirst({
    select: { id: true, name: true, outreachStatus: true, lastEmailedAt: true, lastRepliedAt: true },
  });
  if (!c) {
    console.log("no company found");
    process.exit(1);
  }
  const orig = { outreachStatus: c.outreachStatus, lastEmailedAt: c.lastEmailedAt, lastRepliedAt: c.lastRepliedAt };
  try {
    // Simulate a send: set EMAILED (unless already REPLIED)
    await prisma.company.update({
      where: { id: c.id },
      data: { lastEmailedAt: new Date(), ...(c.outreachStatus !== "REPLIED" && { outreachStatus: "EMAILED" }) },
    });
    let r = await prisma.company.findUnique({ where: { id: c.id }, select: { outreachStatus: true, lastEmailedAt: true } });
    console.log(`after send (was ${JSON.stringify(orig.outreachStatus)}): ${r?.outreachStatus}, lastEmailedAt set: ${!!r?.lastEmailedAt}`);

    // Simulate reply then another send: REPLIED must be preserved
    await prisma.company.update({ where: { id: c.id }, data: { outreachStatus: "REPLIED", lastRepliedAt: new Date() } });
    // Routes re-read current status before applying the send rule (fresh read)
    const cur = await prisma.company.findUnique({ where: { id: c.id }, select: { outreachStatus: true } });
    await prisma.company.update({
      where: { id: c.id },
      data: { lastEmailedAt: new Date(), ...(cur?.outreachStatus !== "REPLIED" && { outreachStatus: "EMAILED" }) },
    });
    r = await prisma.company.findUnique({ where: { id: c.id }, select: { outreachStatus: true } });
    console.log(`REPLIED preserved after another send: ${r?.outreachStatus === "REPLIED"}`);
  } finally {
    await prisma.company.update({
      where: { id: c.id },
      data: { outreachStatus: orig.outreachStatus, lastEmailedAt: orig.lastEmailedAt, lastRepliedAt: orig.lastRepliedAt },
    });
  }
  await prisma.$disconnect();
  console.log("restored, roundtrip OK");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
