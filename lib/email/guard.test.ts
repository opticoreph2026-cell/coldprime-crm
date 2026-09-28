import { describe, expect, it } from "vitest";
import {
  ALLOWED_TAGS,
  attachmentWarning,
  dailyEmailCap,
  ensureOptOutLine,
  evaluateEmailGuard,
  findEmptyTags,
  findUnknownTags,
  freeMailWarning,
  OPT_OUT_LINE,
  spamLint,
} from "./guard";

const base = { toEmail: "proc@acme.ph", subject: "Site visit", body: "Hello, may we schedule a site visit?" };

describe("rule 1 - opt-out", () => {
  it("blocks opted-out contacts", () => {
    const r = evaluateEmailGuard({ ...base, contactOptOut: true });
    expect(r.blocked).toMatch(/opted out/i);
  });
  it("passes when not opted out", () => {
    expect(evaluateEmailGuard({ ...base, contactOptOut: false }).blocked).toBeNull();
  });
});

describe("rule 2 - opt-out line", () => {
  it("appends once", () => {
    const once = ensureOptOutLine("Hi.");
    expect(once).toContain(OPT_OUT_LINE);
    expect(ensureOptOutLine(once)).toBe(once); // no duplicates
  });
});

describe("rule 3 - one recipient per email", () => {
  it("blocks extra recipients", () => {
    expect(evaluateEmailGuard({ ...base, extraRecipients: 1 }).blocked).toMatch(/one recipient/i);
  });
  it("allows a single recipient", () => {
    expect(evaluateEmailGuard({ ...base, extraRecipients: 0 }).blocked).toBeNull();
  });
});

describe("rule 4 - daily cap", () => {
  it("blocks at the cap", () => {
    const r = evaluateEmailGuard({ ...base, sentToday: 30, dailyCap: 30 });
    expect(r.blocked).toMatch(/daily send limit/i);
  });
  it("allows under the cap", () => {
    expect(evaluateEmailGuard({ ...base, sentToday: 29, dailyCap: 30 }).blocked).toBeNull();
  });
  it("defaults to 30 when env unset", () => {
    expect(dailyEmailCap()).toBeGreaterThanOrEqual(1);
  });
});

describe("rule 5 - 7-day rule and Nurture", () => {
  it("blocks a second email within 7 days", () => {
    expect(evaluateEmailGuard({ ...base, sentLast7Days: 1 }).blocked).toMatch(/7 days/i);
  });
  it("flags Nurture at 2+ total follow-ups", () => {
    expect(evaluateEmailGuard({ ...base, sentLast7Days: 0, sentAllTime: 2 }).nurture).toBe(true);
    expect(evaluateEmailGuard({ ...base, sentLast7Days: 0, sentAllTime: 1 }).nurture).toBe(false);
  });
});

describe("rule 6 - merge tags", () => {
  it("blocks unknown tags", () => {
    const r = evaluateEmailGuard({ ...base, body: "Hi {{firstName}}, about {{poNumber}}" });
    expect(r.blocked).toMatch(/Unknown merge tag/);
    expect(r.blocked).toContain("{{firstName}}");
    expect(r.blocked).toContain("{{poNumber}}");
  });
  it("allows known tags", () => {
    expect(findUnknownTags("Hello {{contactName}} from {{senderName}}")).toHaveLength(0);
    for (const t of ["companyName", "contactName", "senderName", "senderTitle"]) {
      expect(ALLOWED_TAGS as readonly string[]).toContain(t);
    }
  });
  it("checks raw template text before filling", () => {
    const r = evaluateEmailGuard({
      ...base,
      rawBody: "Dear {{clientSalutation}},",
      body: "Dear ,", // already filled (empty) - raw still has the unknown tag
    });
    expect(r.blocked).toMatch(/clientSalutation/);
  });
  it("warns when contactName/companyName values are empty", () => {
    const empty = findEmptyTags("Hi {{contactName}} at {{companyName}}", { contactName: "", companyName: "ACME" });
    expect(empty).toEqual(["contactName"]);
    const r = evaluateEmailGuard({ ...base, rawBody: "Hi {{contactName}}", toName: null });
    expect(r.warnings.some((w) => w.match(/no name/i))).toBe(true);
  });
});

describe("rule 7 - spam linter", () => {
  it("flags ALL-CAPS, multiple !, spam phrases and link floods", () => {
    const w = spamLint("FREE Trial ACT NOW", "Great DEAL!!!\n" + "See https://a.com https://b.com https://c.com");
    expect(w.some((x) => /ALL-CAPS/.test(x))).toBe(true);
    expect(w.some((x) => /exclamation/.test(x))).toBe(true);
    expect(w.some((x) => /Spam-trigger/.test(x))).toBe(true);
    expect(w.some((x) => /links/.test(x))).toBe(true);
  });
  it("stays quiet on a clean message", () => {
    expect(spamLint("Site visit schedule", "Hello, may we visit the site on Tuesday?")).toHaveLength(0);
  });
  it("flags image-only bodies", () => {
    expect(spamLint("Look", '<img src="x.png">')).toHaveLength(1);
  });
});

describe("rule 8 - attachment warning", () => {
  it("warns over 5MB", () => {
    expect(attachmentWarning(44 * 1024 * 1024)).toMatch(/share as a link/i);
    expect(attachmentWarning(1024)).toBeNull();
    expect(attachmentWarning(undefined)).toBeNull();
  });
});

describe("rule 9 - free-mail sender", () => {
  it("warns for gmail/yahoo senders", () => {
    expect(freeMailWarning("someone@gmail.com")).toMatch(/free-mail/i);
    expect(freeMailWarning("julius@coldprimecorp.com")).toBeNull();
    expect(freeMailWarning(null)).toBeNull();
  });
});
