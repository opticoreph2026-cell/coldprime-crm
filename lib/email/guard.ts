// Anti-spam guardrails (master instructions Phase 3, rules 1-10).
// Server-side only: called by the send routes before anything leaves the
// building. evaluateEmailGuard is pure so it can be unit tested without a DB.

export const OPT_OUT_LINE = "If this isn't relevant, just reply and I won't email you again.";

/** Merge tags the CRM knows how to fill. Anything else must block sending. */
export const ALLOWED_TAGS = [
  "companyName",
  "contactName",
  "senderName",
  "senderTitle",
  "branchName",
  "branchLocation",
  "targetDate",
] as const;

const FREE_MAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.com.ph",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
];

const SPAM_PHRASES = ["free", "guaranteed", "act now", "limited time", "no obligation", "risk free"];

export interface GuardInput {
  toEmail: string;
  toName?: string | null;
  subject: string;
  /** Raw (pre-fill) template text when a template was used, else the body as composed. */
  rawSubject?: string;
  rawBody?: string;
  body: string;
  fromEmail?: string | null;
  /** Set when the recipient resolved to a Contact row. */
  contactOptOut?: boolean;
  /** Any extra recipients beyond the single To (CC/BCC). One recipient per email. */
  extraRecipients?: number;
  /** Emails already sent to this address in the last 7 days. */
  sentLast7Days?: number;
  /** Total emails ever sent to this address (follow-up counter). */
  sentAllTime?: number;
  /** Emails the sender already sent today (Manila day). */
  sentToday?: number;
  dailyCap?: number;
  /** Attachment size in bytes, if the send ever supports attachments. */
  attachmentBytes?: number;
}

export interface GuardResult {
  /** Non-null = the send must be rejected; the message goes to the client. */
  blocked: string | null;
  /** Non-blocking advisories; surface them in the UI after a successful send. */
  warnings: string[];
  /** True when this send pushes the contact past 2 follow-ups -> mark lead Nurture. */
  nurture: boolean;
}

export function dailyEmailCap(): number {
  const raw = Number(process.env.EMAIL_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 30;
}

/** Rule 6: unknown/unresolved {{tags}} must block sending. */
export function findUnknownTags(...texts: (string | undefined | null)[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
      const tag = match[1];
      if (!(ALLOWED_TAGS as readonly string[]).includes(tag)) found.add(tag);
    }
  }
  return [...found];
}

/** Rule 6: tags present but the value is empty (generic emails get flagged). */
export function findEmptyTags(
  rawText: string | undefined | null,
  values: Record<string, string>
): string[] {
  if (!rawText) return [];
  const found = new Set<string>();
  for (const match of rawText.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const tag = match[1];
    if ((ALLOWED_TAGS as readonly string[]).includes(tag) && !values[tag]) {
      found.add(tag);
    }
  }
  return [...found];
}

/** Rule 7: spam-content linter. */
export function spamLint(subject: string, body: string): string[] {
  const warnings: string[] = [];
  const text = `${subject}\n${body}`;

  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  if (capsWords.length > 0) {
    warnings.push(`ALL-CAPS words: ${[...new Set(capsWords)].slice(0, 5).join(", ")}`);
  }

  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 1) warnings.push(`${exclamations} exclamation marks — keep to one`);

  const lower = text.toLowerCase();
  const hits = SPAM_PHRASES.filter((p) => lower.includes(p));
  if (hits.length > 0) warnings.push(`Spam-trigger phrases: ${hits.join(", ")}`);

  const links = (body.match(/https?:\/\//gi) || []).length;
  if (links > 2) warnings.push(`${links} links — use at most 2`);

  const hasImage = /<img\b/i.test(body);
  const visibleText = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (hasImage && visibleText.length < 40) {
    warnings.push("Image-only body — plain text gets delivered more reliably");
  }

  return warnings;
}

/** Rule 9: warn when sending from a free-mail domain. */
export function freeMailWarning(fromEmail?: string | null): string | null {
  if (!fromEmail || !fromEmail.includes("@")) return null;
  const domain = fromEmail.split("@")[1].toLowerCase();
  if (FREE_MAIL_DOMAINS.includes(domain)) {
    return `Sending from ${domain} (free-mail) — deliverability improves with a company-domain address + SPF/DKIM/DMARC`;
  }
  return null;
}

/** Rule 8: warn for attachments over 5MB (Gmail's limit is 25MB; profile PDF is ~44MB). */
export function attachmentWarning(bytes?: number): string | null {
  if (bytes && bytes > 5 * 1024 * 1024) {
    return `Attachment is ${(bytes / 1024 / 1024).toFixed(0)} MB — over 5MB; share as a link instead`;
  }
  return null;
}

/** Rule 2: append the plain opt-out line once. */
export function ensureOptOutLine(body: string): string {
  if (body.includes("reply and I won't email you again")) return body;
  return `${body.trimEnd()}\n\n${OPT_OUT_LINE}`;
}

export function evaluateEmailGuard(input: GuardInput): GuardResult {
  const warnings: string[] = [];
  let blocked: string | null = null;

  // Rule 1: opted-out contacts are blocked outright.
  if (input.contactOptOut) {
    blocked = "This contact has opted out of email — remove them from the list first.";
  }

  // Rule 3: one recipient per email, no bulk CC/BCC.
  if (!blocked && (input.extraRecipients || 0) > 0) {
    blocked = "One recipient per email — CC/BCC is not allowed. Send one email per contact.";
  }

  // Rule 4: daily cap per user.
  const cap = input.dailyCap ?? dailyEmailCap();
  if (!blocked && input.sentToday !== undefined && input.sentToday >= cap) {
    blocked = `Daily send limit reached (${cap} emails today). Try again tomorrow.`;
  }

  // Rule 5: no second email to the same contact within 7 days.
  if (!blocked && (input.sentLast7Days || 0) > 0) {
    blocked = "This contact was emailed within the last 7 days — wait before following up again.";
  }

  // Rule 6: unresolved merge tags block sending (check raw text before filling).
  if (!blocked) {
    const unknown = findUnknownTags(
      input.rawSubject ?? input.subject,
      input.rawBody ?? input.body
    );
    if (unknown.length > 0) {
      blocked = `Unknown merge tag${unknown.length > 1 ? "s" : ""}: ${unknown
        .map((t) => `{{${t}}}`)
        .join(", ")}`;
    }
  }

  // Rule 6b: present-but-empty values are warnings, not blockers.
  if (!blocked) {
    const empty = findEmptyTags(input.rawBody, { contactName: input.toName || "" });
    if (empty.includes("contactName") && !input.toName) {
      warnings.push("Recipient has no name — the email will read as generic");
    }
    if (empty.includes("companyName")) {
      warnings.push("Company name is missing for this recipient");
    }
  }

  // Rule 7: spam-content linter.
  if (!blocked) {
    warnings.push(...spamLint(input.subject, input.body));
  }

  // Rule 9: free-mail sender domain.
  const freeMail = freeMailWarning(input.fromEmail);
  if (freeMail) warnings.push(freeMail);

  // Rule 8: oversized attachment.
  const attachment = attachmentWarning(input.attachmentBytes);
  if (attachment) warnings.push(attachment);

  // Rule 5b: at most 2 follow-ups, then the lead goes to Nurture.
  const nurture = !blocked && (input.sentAllTime || 0) >= 2;

  return { blocked, warnings, nurture };
}
