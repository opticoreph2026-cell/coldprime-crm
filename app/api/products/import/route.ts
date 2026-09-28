// Bulk product (sell price list) import - Phase 2 FormData pattern:
// upload file -> preview -> import. Duplicate detection on (name, brand, model).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireBranchId } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parsePriceList, PriceRow } from "@/lib/price-list";

const ALLOWED_EXTENSIONS = [".csv", ".txt", ".xlsx", ".xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function rowKey(row: PriceRow): string {
  return [row.itemName, row.brand || "", row.model || ""].map((v) => v.toLowerCase().trim()).join("|");
}

function dbKey(name: string, brand: string | null, model: string | null): string {
  return [name, brand || "", model || ""].map((v) => v.toLowerCase().trim()).join("|");
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const action = formData.get("action") as string | null || "preview";

    if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .csv, .txt, .xlsx and .xls files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parsePriceList(buffer, file.name);
    if (parsed.rows.length === 0 && parsed.errors.length === 0) {
      return NextResponse.json({ error: "No rows found in file" }, { status: 400 });
    }

    if (action === "preview") {
      const seen = new Set<string>();
      const duplicateRows: number[] = [];
      parsed.rows.forEach((row, i) => {
        const key = rowKey(row);
        if (seen.has(key)) duplicateRows.push(i);
        seen.add(key);
      });
      return NextResponse.json({
        headers: parsed.headers,
        rows: parsed.rows,
        errors: parsed.errors,
        duplicateRows,
        total: parsed.rows.length,
      });
    }

    if (action === "import") {
      const existing = await prisma.product.findMany({
        where: { branchId },
        select: { name: true, brand: true, model: true },
      });
      const dbKeys = new Set(existing.map((p) => dbKey(p.name, p.brand, p.model)));

      let imported = 0;
      let skipped = 0;
      const errors = [...parsed.errors];
      const seen = new Set<string>();

      for (const row of parsed.rows) {
        const key = rowKey(row);
        if (seen.has(key) || dbKeys.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        try {
          await prisma.product.create({
            data: {
              branchId,
              name: row.itemName,
              category: row.category || null,
              brand: row.brand || null,
              model: row.model || null,
              unit: row.unit || null,
              sellPrice: row.price ?? null,
              currency: row.currency || "PHP",
              priceValidUntil: row.priceValidUntil ? new Date(row.priceValidUntil) : null,
              leadTimeDays: row.leadTimeDays ?? null,
              notes: row.notes || null,
            },
          });
          imported++;
        } catch (err) {
          errors.push({ row: 0, reason: `${row.itemName}: ${err instanceof Error ? err.message : "create failed"}` });
        }
      }

      await logAudit({
        branchId,
        action: "CREATE",
        entity: "product",
        details: { via: "price_list_import", imported, skipped, file: file.name },
      });

      return NextResponse.json({ imported, skipped, errors, total: parsed.rows.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error importing products:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
