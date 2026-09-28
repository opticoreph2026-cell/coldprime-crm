/* Live probe for the weekly accomplishment report endpoints.
   Logs in with credentials, then exercises:
   legacy redirect, validation 400s, JSON report, PDF/Excel exports,
   /reports page, and the weekly note upsert (uses a far-future week).
   Usage: npx tsx scripts/test-live-reports.ts [baseUrl] */
import "dotenv/config";

const BASE = process.argv[2] || "https://coldprime-crm.vercel.app";

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

async function login(): Promise<string> {
  const email = process.env.AUTH_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("AUTH_ADMIN_EMAIL / ADMIN_PASSWORD missing in .env");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl: "/",
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookies },
    body,
    redirect: "manual",
  });
  const setCookies = loginRes.headers.getSetCookie();
  const session = setCookies
    .filter((c) => c.startsWith("authjs.session-token=") || c.startsWith("__Secure-authjs.session-token="))
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!session) throw new Error(`no session cookie (status ${loginRes.status})`);
  return [csrfCookies, session].join("; ");
}

async function get(path: string, cookie: string) {
  return fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
}

async function main() {
  const cookie = await login();
  console.log("login ok\n");

  // 1. Legacy endpoint redirects to the weekly API
  const legacy = await get("/api/reports?from=2026-09-28&to=2026-10-04", cookie);
  const loc = legacy.headers.get("location") || "";
  ok([302, 303, 307, 308].includes(legacy.status) && loc.includes("/api/reports/weekly"),
    "legacy /api/reports redirects", `${legacy.status} -> ${loc}`);

  // 2. from > to -> 400
  const bad1 = await get("/api/reports/weekly?from=2026-10-05&to=2026-09-28", cookie);
  ok(bad1.status === 400, "from > to rejected", `status ${bad1.status}`);

  // 3. range > 366 days -> 400
  const bad2 = await get("/api/reports/weekly?from=2024-01-01&to=2026-01-02", cookie);
  ok(bad2.status === 400, "range > 366 days rejected", `status ${bad2.status}`);

  // 4. Valid JSON report
  const json = await get("/api/reports/weekly?from=2026-09-28&to=2026-10-11&format=json", cookie);
  const report = json.status === 200 ? await json.json() : null;
  ok(json.status === 200, "JSON report 200", `status ${json.status}`);
  if (report) {
    ok(Array.isArray(report.weeks) && report.weeks.length === 2, "two weeks in range", `${report.weeks?.length}`);
    ok(typeof report.totals?.calls === "number", "totals present");
    ok(Array.isArray(report.limitations) && report.limitations.length > 0, "limitations footer present");
    ok(!!report.scope?.branchName && report.scope?.userName !== undefined, "scope present");
  }

  // 5. PDF export
  const pdf = await get("/api/reports/weekly?from=2026-09-28&to=2026-10-04&format=pdf", cookie);
  const pdfBuf = pdf.status === 200 ? Buffer.from(await pdf.arrayBuffer()) : null;
  ok(pdf.status === 200 && !!pdfBuf && pdfBuf.subarray(0, 5).toString() === "%PDF-",
    "PDF export", `status ${pdf.status}, ${pdfBuf?.length} bytes`);
  ok((pdf.headers.get("content-disposition") || "").includes("filename="), "PDF filename header");

  // 6. Excel export
  const xlsx = await get("/api/reports/weekly?from=2026-09-28&to=2026-10-04&format=xlsx", cookie);
  const xlsxBuf = xlsx.status === 200 ? Buffer.from(await xlsx.arrayBuffer()) : null;
  ok(xlsx.status === 200 && !!xlsxBuf && xlsxBuf.subarray(0, 2).toString() === "PK",
    "Excel export", `status ${xlsx.status}, ${xlsxBuf?.length} bytes`);

  // 7. /reports page loads for a logged-in user
  const page = await get("/reports", cookie);
  ok(page.status === 200, "/reports page 200", `status ${page.status}`);

  // 8. Weekly note upsert (far-future week, normalized to its Monday)
  const note1 = await fetch(`${BASE}/api/reports/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ weekStart: "2027-01-06", highlights: "probe note", blockers: "" }),
  });
  const noteData = note1.status === 200 ? await note1.json() : null;
  ok(note1.status === 200, "PUT /api/reports/notes 200", `status ${note1.status}`);
  ok(noteData?.weekStart === "2027-01-04", "weekStart normalized to Monday", `got ${noteData?.weekStart}`);

  const note2 = await fetch(`${BASE}/api/reports/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ weekStart: "2027-01-04", highlights: "probe note v2", blockers: "none" }),
  });
  ok(note2.status === 200, "idempotent re-save 200", `status ${note2.status}`);

  // 9. Bad body -> 400
  const badNote = await fetch(`${BASE}/api/reports/notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ highlights: "missing weekStart" }),
  });
  ok(badNote.status === 400, "note missing weekStart rejected", `status ${badNote.status}`);

  // 10. Anonymous access stays gated
  const anon = await fetch(`${BASE}/api/reports/weekly`, { redirect: "manual" });
  ok(anon.status >= 300 && anon.status < 400, "anonymous redirected to login", `status ${anon.status}`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("PROBE ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
