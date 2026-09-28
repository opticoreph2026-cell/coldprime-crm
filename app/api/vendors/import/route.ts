// Bulk vendor price-list (cost) import - Phase 2 FormData pattern:
// upload file -> preview -> import. Duplicate detection on (vendor, brand, model).
// COST PRICES: this endpoint writes unitPrice, so only roles allowed by
// canViewVendorCost() may use it (STAFF get 403).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { viewerCanSeeCost } from "@/lib/cost";
import { parsePriceList, PriceRow } from "@/lib/price-list";
import { parseOr400 } from "@/lib/validations";
import { vendorImportFieldsSchema, fdString } from "@/lib/validations/import";

const ALLOWED_EXTENSIONS = [".csv", ".txt", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Doc: duplicate detection on (vendor, brand, model). When both brand and model
// are blank the key would collide across unrelated items, so fall back to the
// item name in that case.
function rowKey(vendorIdOrName: string, row: PriceRow): string {
  const tail = row.brand || row.model
    ? `${row.brand || ""}|${row.model || ""}`
    : `item:${row.itemName.toLowerCase().trim()}`;
  return `${vendorIdOrName.toLowerCase().trim()}|${tail}`;
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    // Cost import is a restricted endpoint (company policy, lib/cost.ts).
    if (!(await viewerCanSeeCost())) {
      return NextResponse.json({ error: "Cost price imports are restricted" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    const fieldParsed = parseOr400(vendorImportFieldsSchema, {
      action: fdString(formData, "action") || "preview",
      vendorId: fdString(formData, "vendorId") || "",
    });
    if (!fieldParsed.ok) return fieldParsed.response;
    const action = fieldParsed.data.action;
    const vendorId = fieldParsed.data.vendorId || "";

    if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .csv, .txt, .xlsx and .xls files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const vendors = await prisma.vendor.findMany({
      where: { branchId },
      select: { id: true, name: true },
    });
    const byName = new Map(vendors.map((v) => [v.name.toLowerCase().trim(), v.id]));
    const vendorIds = new Set(vendors.map((v) => v.id));
    // Cross-branch guard: an explicit vendorId must belong to the caller's branch.
    if (vendorId && !vendorIds.has(vendorId)) {
      return NextResponse.json({ error: "Vendor not found in your branch" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parsePriceList(buffer, file.name);
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      return NextResponse.json({ error: "No rows found in file" }, { status: 400 });
    }

    // Resolve each row's vendor (explicit vendorId field wins, else vendor column)
    const resolution: { vendorId?: string; reason?: string }[] = parsed.rows.map((row) => {
      if (vendorId) return { vendorId };
      const name = row.vendor?.toLowerCase().trim();
      if (!name) return { reason: "Missing vendor (no vendorId and no Vendor column)" };
      const id = byName.get(name);
      if (!id) return { reason: `Unknown vendor "${row.vendor}"` };
      return { vendorId: id };
    });

    if (action === "preview") {
      const seen = new Set<string>();
      const duplicateRows: number[] = [];
      parsed.rows.forEach((row, i) => {
        const res = resolution[i];
        if (res.vendorId) {
          const key = rowKey(res.vendorId, row);
          if (seen.has(key)) duplicateRows.push(i);
          seen.add(key);
        }
      });
      return NextResponse.json({
        headers: parsed.headers,
        rows: parsed.rows,
        resolution,
        errors: parsed.errors,
        duplicateRows,
        total: parsed.rows.length,
      });
    }

    if (action === "import") {
      const existing = await prisma.vendorMaterial.findMany({
        where: { vendor: { branchId } },
        select: { vendorId: true, brand: true, model: true, itemName: true },
      });
      const dbKeys = new Set(
        existing.map((m) =>
          rowKey(m.vendorId, { itemName: m.itemName, brand: m.brand || undefined, model: m.model || undefined })
        )
      );

      let imported = 0;
      let skipped = 0;
      const errors = [...parsed.errors];
      const seen = new Set<string>();

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const res = resolution[i];
        if (!res.vendorId) {
          errors.push({ row: i + 1, reason: res.reason || "Unresolved vendor" });
          continue;
        }
        const key = rowKey(res.vendorId, row);
        if (seen.has(key) || dbKeys.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        try {
          await prisma.vendorMaterial.create({
            data: {
              vendorId: res.vendorId,
              itemName: row.itemName,
              category: row.category || null,
              brand: row.brand || null,
              model: row.model || null,
              unit: row.unit || null,
              unitPrice: row.price ?? null,
              currency: row.currency || "PHP",
              priceValidUntil: row.priceValidUntil ? new Date(row.priceValidUntil) : null,
              leadTimeDays: row.leadTimeDays ?? null,
              notes: row.notes || null,
            },
          });
          imported++;
        } catch (err) {
          errors.push({ row: i + 1, reason: `${row.itemName}: ${err instanceof Error ? err.message : "create failed"}` });
        }
      }

      await logAudit({
        branchId,
        action: "CREATE",
        entity: "vendor_material",
        details: { via: "price_list_import", imported, skipped, file: file.name, vendorId: vendorId || "(from file)" },
      });

      return NextResponse.json({ imported, skipped, errors, total: parsed.rows.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error importing price list:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
