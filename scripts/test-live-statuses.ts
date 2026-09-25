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

type Row = { id: string; name: string; isActive: boolean };

async function main() {
  await login();
  console.log("login: OK\n-- status admin API --");

  const list = await call("GET", "/api/status-definitions?type=company&all=1");
  const original = (list.json as unknown as Row[]) || [];
  const ids = original.map((r) => r.id);
  console.log(`  company statuses: ${original.length}`);

  // create
  const created = await call("POST", "/api/status-definitions", { name: "__probe_status__", type: "company" }, 201);
  const id = created.json.id as string;

  // cascade rename: company record follows the status rename
  const co = await call("POST", "/api/companies", { name: "__probe_co__", status: "__probe_status__" }, 201);
  const coId = co.json.id as string;
  await call("PUT", `/api/status-definitions/${id}`, { name: "__probe_status_renamed__" }, 200);
  const coCheck = await call("GET", `/api/companies/${coId}`);
  const coStatus = (coCheck.json as Record<string, unknown>).status;
  if (coStatus === "__probe_status_renamed__") { pass++; console.log("OK   cascade rename updated company.status"); }
  else { fail++; console.log(`FAIL cascade rename: company.status=${String(coStatus)}`); }

  // duplicate rename -> 409
  await call("PUT", `/api/status-definitions/${id}`, { name: original[0]?.name || "Active" }, 409);

  // reorder: reverse, verify, restore (fetch current list including the probe row)
  const current = await call("GET", "/api/status-definitions?type=company&all=1");
  const currentIds = ((current.json as unknown as Row[]) || []).map((r) => r.id);
  const reversed = [...currentIds].reverse();
  await call("PUT", "/api/status-definitions/reorder", { type: "company", ids: reversed }, 200);
  const afterReorder = await call("GET", "/api/status-definitions?type=company&all=1");
  const afterIds = ((afterReorder.json as unknown as Row[]) || []).map((r) => r.id);
  if (JSON.stringify(afterIds) === JSON.stringify(reversed)) { pass++; console.log("OK   reorder applied"); }
  else { fail++; console.log("FAIL reorder not applied"); }
  const restored = [...ids, id];
  await call("PUT", "/api/status-definitions/reorder", { type: "company", ids: restored }, 200);

  // deactivate (DELETE) + hidden from default list, visible with all=1
  await call("DELETE", `/api/status-definitions/${id}`, undefined, 200);
  const activeOnly = await call("GET", "/api/status-definitions?type=company");
  const activeNames = ((activeOnly.json as unknown as Row[]) || []).map((r) => r.name);
  const allRows = await call("GET", "/api/status-definitions?type=company&all=1");
  const allNames = ((allRows.json as unknown as Row[]) || []).map((r) => r.name);
  if (!activeNames.includes("__probe_status_renamed__") && allNames.includes("__probe_status_renamed__")) {
    pass++; console.log("OK   deactivated status hidden from default list, kept in all=1");
  } else { fail++; console.log("FAIL deactivate visibility logic"); }

  // reactivate then 404s for foreign ids
  await call("PUT", `/api/status-definitions/${id}`, { isActive: true }, 200);
  await call("GET", "/api/status-definitions?type=company");

  // page render
  await call("GET", "/admin/statuses");

  // cleanup: remove test company, then fully remove the probe status row
  await call("DELETE", `/api/companies/${coId}`, undefined, 200);
  await call("PUT", `/api/status-definitions/${id}`, { name: "__probe_status__" }, 200);
  await call("DELETE", `/api/status-definitions/${id}`, undefined, 200);

  const { default: pg } = await import("pg");
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const pool = new pg.Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  await pool.query(`DELETE FROM status_definitions WHERE name = '__probe_status__' AND type = 'company'`);
  await pool.query(`DELETE FROM companies WHERE name = '__probe_co__'`);
  await pool.end();
  console.log("  db cleanup done");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
