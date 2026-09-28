/* Live probe for Phase 4 (audit defects).
   - lead status definitions include On Hold + Nurture
   - companies accreditation filter (valid + invalid value no 500)
   - dashboard: new week stats + activeLeads matches DB (excludes Won/Lost)
   - cross-branch guards: lead PUT companyId, vendors import vendorId
   - GET /api/users follows getBranchFilter (active branch switch)
   - import preview: headers + rawData from actual cells
   Usage: npx tsx scripts/test-live-phase4.ts [baseUrl] */
import "dotenv/config";
import * as XLSX from "xlsx";

const BASE = process.argv[2] || "https://coldprime-crm.vercel.app";
const STAMP = Date.now();

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

  try {
    // --- P4.3 lead status definitions -------------------------------------
    const statuses = await j(admin, "/api/status-definitions?type=lead");
    const names: string[] = (Array.isArray(statuses.body) ? statuses.body : statuses.body?.data || [])
      .map((s: { name: string }) => s.name);
    ok(statuses.status === 200 && names.includes("On Hold") && names.includes("Nurture"),
      "lead status definitions include On Hold + Nurture", `total ${names.length}`);

    // --- P4.7 accreditation filter ----------------------------------------
    const accrOk = await j(admin, "/api/companies?accreditation=UNDER_REVIEW");
    ok(accrOk.status === 200, "GET /api/companies?accreditation=UNDER_REVIEW 200", `status ${accrOk.status}`);
    const accrBad = await j(admin, "/api/companies?accreditation=NOT_A_STATUS");
    ok(accrBad.status === 200, "invalid accreditation value ignored (200, no 500)", `status ${accrBad.status}`);
    const typeBad = await j(admin, "/api/companies?type=BOGUS_TYPE");
    ok(typeBad.status === 200, "invalid type value ignored (200, no 500)", `status ${typeBad.status}`);

    // --- P4.2 dashboard ----------------------------------------------------
    const dash = await j(admin, "/api/dashboard");
    ok(dash.status === 200 && typeof dash.body?.activitiesThisWeek === "number" && typeof dash.body?.newLeadsThisWeek === "number",
      "dashboard exposes this-week stats", `activities=${dash.body?.activitiesThisWeek} leads=${dash.body?.newLeadsThisWeek}`);
    const dbActive = await prisma.lead.count({ where: { status: { notIn: ["Won", "Lost"] } } });
    ok(dash.body?.activeLeads === dbActive,
      "activeLeads excludes Won/Lost (matches DB)", `api=${dash.body?.activeLeads} db=${dbActive}`);

    // --- P4.1 cross-branch guards -----------------------------------------
    const lead = await j(admin, "/api/leads", {
      method: "POST",
      body: JSON.stringify({ type: "PROJECT_BID", source: "probe" }),
    });
    const leadId = lead.body?.id;
    ok(lead.status === 201 && !!leadId, "POST /api/leads 201 (no company)", `status ${lead.status}`);
    if (leadId) {
      const putBad = await j(admin, `/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ companyId: "comp_does_not_exist" }),
      });
      ok(putBad.status === 400, "lead PUT unknown companyId blocked (400)", putBad.body?.error);
      await j(admin, `/api/leads/${leadId}`, { method: "DELETE" });
    }

    const csv = Buffer.from("Vendor,Brand,Model,Item\n", "utf8");
    const fd = new FormData();
    fd.append("file", new File([csv], "probe.csv", { type: "text/csv" }));
    fd.append("vendorId", "vend_does_not_exist");
    fd.append("action", "preview");
    const vendImp = await j(admin, "/api/vendors/import", { method: "POST", body: fd });
    ok(vendImp.status === 400, "vendors import unknown vendorId blocked (400)", vendImp.body?.error);

    // --- P4.6 users route follows active branch ---------------------------
    const allUsers = await j(admin, "/api/users");
    const allEmails: string[] = (allUsers.body?.data || []).map((u: { email: string }) => u.email);
    ok(allUsers.status === 200 && allEmails.includes("manila-staff@coldprime.ph"),
      "GET /api/users (no active branch) shows all branches", `count=${allEmails.length}`);

    await j(admin, "/api/auth/switch-branch", { method: "POST", body: JSON.stringify({ branchId: "branch_manila" }) });
    const manilaUsers = await j(admin, "/api/users");
    const manilaEmails: string[] = (manilaUsers.body?.data || []).map((u: { email: string }) => u.email);
    ok(manilaEmails.includes("manila-staff@coldprime.ph") && !manilaEmails.includes("cebu-staff@coldprime.ph"),
      "GET /api/users filtered to active branch (Manila)", `count=${manilaEmails.length}`);

    await j(admin, "/api/auth/switch-branch", { method: "POST", body: JSON.stringify({ branchId: null }) });
    const restored = await j(admin, "/api/users");
    const restoredEmails: string[] = (restored.body?.data || []).map((u: { email: string }) => u.email);
    ok(restoredEmails.includes("cebu-staff@coldprime.ph"), "active branch cleared, all users visible again");

    // --- P4.5 import preview headers/rawData ------------------------------
    const aoa: unknown[][] = [
      ["", "", ""],
      ["", "", ""],
      ["Date", "Customer", "Email"],
      ["2026-01-05", `Probe Import ${STAMP}`, `probe-${STAMP}@example.com`],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Customer");
    const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const fd2 = new FormData();
    fd2.append("file", new File([new Uint8Array(xlsxBuf)], "probe.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    fd2.append("action", "preview");
    const imp = await j(admin, "/api/import", { method: "POST", body: fd2 });
    const sheet = imp.body?.sheets?.[0];
    ok(imp.status === 200 && (sheet?.headers || []).includes("Customer"),
      "import preview derives headers from header row", JSON.stringify(sheet?.headers));
    const row = (sheet?.rows || []).find((r: { company?: string }) => r.company === `Probe Import ${STAMP}`);
    ok(row?.rawData?.Customer === `Probe Import ${STAMP}` && row?.rawData?.Email === `probe-${STAMP}@example.com`,
      "rawData holds actual cell values", JSON.stringify(row?.rawData));

    // --- pages -------------------------------------------------------------
    const companiesPage = await fetch(`${BASE}/companies`, { headers: { cookie: admin }, redirect: "manual" });
    ok(companiesPage.status === 200, "GET /companies 200", `status ${companiesPage.status}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
