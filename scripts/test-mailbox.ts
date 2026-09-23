import "dotenv/config";

const raw = process.env.DATABASE_URL!;
const url = new URL(raw);
url.searchParams.delete("sslmode");
process.env.DATABASE_URL = url.toString();

async function main() {
  const { listMail, getMailDetail, getMailByLogId } = await import("../lib/mailbox");

  const inbox = await listMail({ folder: "inbox", days: 30, limit: 10 });
  console.log(`INBOX: ${inbox.length} messages`);
  for (const m of inbox.slice(0, 5)) {
    console.log(`  [${m.matched ? "REPLY/CRM" : "-"}] ${m.date?.slice(0, 10)} ${m.from} → ${m.subject.slice(0, 60)}${m.company ? ` (${m.company.name})` : ""}`);
  }

  const sent = await listMail({ folder: "sent", days: 30, limit: 10 });
  console.log(`SENT: ${sent.length} messages`);
  for (const m of sent.slice(0, 5)) {
    console.log(`  [${m.matched ? "CRM" : "-"}] ${m.date?.slice(0, 10)} → ${m.to} | ${m.subject.slice(0, 60)}`);
  }

  if (inbox.length > 0) {
    const detail = await getMailDetail({ folder: "inbox", uid: inbox[0].uid });
    console.log(`detail(inbox uid=${detail.uid}): subject="${detail.subject}" html=${detail.html ? detail.html.length + " chars" : "none"} text=${detail.text ? detail.text.length + " chars" : "none"}`);
  }

  const { prisma } = await import("../lib/prisma");
  const recentLogs = await prisma.emailLog.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: 20,
  });
  const log = recentLogs.find((l) => l.metadata);
  if (log) {
    try {
      const d = await getMailByLogId(log.id);
      console.log(`byLog(${log.id.slice(0, 8)}...): found uid=${d.uid} subject="${d.subject.slice(0, 50)}"`);
    } catch (e: unknown) {
      console.log(`byLog FAILED: ${e instanceof Error ? e.message : e}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
