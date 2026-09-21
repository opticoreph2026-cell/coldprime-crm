import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma/client/client";
import { parseExcelFile, mergeImportData, type ImportPreview } from "@/lib/excel/import";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import * as path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "C:\\Users\\juliu\\AppData\\Local\\Temp\\opencode";

function validateFilePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const uploadDir = path.resolve(UPLOAD_DIR);
  if (!resolved.startsWith(uploadDir + path.sep) && resolved !== uploadDir) {
    throw new Error("Invalid file path");
  }
  return resolved;
}

function sanitizeString(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\s\-]/g, "").slice(0, 100);
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchId = await requireBranchId();

    const body = await request.json();
    const { filePath, action } = body;

    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 });
    }

    let safePath: string;
    try {
      safePath = validateFilePath(filePath);
    } catch {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    if (action === "preview") {
      const preview = parseExcelFile(safePath);
      return NextResponse.json(preview);
    }

    if (action === "import") {
      const preview = parseExcelFile(safePath);
      const merged = mergeImportData(preview);

      let imported = 0;
      let skipped = 0;
      const errors: { company: string; reason: string }[] = [];

      for (const row of merged) {
        try {
          if (!row.company) {
            skipped++;
            continue;
          }

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

      const batch = await prisma.importBatch.create({
        data: {
          branchId,
          filename: sanitizeString(filePath.split(/[/\\]/).pop() || filePath),
          totalRows: merged.length,
          importedRows: imported,
          skippedRows: skipped,
          errorRows: errors.length,
          status: "completed",
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
        },
      });

      return NextResponse.json({
        batchId: batch.id,
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
