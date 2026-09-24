import { ImapFlow } from "imapflow";

const LOOKBACK_DAYS = 7;

export function normalizeId(id: string): string {
  return id.trim().toLowerCase().replace(/^<|>$/g, "");
}

export function stripRePrefix(subject: string): string {
  return subject.replace(/^\s*((re|fwd?|aw)\s*:\s*)+/gi, "").trim().toLowerCase();
}

export function rawHeaderText(headers: unknown): string {
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

export function extractRefs(headers: unknown): string[] {
  const text = rawHeaderText(headers).replace(/\r?\n[ \t]+/g, " ");
  const refs: string[] = [];
  const ir = /in-reply-to:\s*([^\r\n]+)/i.exec(text);
  const rf = /references:\s*([^\r\n]+)/i.exec(text);
  if (ir) refs.push(...ir[1].trim().split(/\s+/).filter(Boolean));
  if (rf) refs.push(...rf[1].trim().split(/\s+/).filter(Boolean));
  return refs;
}

export interface LogEntry {
  id: string;
  toEmail: string;
  subject: string;
  metadata: unknown;
}

export interface LogIndex {
  byMessageId: Map<string, LogEntry>;
  bySubjectTo: Map<string, LogEntry>;
}

export interface EnvelopeLike {
  subject?: string | null;
  from?: Array<{ address?: string | null }> | null;
  to?: Array<{ address?: string | null }> | null;
}

export function buildLogIndex(logs: LogEntry[]): LogIndex {
  const byMessageId = new Map<string, LogEntry>();
  const bySubjectTo = new Map<string, LogEntry>();
  for (const log of logs) {
    try {
      const raw = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
      const mid = (raw as { messageId?: string } | null)?.messageId;
      if (mid) byMessageId.set(normalizeId(mid), log);
    } catch {}
    bySubjectTo.set(`${stripRePrefix(log.subject)}||${log.toEmail.toLowerCase()}`, log);
  }
  return { byMessageId, bySubjectTo };
}

export function matchLog(index: LogIndex, headers: unknown, envelope?: EnvelopeLike | null): LogEntry | undefined {
  for (const ref of extractRefs(headers)) {
    const hit = index.byMessageId.get(normalizeId(ref));
    if (hit) return hit;
  }
  if (envelope) {
    const subject = envelope.subject || "";
    const from = (envelope.from?.[0]?.address || "").toLowerCase();
    if (subject && from) {
      const hit = index.bySubjectTo.get(`${stripRePrefix(subject)}||${from}`);
      if (hit) return hit;
    }
  }
  return undefined;
}

export function matchSentLog(index: LogIndex, envelope?: EnvelopeLike | null): LogEntry | undefined {
  const subject = envelope?.subject || "";
  if (!subject) return undefined;
  for (const a of envelope?.to || []) {
    const addr = (a.address || "").toLowerCase();
    if (!addr) continue;
    const hit = index.bySubjectTo.get(`${stripRePrefix(subject)}||${addr}`);
    if (hit) return hit;
  }
  return undefined;
}

export async function loadSentLogs(): Promise<LogEntry[]> {
  const { prisma } = await import("./prisma");
  return prisma.emailLog.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: 1000,
    select: { id: true, toEmail: true, subject: true, metadata: true },
  });
}

export interface ReplyCheckResult {
  checked: number;
  repliesFound: number;
  companies: string[];
}

export async function checkReplies(opts?: { branchId?: string }): Promise<ReplyCheckResult> {
  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error("Gmail is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD)");
  }

  const { prisma } = await import("./prisma");

  const logs = await loadSentLogs();
  const index = buildLogIndex(logs);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    logger: false,
  });

  let checked = 0;
  const matchedLogs = new Map<string, LogEntry>();

  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    for await (const msg of client.fetch({ since }, { envelope: true, headers: true })) {
      checked++;
      const hit = matchLog(index, msg.headers, msg.envelope);
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
        ...(opts?.branchId ? { branchId: opts.branchId } : {}),
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
