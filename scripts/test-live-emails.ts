/* Live probe for Phase 3 (Email guardrails, soft delete, templates).
   - status endpoint, approved template library
   - send guard blocks: unknown tags, opt-out, CC (one recipient), 7-day rule
   - opt-out endpoint mark/undo
   - template hard delete
   - sent-log soft delete + admin deleted filter + purge
   - staff forbidden from deleted filter
   - /emails pages render
   Usage: npx tsx scripts/test-live-emails.ts [baseUrl] */
import "dotenv/config";

const BASE = process.argv[2] || "https://coldprime-crm.vercel.app";
const STAMP = Date.now();
const PROBE_EMAIL = `guard-probe-${STAMP}@example.com`;

let passed = 0;
let failed = 0;

function ok(cond: boolean, label: string, extra = "") {
  if (cond) {
    passed++;
    console.log(`OK   ${label}${extra ? ` (${extra})` : ""}`);
  } else {
    failed++;
    console.log(`FAIL ${label}${extra ? ` (${extra})` : ""}`);
  }
}

async function login(email: string, password: string): Promise<string | null> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookies },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: "/", json: "true" }),
    redirect: "manual",
  });
  const session = loginRes.headers
    .getSetCookie()
    .filter((c) => c.startsWith("authjs.session-token=") || c.startsWith("__Secure-authjs.session-token="))
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!session || loginRes.status !== 302) return null;
  return [csrfCookies, session].join("; ");
}

async function loginWithFallback(email: string): Promise<string> {
  const candidates = [
    process.env.ADMIN_PASSWORD,
    (process.env.AUTH_ADMIN_PASSWORD || "").replace(/^"|"$/g, ""),
  ].filter((p): p is string => !!p);
  for (const pw of candidates) {
    const cookie = await login(email, pw);
    if (cookie) return cookie;
  }
  throw new Error(`login failed for ${email}`);
}

async function j(cookie: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      cookie,
      ...(init?.headers || {}),
    },
  });
  let body: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = await res.json(); } catch { /* non-json */ }
  return { status: res.status, body };
}

async function main() {
  const admin = await loginWithFallback(process.env.AUTH_ADMIN_EMAIL || "");
  console.log("admin login ok");

  const { prisma } = await import("../lib/prisma");
  const adminUser = await prisma.user.findUnique({
    where: { email: process.env.AUTH_ADMIN_EMAIL || "" },
    select: { id: true, branchId: true },
  });
  if (!adminUser?.branchId) throw new Error("admin user/branch not found");
  const branchId = adminUser.branchId;
  const company = await prisma.company.findFirst({ where: { branchId }, select: { id: true } });
  if (!company) throw new Error("no company in admin branch for probe contact");

  const contact = await prisma.contact.create({
    data: { branchId, companyId: company.id, firstName: "GuardProbe", lastName: `P${STAMP}`, email: PROBE_EMAIL },
  });

  try {
    // --- status endpoint ---------------------------------------------------
    const status = await j(admin, "/api/emails/status");
    ok(status.status === 200 && typeof status.body?.dailyCap === "number" && status.body.dailyCap >= 1,
      "GET /api/emails/status 200 with dailyCap", `cap=${status.body?.dailyCap} freeMail=${status.body?.freeMailWarning ?? "none"}`);
    ok(status.body && "freeMailWarning" in status.body, "status exposes freeMailWarning banner field");

    // --- approved template library ---------------------------------------
    const tpls = await j(admin, "/api/emails/templates");
    const names: string[] = (tpls.body?.data || []).map((t: { name: string }) => t.name);
    const approved = ["GC Accreditation", "Architect Design Partnership", "Facility Manager Preventive Maintenance", "Healthcare IAQ", "No-response follow-up", "Meeting request"];
    const missing = approved.filter((n) => !names.includes(n));
    ok(tpls.status === 200 && missing.length === 0, "approved template library seeded", missing.length ? `missing: ${missing.join(", ")}` : `${names.length} templates`);

    // --- guard blocks (nothing is actually sent) --------------------------
    const unknownTag = await j(admin, "/api/emails/send", {
      method: "POST",
      body: JSON.stringify({ toEmail: PROBE_EMAIL, subject: "Probe", body: "Hello {{bogusTagXyz}} goodbye" }),
    });
    ok(unknownTag.status === 403 && /Unknown merge tag/.test(unknownTag.body?.error || ""),
      "unknown {{tag}} blocks send (403)", unknownTag.body?.error);

    await prisma.contact.update({ where: { id: contact.id }, data: { emailOptOut: true, emailOptOutAt: new Date() } });
    const optOutSend = await j(admin, "/api/emails/send", {
      method: "POST",
      body: JSON.stringify({ toEmail: PROBE_EMAIL, subject: "Probe", body: "Should never send" }),
    });
    ok(optOutSend.status === 403 && /opted out/i.test(optOutSend.body?.error || ""),
      "emailOptOut contact blocks send (403)", optOutSend.body?.error);
    await prisma.contact.update({ where: { id: contact.id }, data: { emailOptOut: false, emailOptOutAt: null } });

    const withCc = await j(admin, "/api/emails/send", {
      method: "POST",
      body: JSON.stringify({ toEmail: PROBE_EMAIL, subject: "Probe", body: "One recipient only", cc: "second@example.com" }),
    });
    ok(withCc.status === 403 && /one recipient/i.test(withCc.body?.error || ""),
      "CC blocks send - one recipient per email (403)", withCc.body?.error);

    const weekLog = await prisma.emailLog.create({
      data: { branchId, fromUserId: adminUser.id, toEmail: PROBE_EMAIL, subject: "PROBE prior send", status: "SENT" },
    });
    const sevenDay = await j(admin, "/api/emails/send", {
      method: "POST",
      body: JSON.stringify({ toEmail: PROBE_EMAIL, subject: "Probe", body: "Second email within 7 days" }),
    });
    ok(sevenDay.status === 403 && /7 days/i.test(sevenDay.body?.error || ""),
      "second email within 7 days blocks send (403)", sevenDay.body?.error);
    await prisma.emailLog.delete({ where: { id: weekLog.id } });

    // --- opt-out endpoint --------------------------------------------------
    const mark = await j(admin, "/api/emails/opt-out", {
      method: "POST",
      body: JSON.stringify({ email: PROBE_EMAIL }),
    });
    ok(mark.status === 200 && mark.body?.updated >= 1 && mark.body?.emailOptOut === true,
      "POST /api/emails/opt-out marks contact", `updated=${mark.body?.updated}`);
    const afterMark = await prisma.contact.findUnique({ where: { id: contact.id }, select: { emailOptOut: true } });
    ok(afterMark?.emailOptOut === true, "contact emailOptOut persisted");

    const undo = await j(admin, "/api/emails/opt-out", {
      method: "POST",
      body: JSON.stringify({ email: PROBE_EMAIL, undo: true }),
    });
    const afterUndo = await prisma.contact.findUnique({ where: { id: contact.id }, select: { emailOptOut: true } });
    ok(undo.status === 200 && afterUndo?.emailOptOut === false, "undo opt-out restores contact (admin)");

    // --- template hard delete ---------------------------------------------
    const tpl = await j(admin, "/api/emails/templates", {
      method: "POST",
      body: JSON.stringify({ name: `PROBE TPL ${STAMP}`, subject: "Probe subject", body: "Probe body", category: "Probe" }),
    });
    const tplId = tpl.body?.id;
    ok(tpl.status === 201 && !!tplId, "POST /api/emails/templates 201", `status ${tpl.status}`);
    if (tplId) {
      const delTpl = await j(admin, `/api/emails/templates/${tplId}`, { method: "DELETE" });
      ok(delTpl.status === 200, "DELETE template 200 (hard delete)");
      const getDeleted = await j(admin, `/api/emails/templates/${tplId}`);
      ok(getDeleted.status === 404, "deleted template gone (404, not soft)", `status ${getDeleted.status}`);
    }

    // --- sent-log soft delete + deleted filter + purge ---------------------
    const logRow = await prisma.emailLog.create({
      data: { branchId, fromUserId: adminUser.id, toEmail: PROBE_EMAIL, subject: `PROBE SOFTDEL ${STAMP}`, status: "SENT" },
    });
    const softDel = await j(admin, `/api/emails/${logRow.id}`, { method: "DELETE" });
    ok(softDel.status === 200, "DELETE /api/emails/[id] soft delete 200", `status ${softDel.status}`);
    const normalLogs = await j(admin, "/api/emails/logs");
    const normalIds: string[] = (normalLogs.body?.data || []).map((l: { id: string }) => l.id);
    ok(normalLogs.status === 200 && !normalIds.includes(logRow.id), "soft-deleted row hidden from default logs");
    const deletedLogs = await j(admin, "/api/emails/logs?deleted=true");
    const deletedIds: string[] = (deletedLogs.body?.data || []).map((l: { id: string }) => l.id);
    ok(deletedLogs.status === 200 && deletedIds.includes(logRow.id), "admin deleted filter shows row");

    const noPurge = await prisma.emailLog.create({
      data: { branchId, fromUserId: adminUser.id, toEmail: PROBE_EMAIL, subject: `PROBE NOPURGE ${STAMP}`, status: "SENT" },
    });
    const purgeBlocked = await j(admin, `/api/emails/${noPurge.id}?purge=true`, { method: "DELETE" });
    ok(purgeBlocked.status === 400, "purge blocked on non-deleted row (400)", `status ${purgeBlocked.status}`);
    await prisma.emailLog.delete({ where: { id: noPurge.id } });

    const purge = await j(admin, `/api/emails/${logRow.id}?purge=true`, { method: "DELETE" });
    ok(purge.status === 200 && purge.body?.purged === true, "purge permanently deletes soft-deleted row");
    const afterPurge = await prisma.emailLog.findUnique({ where: { id: logRow.id } });
    ok(afterPurge === null, "purged row gone from database");

    // --- staff cannot view deleted emails ----------------------------------
    const staff = await loginWithFallback("cebu-staff@coldprime.ph");
    const staffDeleted = await j(staff, "/api/emails/logs?deleted=true");
    ok(staffDeleted.status === 403, "staff GET ?deleted=true forbidden (403)", `status ${staffDeleted.status}`);
    const staffNormal = await j(staff, "/api/emails/logs");
    ok(staffNormal.status === 200, "staff GET /api/emails/logs 200");

    // --- pages -------------------------------------------------------------
    const emailsPage = await fetch(`${BASE}/emails`, { headers: { cookie: admin }, redirect: "manual" });
    ok(emailsPage.status === 200, "GET /emails 200", `status ${emailsPage.status}`);
    const composePage = await fetch(`${BASE}/emails/compose`, { headers: { cookie: admin }, redirect: "manual" });
    ok(composePage.status === 200, "GET /emails/compose 200", `status ${composePage.status}`);
  } finally {
    await prisma.contact.delete({ where: { id: contact.id } }).catch(() => {});
    await prisma.emailLog.deleteMany({ where: { toEmail: PROBE_EMAIL } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
