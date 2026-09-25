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
  if (!sc) throw new Error("login failed: no session cookie");
  cookie = sc.split(";")[0];
}

let pass = 0;
let fail = 0;

async function call(method: string, path: string, body?: unknown, expect?: number | number[]): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  const wants = expect === undefined ? [200] : Array.isArray(expect) ? expect : [expect];
  const ok = wants.includes(res.status);
  if (ok) pass++; else fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${method} ${path} -> ${res.status} (expected ${wants.join("|")})${ok ? "" : ` :: ${text.slice(0, 200)}`}`);
  return { status: res.status, json };
}

async function cleanup(apiPath: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/${apiPath}/${id}`, { method: "DELETE", headers: { cookie }, redirect: "manual" });
  console.log(`  cleanup ${apiPath} ${id} -> ${res.status}`);
}

async function main() {
  await login();
  console.log("login: OK\n-- validation rejects --");

  // zod 400s with field-level errors
  await call("POST", "/api/companies", {}, 400);
  await call("POST", "/api/companies", { name: "Test", type: "BOGUS_TYPE" }, 400);
  await call("POST", "/api/contacts", { companyId: "", firstName: "" }, 400);
  await call("POST", "/api/projects", { projectName: "No Company" }, 400);
  await call("POST", "/api/vendors", { name: "" }, 400);
  await call("POST", "/api/emails/send", { toEmail: "not-an-email", body: "hi" }, 400);

  console.log("-- create + FK delete flow --");
  const created = await call("POST", "/api/companies", { name: "__validation_probe__", type: "OTHER", industry: "Other", status: "Active" }, 201);
  const companyId = created.json.id as string;
  const c2 = await call("POST", "/api/contacts", { companyId, firstName: "Probe", lastName: "Delete" }, 201);
  const contactId = c2.json.id as string;

  // blank name on PUT must be a 400, not a 500
  await call("PUT", `/api/companies/${companyId}`, { name: "" }, 400);

  // company delete while contact exists: 409 (restrict) or 200 (cascade) — both acceptable
  const del = await call("DELETE", `/api/companies/${companyId}`, undefined, [200, 409]);
  if (del.status === 409) {
    console.log("  (FK restrict active: 409 as designed)");
    await cleanup("contacts", contactId);
    await cleanup("companies", companyId);
  } else {
    await cleanup("contacts", contactId);
  }

  console.log("-- include fix + guards --");
  const vendors = await call("GET", "/api/vendors?limit=3");
  const rows = (vendors.json.data as Record<string, unknown>[]) || [];
  const allIncluded = rows.every((v) => Array.isArray(v.contacts) && Array.isArray(v.materials));
  if (vendors.status === 200 && allIncluded) { pass++; console.log(`OK   vendors list include query valid (${rows.length} rows)`); }
  else { fail++; console.log("FAIL vendors list include query broken"); }

  console.log("-- vendor detail + sub-resources (FK column regression) --");
  const vend = await call("POST", "/api/vendors", { name: "__validation_probe_vendor__", category: "Probe", status: "Active" }, 201);
  const vid = vend.json.id as string;
  const vDetail = await call("GET", `/api/vendors/${vid}`);
  const vjson = vDetail.json;
  const okDetail = Array.isArray(vjson.contacts) && Array.isArray(vjson.materials);
  if (okDetail) { pass++; console.log("OK   vendor detail includes contacts+materials"); }
  else { fail++; console.log("FAIL vendor detail missing contacts/materials"); }
  const vContact = await call("POST", `/api/vendors/${vid}/contacts`, { firstName: "Probe", lastName: "Person" }, 201);
  const vMaterial = await call("POST", `/api/vendors/${vid}/materials`, { itemName: "Probe Item", unitPrice: "123.45" }, 201);
  const vDel = await call("DELETE", `/api/vendors/${vid}`, undefined, [200, 409]);
  if (vDel.status === 409) {
    await cleanup("vendors/contacts", vContact.json.id as string);
    await cleanup("vendors/materials", vMaterial.json.id as string);
    await cleanup("vendors", vid);
  }

  const users = await call("GET", "/api/users");
  const admin = ((users.json.data as Record<string, unknown>[]) || []).find((u) => u.role === "HEAD_ADMIN");
  if (admin) await call("PUT", `/api/users/${admin.id}`, { role: "STAFF" }, 400); // self-demote guard

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
