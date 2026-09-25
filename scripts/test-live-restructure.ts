export {};

import "dotenv/config";

const BASE = process.env.TEST_BASE || "https://coldprime-crm.vercel.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!PASSWORD) throw new Error("ADMIN_PASSWORD not set in .env");

async function login(): Promise<string> {
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
  if (!sc) throw new Error("login failed: no session cookie");
  return sc.split(";")[0];
}

async function get(path: string, cookie: string, expect: number): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const body = await res.text();
  const ok = res.status === expect;
  console.log(`${ok ? "OK  " : "FAIL"} GET ${path} -> ${res.status} (expected ${expect})`);
  if (!ok) console.log(`     ${body.slice(0, 200)}`);
  return body;
}

async function main() {
  const cookie = await login();
  console.log("login: OK");

  const statuses = JSON.parse(await get("/api/status-definitions?type=lead", cookie, 200));
  const leadCount = Array.isArray(statuses) ? statuses.filter((s: { type: string }) => s.type === "lead").length : 0;
  console.log(`  lead status definitions: ${leadCount}`);

  await get("/api/companies?type=GENERAL_CONTRACTOR&limit=5", cookie, 200);
  await get("/api/leads?type=ACCREDITATION&limit=5", cookie, 200);
  await get("/api/documents?limit=5", cookie, 200);
  await get("/api/emails/templates", cookie, 200);
  await get("/email-templates", cookie, 200);
  await get("/companies", cookie, 200);
  await get("/leads", cookie, 200);

  console.log("SMOKE DONE");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
