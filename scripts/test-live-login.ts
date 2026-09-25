const BASE = process.env.TEST_BASE || "https://coldprime-crm.vercel.app";

async function main() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  const setCookie = csrfRes.headers.getSetCookie?.() ?? [];
  const csrfJson = await csrfRes.json();
  console.log("csrf status:", csrfRes.status, "token:", csrfJson.csrfToken ? "yes" : "no");

  const cookieHeader = setCookie.map((c) => c.split(";")[0]).join("; ");
  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: "admin@coldprime.ph",
    password: "Coldprime2026!",
    redirect: "false",
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader },
    body,
    redirect: "manual",
  });
  console.log("login status:", loginRes.status);
  const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = loginCookies.find((c) => c.startsWith("authjs.session-token=") || c.startsWith("__Secure-authjs.session-token="));
  console.log("session cookie issued:", sessionCookie ? "YES" : "NO");

  if (sessionCookie) {
    const sRes = await fetch(`${BASE}/api/auth/session`, {
      headers: { cookie: sessionCookie.split(";")[0] },
    });
    const sess = await sRes.json();
    console.log("session:", JSON.stringify({ user: sess.user?.email, role: sess.user?.role ?? sess.user?.branchId }));
  }

  if (!sessionCookie) {
    const text = await loginRes.text().catch(() => "");
    console.log("login body:", text.slice(0, 300));
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
