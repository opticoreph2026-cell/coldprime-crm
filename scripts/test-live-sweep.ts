export {};

import "dotenv/config";

const BASE = process.env.TEST_BASE || "https://coldprime-crm.vercel.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!PASSWORD) throw new Error("ADMIN_PASSWORD not set in .env");

let cookie = "";

async function login(): Promise<void> {
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
  cookie = sc.split(";")[0];
}

const API_GETS = [
  "/api/branches",
  "/api/companies?limit=5",
  "/api/contacts?limit=5",
  "/api/leads?limit=5",
  "/api/projects?limit=5",
  "/api/activities?limit=5",
  "/api/vendors?limit=5",
  "/api/users",
  "/api/documents?limit=5",
  "/api/dashboard",
  "/api/status-definitions",
  "/api/status-definitions?all=1",
  "/api/status-definitions?type=lead",
  "/api/status-definitions?type=company&all=1",
  "/api/reports",
  "/api/emails?limit=5",
  "/api/emails/templates",
  "/api/emails/logs",
  "/api/emails/mailbox?folder=inbox&limit=5",
  "/api/emails/mailbox?folder=sent&limit=5",
  "/api/export",
  "/api/profile",
];

const PAGES = [
  "/login",
  "/dashboard",
  "/companies",
  "/contacts",
  "/leads",
  "/projects",
  "/activities",
  "/emails",
  "/emails/compose",
  "/emails/sent",
  "/email-templates",
  "/import-export",
  "/vendors",
  "/users",
  "/admin/statuses",
];

async function main() {
  await login();
  let fails = 0;

  console.log("-- API GET sweep (fail on 5xx) --");
  for (const path of API_GETS) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    const bad = res.status >= 500;
    if (bad) fails++;
    const note = res.status >= 400 ? (await res.text()).slice(0, 120) : "";
    console.log(`${bad ? "FAIL" : "OK  "} ${res.status} ${path}${note ? ` :: ${note}` : ""}`);
  }

  console.log("\n-- detail endpoints --");
  const co = await (await fetch(`${BASE}/api/companies?limit=1`, { headers: { cookie } })).json();
  const firstId = co.data?.[0]?.id;
  if (firstId) {
    for (const path of [`/api/companies/${firstId}`, `/companies/${firstId}`]) {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
      const bad = res.status >= 500;
      if (bad) fails++;
      console.log(`${bad ? "FAIL" : "OK  "} ${res.status} ${path}`);
    }
  }
  const vend = await (await fetch(`${BASE}/api/vendors?limit=1`, { headers: { cookie } })).json();
  const firstVend = vend.data?.[0]?.id;
  if (firstVend) {
    for (const path of [`/api/vendors/${firstVend}`, `/vendors/${firstVend}`]) {
      const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
      const bad = res.status >= 500;
      if (bad) fails++;
      console.log(`${bad ? "FAIL" : "OK  "} ${res.status} ${path}`);
    }
  } else {
    console.log("SKIP vendor detail (no vendors in branch)");
  }

  console.log("\n-- pages --");
  for (const path of PAGES) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
    const bad = res.status >= 500;
    if (bad) fails++;
    console.log(`${bad ? "FAIL" : "OK  "} ${res.status} ${path}`);
  }

  console.log(`\nRESULT: ${fails === 0 ? "sweep clean - no 5xx anywhere" : fails + " endpoint(s) failing"}`);
  process.exit(fails > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
