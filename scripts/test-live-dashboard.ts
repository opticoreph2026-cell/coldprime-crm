export {};

import "dotenv/config";

const BASE = process.env.TEST_BASE || "https://coldprime-crm.vercel.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!PASSWORD) throw new Error("ADMIN_PASSWORD not set in .env");

async function main() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const setCookie = csrfRes.headers.getSetCookie?.() ?? [];
  const { csrfToken } = await csrfRes.json();
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const body = new URLSearchParams({ csrfToken, email: "admin@coldprime.ph", password: PASSWORD, redirect: "false", json: "true" });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body,
    redirect: "manual",
  });
  const sc = (res.headers.getSetCookie?.() ?? []).find((c) => c.includes("session-token"));
  if (!sc) throw new Error("login failed");
  const cookie = sc.split(";")[0];

  const dash = await fetch(`${BASE}/api/dashboard`, { headers: { cookie } });
  const d = await dash.json();
  const required = ["pipelineTotal", "pipelineByStatus", "followUpsDueToday", "accreditationsPending", "recentActivities", "totalVendors", "totalEmailTemplates", "totalActivities"];
  let fail = 0;
  for (const k of required) {
    const ok = d[k] !== undefined;
    if (!ok) fail++;
    console.log(`${ok ? "OK  " : "FAIL"} dashboard.${k} = ${JSON.stringify(d[k])?.slice(0, 80)}`);
  }

  for (const path of ["/dashboard", "/admin/statuses", "/vendors", "/companies", "/leads", "/contacts", "/projects", "/activities", "/users", "/email-templates"]) {
    const r = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    const ok = r.status === 200;
    if (!ok) fail++;
    console.log(`${ok ? "OK  " : "FAIL"} GET ${path} -> ${r.status}`);
  }

  console.log(`\nRESULT: ${fail === 0 ? "all passed" : fail + " failed"}`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
