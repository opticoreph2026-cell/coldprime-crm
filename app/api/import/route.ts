import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseExcelFile, mergeImportData, type ImportPreview } from "@/lib/excel/import";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length === 0) return { valid: false, error: "Empty file" };
  if (buffer.length > MAX_FILE_SIZE) return { valid: false, error: "File too large (max 10MB)" };
  return { valid: true };
}

function sanitizeString(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\s\-]/g, "").slice(0, 100);
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const action = formData.get("action") as string || "preview";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .xlsx and .xls files are allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const validation = validateFile(buffer);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (action === "preview") {
      const preview = parseExcelFile(buffer, file.name);
      return NextResponse.json(preview);
    }

    if (action === "import") {
      const preview = parseExcelFile(buffer, file.name);
      const merged = mergeImportData(preview);

      let imported = 0;
      let skipped = 0;
      const errors: { company: string; reason: string }[] = [];

      const seenCompaniesGlobal = new Set<string>();

      for (const row of merged) {
        try {
          if (!row.company) {
            skipped++;
            continue;
          }

          const normalized = row.company.toLowerCase().trim();
          if (seenCompaniesGlobal.has(normalized)) {
            skipped++;
            continue;
          }
          seenCompaniesGlobal.add(normalized);

          const existing = await prisma.company.findFirst({
            where: {
              OR: [
                { name: { equals: row.company, mode: Prisma.QueryMode.insensitive } },
                ...(row.email ? [{ email: { equals: row.email, mode: Prisma.QueryMode.insensitive } }] : []),
              ],
              branchId,
            },
          });

          if (existing) {
            skipped++;
            continue;
          }

          await prisma.company.create({
            data: {
              branchId,
              name: row.company,
              industry: row.industry || "Other",
              email: row.email || null,
              mobile1: row.mobile1 || null,
              landline1: row.landline1 || null,
              address: row.address || null,
              website: row.website || null,
              status: "Active",
              notes: row.remarks || null,
              source: `Import: ${sanitizeString(row.sheetName || "Unknown")}`,
            },
          });

          imported++;
        } catch (err) {
          errors.push({
            company: row.company || "Unknown",
            reason: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return NextResponse.json({
        imported,
        skipped,
        errors,
        total: merged.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error importing:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
