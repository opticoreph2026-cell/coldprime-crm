import { ImapFlow } from "imapflow";

export function createImapClient(): ImapFlow {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Gmail is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD)");
  }
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });
}

export async function resolveSentFolder(client: ImapFlow): Promise<string> {
  const list = await client.list();
  const sent =
    list.find((m) => (m as { specialUse?: string }).specialUse === "\\Sent") ||
    list.find((m) => /sent/i.test(m.name));
  if (!sent) throw new Error("Gmail Sent folder not found");
  return sent.path;
}

export async function openFolder(client: ImapFlow, folder: "inbox" | "sent"): Promise<void> {
  const path = folder === "sent" ? await resolveSentFolder(client) : "INBOX";
  await client.mailboxOpen(path);
}
