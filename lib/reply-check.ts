import { ImapFlow } from "imapflow";

const LOOKBACK_DAYS = 7;

function normalizeId(id: string): string {
  return id.trim().toLowerCase().replace(/^<|>$/g, "");
}

function stripRePrefix(subject: string): string {
  return subject.replace(/^\s*((re|fwd?|aw)\s*:\s*)+/gi, "").trim().toLowerCase();
}

function rawHeaderText(headers: unknown): string {
  if (Buffer.isBuffer(headers)) return headers.toString("utf8");
  if (typeof headers === "string") return headers;
  if (headers instanceof Map) {
    const parts: string[] = [];
    for (const name of ["in-reply-to", "references"]) {
      const v = headers.get(name) as string | string[] | undefined;
      if (typeof v === "string") parts.push(`${name}: ${v}`);
      else if (Array.isArray(v)) parts.push(`${name}: ${v.join(" ")}`);
    }
    return parts.join("\n");
  }
  return "";
}

function extractRefs(headers: unknown): string[] {
  const text = rawHeaderText(headers).replace(/\r?\n[ \t]+/g, " ");
  const refs: string[] = [];
  const ir = /in-reply-to:\s*([^\r\n]+)/i.exec(text);
  const rf = /references:\s*([^\r\n]+)/i.exec(text);
  if (ir) refs.push(...ir[1].trim().split(/\s+/).filter(Boolean));
  if (rf) refs.push(...rf[1].trim().split(/\s+/).filter(Boolean));
  return refs;
}

export interface ReplyCheckResult {
  checked: number;
  repliesFound: number;
  companies: string[];
}

export async function checkReplies(): Promise<ReplyCheckResult> {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD)");
  }

  const { prisma } = await import("./prisma");

  const logs = await prisma.emailLog.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: 1000,
    select: { id: true, toEmail: true, subject: true, metadata: true },
  });

  const byMessageId = new Map<string, (typeof logs)[number]>();
  const bySubjectTo = new Map<string, (typeof logs)[number]>();
  for (const log of logs) {
    try {
      const raw = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
      const mid = (raw as { messageId?: string } | null)?.messageId;
      if (mid) byMessageId.set(normalizeId(mid), log);
    } catch {}
    bySubjectTo.set(`${stripRePrefix(log.subject)}||${log.toEmail.toLowerCase()}`, log);
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    logger: false,
  });

  let checked = 0;
  const matchedLogs = new Map<string, (typeof logs)[number]>();

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    for await (const msg of client.fetch({ since }, { envelope: true, headers: true })) {
      checked++;
      const refs = extractRefs(msg.headers);
      let hit: (typeof logs)[number] | undefined;
      for (const ref of refs) {
        hit = byMessageId.get(normalizeId(ref));
        if (hit) break;
      }
      if (!hit && msg.envelope) {
        const subject = msg.envelope.subject || "";
        const from = (msg.envelope.from?.[0]?.address || "").toLowerCase();
        if (subject && from) {
          hit = bySubjectTo.get(`${stripRePrefix(subject)}||${from}`);
        }
      }
      if (hit) matchedLogs.set(hit.id, hit);
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  const companies: string[] = [];
  for (const log of matchedLogs.values()) {
    const targets = await prisma.company.findMany({
      where: {
        OR: [{ email: log.toEmail }, { contacts: { some: { email: log.toEmail } } }],
      },
      select: { id: true, name: true, outreachStatus: true },
    });
    for (const c of targets) {
      if (c.outreachStatus === "REPLIED") continue;
      await prisma.company.update({
        where: { id: c.id },
        data: { outreachStatus: "REPLIED", lastRepliedAt: new Date() },
      });
      companies.push(c.name);
    }
  }

  return { checked, repliesFound: matchedLogs.size, companies };
}
