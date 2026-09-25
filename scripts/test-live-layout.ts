export {};

import "dotenv/config";

const BASE = "https://coldprime-crm.vercel.app";
const PASSWORD = process.env.ADMIN_PASSWORD || "";

async function login() {
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
  return sc.split(";")[0];
}

async function main() {
  const cookie = await login();
  let fails = 0;
  const checks: [string, string, boolean][] = [];

  const pages: [string, string[]][] = [
    ["/companies", ['class="page"', "page-scroll"]],
    ["/leads", ['class="page"', "page-scroll"]],
    ["/dashboard", ['class="page"']],
    ["/admin/statuses", ['class="page"']],
    ["/vendors", ['class="page"', "page-scroll"]],
    ["/emails", ['class="page"']],
  ];
  for (const [path, needles] of pages) {
    const html = await (await fetch(`${BASE}${path}`, { headers: { cookie } })).text();
    for (const n of needles) {
      const ok = html.includes(n);
      if (!ok) fails++;
      checks.push([path, n, ok]);
    }
  }

  // admin page must now include the sidebar nav (previously had none)
  const adminHtml = await (await fetch(`${BASE}/admin/statuses`, { headers: { cookie } })).text();
  const hasSidebar = adminHtml.includes("/dashboard") && adminHtml.includes("COLDPRIME");
  if (!hasSidebar) fails++;
  checks.push(["/admin/statuses", "sidebar-nav", hasSidebar]);

  for (const [path, needle, ok] of checks) {
    if (!ok) console.log(`FAIL ${path} :: missing "${needle}"`);
  }
  console.log(`RESULT: ${fails === 0 ? `all ${checks.length} markup checks passed` : fails + " check(s) failed"}`);
  process.exit(fails > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
