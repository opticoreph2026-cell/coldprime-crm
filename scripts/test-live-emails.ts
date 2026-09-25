export {};

import "dotenv/config";

const BASE = process.env.TEST_BASE || "https://coldprime-crm.vercel.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
if (!PASSWORD) throw new Error("ADMIN_PASSWORD not set in .env");

async function login(email: string): Promise<string> {
  const password = email.startsWith("admin@") ? PASSWORD! : process.env.STAFF_PASSWORD || PASSWORD!;
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const setCookie = csrfRes.headers.getSetCookie?.() ?? [];
  const { csrfToken } = await csrfRes.json();
  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const body = new URLSearchParams({ csrfToken, email, password, redirect: "false", json: "true" });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body,
    redirect: "manual",
  });
  const sc = (res.headers.getSetCookie?.() ?? []).find((c) => c.includes("session-token"));
  if (!sc) throw new Error(`login failed for ${email}`);
  return sc.split(";")[0];
}

async function probe(label: string, path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const body = await res.text();
  console.log(`${label} ${path} -> ${res.status} ${body.slice(0, 220)}`);
}

async function main() {
  const who = process.argv[2] || "admin@coldprime.ph";
  const cookie = await login(who);
  console.log(`logged in as ${who}`);
  await probe("logs    ", "/api/emails/logs", cookie);
  await probe("mailbox ", "/api/emails/mailbox?folder=inbox&limit=5", cookie);
  await probe("sent    ", "/api/emails/mailbox?folder=sent&limit=5", cookie);
  await probe("emails  ", "/api/emails?limit=5", cookie);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
