import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseCsv, parsePriceList, splitCsvLine } from "./price-list";

describe("splitCsvLine", () => {
  it("handles quoted fields and embedded commas", () => {
    expect(splitCsvLine('Item A, "Brand, Inc", 100')).toEqual(["Item A", "Brand, Inc", "100"]);
    expect(splitCsvLine('"He said ""hi""", x')).toEqual(['He said "hi"', "x"]);
  });
});

describe("parseCsv", () => {
  it("maps header aliases to fields", () => {
    const csv = [
      "Product,Brand,Model No,Unit Price,Lead Time Weeks,Valid Until",
      'AHU-1,Daikin,PA100,"12,500.00",2,2026-12-31',
    ].join("\n");
    const { rows, errors } = parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].itemName).toBe("AHU-1");
    expect(rows[0].brand).toBe("Daikin");
    expect(rows[0].model).toBe("PA100");
    expect(rows[0].price).toBe(12500);
    expect(rows[0].leadTimeDays).toBe(14); // 2 weeks -> 14 days
    expect(rows[0].priceValidUntil).toBe("2026-12-31");
  });

  it("flags rows without an item name", () => {
    const { rows, errors } = parseCsv("Item,Brand\n,Daikin");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toMatch(/item name/i);
  });

  it("strips currency symbols from prices", () => {
    const { rows } = parseCsv('Name,Price\nFilter,"PHP 1,200.50"');
    expect(rows[0].price).toBe(1200.5);
  });

  it("ignores a UTF-8 BOM", () => {
    const { headers, rows } = parseCsv("\uFEFFName,Price\nItem,10");
    expect(headers[0]).toBe("Name");
    expect(rows[0].itemName).toBe("Item");
  });
});

describe("parsePriceList", () => {
  it("parses xlsx via header row", async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Price List");
    sheet.addRow(["Item Name", "Brand", "Model", "Unit Price", "Lead Time (days)", "Expiry"]);
    sheet.addRow(["Sensor", "Kaiterra", "IAQ-1", 2500, 7, new Date(2026, 5, 30)]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const { rows, errors } = await parsePriceList(buffer, "list.xlsx");
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].itemName).toBe("Sensor");
    expect(rows[0].price).toBe(2500);
    expect(rows[0].leadTimeDays).toBe(7);
    expect(rows[0].priceValidUntil).toBe("2026-06-30");
  });

  it("routes csv files to the csv parser", async () => {
    const buffer = Buffer.from("Name,Brand\nItem,B\n");
    const { rows } = await parsePriceList(buffer, "list.csv");
    expect(rows[0].itemName).toBe("Item");
  });
});
