/* Live probe for Phase 2 (Products + vendor cost access control).
   - admin: product CRUD, price-list import preview/dup detection,
     vendor + material with cost
   - staff: unitPrice stripped from responses, cost writes/import -> 403
   Usage: npx tsx scripts/test-live-products.ts [baseUrl] */
import "dotenv/config";
import fs from "node:fs";

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

const STAMP = Date.now();
const PROBE_PRODUCT = `PROBE AHU ${STAMP}`;

async function main() {
  const admin = await loginWithFallback(process.env.AUTH_ADMIN_EMAIL || "");
  console.log("admin login ok");

  // --- Product CRUD -------------------------------------------------------
  const created = await j(admin, "/api/products", {
    method: "POST",
    body: JSON.stringify({
      name: PROBE_PRODUCT,
      category: "HVAC Equipment",
      brand: "Daikin",
      model: `PA-${STAMP}`,
      unit: "set",
      sellPrice: 1000,
      currency: "PHP",
      priceValidUntil: "2026-12-31",
      leadTimeDays: 7,
      notes: "probe",
    }),
  });
  ok(created.status === 201, "POST /api/products 201", `status ${created.status}`);
  const productId = created.body?.id;
  ok(created.body?.leadTimeDays === 7, "leadTimeDays stored", `got ${created.body?.leadTimeDays}`);

  const list = await j(admin, `/api/products?search=${encodeURIComponent(PROBE_PRODUCT)}`);
  ok(list.status === 200 && (list.body?.data || []).some((p: { id: string }) => p.id === productId),
    "GET /api/products?search finds it", `status ${list.status}`);

  const put = await j(admin, `/api/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ leadTimeDays: 10, sellPrice: 1500 }),
  });
  ok(put.status === 200 && put.body?.leadTimeDays === 10 && String(put.body?.sellPrice) === "1500",
    "PUT updates lead time + sell price", `lead=${put.body?.leadTimeDays} price=${put.body?.sellPrice}`);

  // --- Vendor + material with cost (admin) --------------------------------
  const vendor = await j(admin, "/api/vendors", {
    method: "POST",
    body: JSON.stringify({ name: `Probe Vendor ${STAMP}`, category: "Equipment Supplier" }),
  });
  ok(vendor.status === 201, "POST /api/vendors 201", `status ${vendor.status}`);
  const vendorId = vendor.body?.id;

  const mat = await j(admin, `/api/vendors/${vendorId}/materials`, {
    method: "POST",
    body: JSON.stringify({
      itemName: `Probe Coil ${STAMP}`,
      brand: "Daikin",
      model: `C-${STAMP}`,
      unitPrice: 500,
      leadTimeDays: 3,
      priceValidUntil: "2026-11-30",
    }),
  });
  ok(mat.status === 201 && mat.body?.unitPrice !== undefined, "admin can create material with cost", `status ${mat.status}`);
  ok(mat.body?.leadTimeDays === 3, "material leadTimeDays stored", `got ${mat.body?.leadTimeDays}`);
  const materialId = mat.body?.id;

  const adminDetail = await j(admin, `/api/vendors/${vendorId}`);
  const adminMat = (adminDetail.body?.materials || []).find((m: { id: string }) => m.id === materialId);
  ok(admin && adminMat && adminMat.unitPrice !== undefined, "admin sees unitPrice on vendor detail");

  // --- Price-list import preview + duplicate detection --------------------
  const csv = [
    "Name,Brand,Model,Unit Price,Lead Time,Valid Until",
    `PROBE FILTER ${STAMP},3M,F-${STAMP},100,5,2026-12-31`,
    `PROBE FILTER ${STAMP},3M,F-${STAMP},100,5,2026-12-31`, // in-file dup
    `,NoBrand,NoModel,50,,,`, // invalid: missing name
  ].join("\n");

  const fdPreview = new FormData();
  fdPreview.set("file", new File([csv], "prices.csv", { type: "text/csv" }));
  fdPreview.set("action", "preview");
  const previewRes = await fetch(`${BASE}/api/products/import`, { method: "POST", headers: { cookie: admin }, body: fdPreview });
  const preview = await previewRes.json();
  ok(previewRes.status === 200 && preview.total === 2, "import preview 2 valid rows", `total ${preview.total}`);
  ok((preview.duplicateRows || []).length === 1, "in-file duplicate detected", `dups ${JSON.stringify(preview.duplicateRows)}`);
  ok((preview.errors || []).length === 1, "invalid row flagged", `errors ${preview.errors?.length}`);

  const fdImport = new FormData();
  fdImport.set("file", new File([csv], "prices.csv", { type: "text/csv" }));
  fdImport.set("action", "import");
  const importRes = await fetch(`${BASE}/api/products/import`, { method: "POST", headers: { cookie: admin }, body: fdImport });
  const imported = await importRes.json();
  ok(importRes.status === 200 && imported.imported === 1 && imported.skipped >= 1,
    "import created 1, skipped dup", `imported ${imported.imported} skipped ${imported.skipped}`);

  const reimportRes = await fetch(`${BASE}/api/products/import`, { method: "POST", headers: { cookie: admin }, body: fdImport });
  const reimported = await reimportRes.json();
  ok(reimportRes.status === 200 && reimported.imported === 0, "re-import skips existing (DB dup)", `imported ${reimported.imported}`);

  // --- STAFF access control ----------------------------------------------
  let staff: string | null = null;
  try {
    staff = await loginWithFallback("cebu-staff@coldprime.ph");
    console.log("staff login ok");
  } catch {
    ok(false, "staff login (cebu-staff@coldprime.ph)");
  }

  if (staff) {
    const staffDetail = await j(staff, `/api/vendors/${vendorId}`);
    const staffMat = (staffDetail.body?.materials || []).find((m: { id: string }) => m.id === materialId);
    ok(staffDetail.status === 200 && staffMat && !(staffMat as Record<string, unknown>).hasOwnProperty("unitPrice"),
      "STAFF response strips unitPrice (vendor detail)");

    const staffList = await j(staff, "/api/vendors?limit=50");
    const listHasCost = (staffList.body?.data || []).some((v: { materials?: { unitPrice?: unknown }[] }) =>
      (v.materials || []).some((m) => m.unitPrice !== undefined)
    );
    ok(staffList.status === 200 && !listHasCost, "STAFF vendor list has no unitPrice");

    const staffMatPost = await j(staff, `/api/vendors/${vendorId}/materials`, {
      method: "POST",
      body: JSON.stringify({ itemName: `Staff Cost Try ${STAMP}`, unitPrice: 999 }),
    });
    ok(staffMatPost.status === 403, "STAFF write with unitPrice -> 403", `status ${staffMatPost.status}`);

    const fdStaffImport = new FormData();
    fdStaffImport.set("file", new File([`Name,Unit Price\nX,100\n`], "s.csv", { type: "text/csv" }));
    fdStaffImport.set("action", "preview");
    const staffImport = await fetch(`${BASE}/api/vendors/import`, { method: "POST", headers: { cookie: staff }, body: fdStaffImport });
    ok(staffImport.status === 403, "STAFF cost import -> 403", `status ${staffImport.status}`);

    const staffProducts = await j(staff, "/api/products?limit=10");
    ok(staffProducts.status === 200, "STAFF can browse products", `status ${staffProducts.status}`);

    const staffProdCreate = await j(staff, "/api/products", {
      method: "POST",
      body: JSON.stringify({ name: `Staff Product ${STAMP}` }),
    });
    ok(staffProdCreate.status === 401 || staffProdCreate.status === 400 || staffProdCreate.status === 201,
      "STAFF product create (branch-gated)", `status ${staffProdCreate.status}`);
    if (staffProdCreate.status === 201) {
      await j(staff, `/api/products/${staffProdCreate.body.id}`, { method: "DELETE" });
    }
  }

  // --- Cleanup -------------------------------------------------------------
  const delProd = await j(admin, `/api/products/${productId}`, { method: "DELETE" });
  ok(delProd.status === 200, "DELETE product", `status ${delProd.status}`);
  const delImported = await j(admin, `/api/products?search=${encodeURIComponent(`PROBE FILTER ${STAMP}`)}`);
  for (const p of delImported.body?.data || []) {
    await j(admin, `/api/products/${p.id}`, { method: "DELETE" });
  }
  const delVendor = await j(admin, `/api/vendors/${vendorId}`, { method: "DELETE" });
  ok(delVendor.status === 200, "DELETE probe vendor (cascades materials)", `status ${delVendor.status}`);

  const pageRes = await fetch(`${BASE}/products`, { headers: { cookie: admin }, redirect: "manual" });
  ok(pageRes.status === 200, "/products page 200", `status ${pageRes.status}`);

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("PROBE ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
