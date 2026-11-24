import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mergeImportData, parseExcelFile } from "./import";

async function customerWorkbook(): Promise<Buffer> {
  const aoa: unknown[][] = [
    ["", "", "", ""],
    ["", "", "", ""],
    ["Date", "Customer", "Industry", "Email"],
    ["2026-01-05", "Alpha Corp", "Hotel", "a@alpha.com"],
    ["2026-01-06", "Beta Corp", "Hospital", "b@beta.com"],
    ["", "Alpha Corp", "Hotel", "second@alpha.com"],
  ];
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customer");
  aoa.forEach((values, rowIdx) => {
    const row = ws.getRow(rowIdx + 1);
    values.forEach((value, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = value as ExcelJS.CellValue;
    });
    row.commit();
  });
  const written = await wb.xlsx.writeBuffer();
  return Buffer.from(written);
}

describe("parseExcelFile (master list preview)", () => {
  it("populates rawData with the actual cell values", async () => {
    const preview = await parseExcelFile(await customerWorkbook(), "test.xlsx");
    const sheet = preview.sheets.find((s) => s.name === "Customer");
    expect(sheet).toBeTruthy();
    const alpha = sheet!.rows.find((r) => r.company === "Alpha Corp");
    expect(alpha?.rawData).toMatchObject({
      Date: "2026-01-05",
      Customer: "Alpha Corp",
      Industry: "Hotel",
      Email: "a@alpha.com",
    });
  });

  it("derives headers from the header row (never empty)", async () => {
    const preview = await parseExcelFile(await customerWorkbook(), "test.xlsx");
    const sheet = preview.sheets.find((s) => s.name === "Customer");
    expect(sheet!.headers).toEqual(expect.arrayContaining(["Date", "Customer", "Industry", "Email"]));
    expect(sheet!.headers.length).toBe(4);
  });

  it("counts duplicates and merges rows across the file", async () => {
    const preview = await parseExcelFile(await customerWorkbook(), "test.xlsx");
    const sheet = preview.sheets.find((s) => s.name === "Customer");
    expect(sheet!.duplicates).toEqual([6]); // second Alpha Corp on row 6
    expect(sheet!.totalRows).toBe(3);

    const merged = mergeImportData(preview);
    expect(merged).toHaveLength(2);
    const alpha = merged.find((m) => m.company === "Alpha Corp");
    expect(alpha?.email).toBe("a@alpha.com"); // first occurrence wins
  });
});
