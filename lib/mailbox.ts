import { simpleParser } from "mailparser";
import { createImapClient, openFolder } from "./imap";
import {
  buildLogIndex,
  loadSentLogs,
  matchLog,
  matchSentLog,
  normalizeId,
  rawHeaderText,
  LogEntry,
  LogIndex,
} from "./reply-check";

export interface MailSummary {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  matched: boolean;
  company: { id: string; name: string } | null;
}

export interface MailDetail extends MailSummary {
  html: string | null;
  text: string | null;
  cc: string;
}

interface AddrLike {
  name?: string | false | null;
  address?: string | null;
}

function fmtAddrs(addrs?: AddrLike[] | null): string {
  if (!addrs || addrs.length === 0) return "";
  return addrs
    .map((a) => {
      const addr = a.address || "";
      return a.name ? `${a.name} <${addr}>` : addr;
    })
    .join(", ");
}

async function mapEmailsToCompanies(emails: string[]): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  const uniq = [...new Set(emails.map((e) => e.toLowerCase()).filter(Boolean))];
  if (uniq.length === 0) return map;
  const { prisma } = await import("./prisma");
  const companies = await prisma.company.findMany({
    where: { OR: [{ email: { in: uniq } }, { contacts: { some: { email: { in: uniq } } } }] },
    select: { id: true, name: true, email: true, contacts: { select: { email: true } } },
  });
  for (const c of companies) {
    const entry = { id: c.id, name: c.name };
    if (c.email) map.set(c.email.toLowerCase(), entry);
    for (const ct of c.contacts) {
      if (ct.email) map.set(ct.email.toLowerCase(), entry);
    }
  }
  return map;
}

export async function listMail(opts: {
  folder: "inbox" | "sent";
  days?: number;
  limit?: number;
}): Promise<MailSummary[]> {
  const days = Math.min(Math.max(opts.days ?? 30, 1), 90);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  const index = buildLogIndex(await loadSentLogs());
  const client = createImapClient();
  await client.connect();
  try {
    await openFolder(client, opts.folder);
    const since = new Date(Date.now() - days * 864e5);
    const fetchQuery = opts.folder === "inbox" ? { uid: true, envelope: true, internalDate: true, headers: true } : { uid: true, envelope: true, internalDate: true };
    type Row = { uid: number; subject: string; from: string; to: string; date: Date | null; hit?: LogEntry };
    const raw: Row[] = [];
    for await (const msg of client.fetch({ since }, fetchQuery)) {
      const env = msg.envelope;
      if (!msg.uid || !env) continue;
      const hit = opts.folder === "inbox" ? matchLog(index, msg.headers, env) : matchSentLog(index, env);
      const date = (msg.internalDate as Date | undefined) || env.date || null;
      raw.push({
        uid: msg.uid,
        subject: env.subject || "(no subject)",
        from: fmtAddrs(env.from as AddrLike[] | null),
        to: fmtAddrs(env.to as AddrLike[] | null),
        date: date ? new Date(date) : null,
        hit,
      });
    }
    raw.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    const top = raw.slice(0, limit);
    const companyMap = await mapEmailsToCompanies(top.filter((t) => t.hit).map((t) => t.hit!.toEmail));
    return top.map((row) => ({
      uid: row.uid,
      subject: row.subject,
      from: row.from,
      to: row.to,
      date: row.date ? row.date.toISOString() : null,
      matched: Boolean(row.hit),
      company: row.hit ? companyMap.get(row.hit.toEmail.toLowerCase()) || null : null,
    }));
  } finally {
    await client.logout().catch(() => {});
  }
}

async function parseDetail(source: Buffer, uid: number, index: LogIndex, matched: boolean): Promise<MailDetail> {
  const parsed = await simpleParser(source);
  const fakeHeaders = new Map<string, string | string[]>([
    ["in-reply-to", parsed.inReplyTo || ""],
    ["references", Array.isArray(parsed.references) ? parsed.references : parsed.references ? String(parsed.references) : ""],
  ]);
  const envelopeLike = {
    subject: parsed.subject || "",
    from: (parsed.from?.value || []).map((v) => ({ address: v.address })),
  };
  const hit = matched ? matchLog(index, fakeHeaders, envelopeLike) : undefined;
  const companyMap = await mapEmailsToCompanies(hit ? [hit.toEmail] : []);
  const html = typeof parsed.html === "string" && parsed.html ? parsed.html : null;
  return {
    uid,
    subject: parsed.subject || "(no subject)",
    from: fmtAddrs((parsed.from?.value || []).map((v) => ({ name: v.name, address: v.address })) as AddrLike[]),
    to: fmtAddrs((parsed.to as { value?: AddrLike[] } | undefined)?.value || []),
    cc: fmtAddrs((parsed.cc as { value?: AddrLike[] } | undefined)?.value || []),
    date: parsed.date ? new Date(parsed.date).toISOString() : null,
    matched,
    company: hit ? companyMap.get(hit.toEmail.toLowerCase()) || null : null,
    html,
    text: parsed.text || null,
  };
}

export async function getMailDetail(opts: { folder: "inbox" | "sent"; uid: number }): Promise<MailDetail> {
  const index = buildLogIndex(await loadSentLogs());
  const client = createImapClient();
  await client.connect();
  try {
    await openFolder(client, opts.folder);
    const msg = await client.fetchOne(String(opts.uid), { source: true, envelope: true, uid: true }, { uid: true });
    if (!msg || !msg.source) throw new Error("Message not found");
    const hit = opts.folder === "inbox" ? matchLog(index, msg.headers, msg.envelope) : matchSentLog(index, msg.envelope);
    return await parseDetail(msg.source, msg.uid || opts.uid, index, Boolean(hit));
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function getMailByLogId(logId: string, branchId?: string): Promise<MailDetail> {
  const { prisma } = await import("./prisma");
  const log = await prisma.emailLog.findFirst({
    where: { id: logId, ...(branchId ? { branchId } : {}) },
  });
  if (!log) throw new Error("Log not found");
  let storedMid: string | undefined;
  try {
    const raw = typeof log.metadata === "string" ? JSON.parse(log.metadata) : log.metadata;
    storedMid = (raw as { messageId?: string } | null)?.messageId;
  } catch {}
  if (!storedMid) throw new Error("No stored message id for this log entry");
  const want = normalizeId(storedMid);

  const index = buildLogIndex(await loadSentLogs());
  const client = createImapClient();
  await client.connect();
  try {
    await openFolder(client, "sent");
    const since = new Date(new Date(log.sentAt).getTime() - 864e5);
    let foundUid: number | undefined;
    let scanned = 0;
    for await (const msg of client.fetch({ since }, { uid: true, headers: true })) {
      if (++scanned > 1000) break;
      const text = rawHeaderText(msg.headers).replace(/\r?\n[ \t]+/g, " ");
      const own = /message-id:\s*([^\r\n]+)/i.exec(text);
      if (own && normalizeId(own[1]) === want) {
        foundUid = msg.uid;
        break;
      }
    }
    if (!foundUid) throw new Error("Message not found in Gmail Sent folder");
    const msg = await client.fetchOne(String(foundUid), { source: true, envelope: true, uid: true }, { uid: true });
    if (!msg || !msg.source) throw new Error("Message not found in Gmail Sent folder");
    const hit = matchSentLog(index, msg.envelope);
    return await parseDetail(msg.source, msg.uid || foundUid, index, Boolean(hit));
  } finally {
    await client.logout().catch(() => {});
  }
}
