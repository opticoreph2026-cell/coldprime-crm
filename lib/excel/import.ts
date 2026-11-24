import ExcelJS from "exceljs";
import { cellValue, columnIndex } from "./cell";

export interface ImportRow {
  rowIndex: number;
  sheetName: string;
  company?: string;
  industry?: string;
  email?: string;
  mobile1?: string;
  landline1?: string;
  address?: string;
  website?: string;
  contactPerson?: string;
  position?: string;
  status?: string;
  remarks?: string;
  date?: Date | null;
  secondDate?: Date | null;
  rawData: Record<string, unknown>;
}

export interface ImportPreview {
  filename: string;
  sheets: SheetPreview[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
}

export interface SheetPreview {
  name: string;
  headers: string[];
  totalRows: number;
  rows: ImportRow[];
  duplicates: number[];
  errors: { row: number; reason: string }[];
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function normalizePhone(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (str === "-" || str === "" || str.toLowerCase() === "n/a") return "";
  return str;
}

function normalizeStatus(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (str === "-" || str === "" || str.toLowerCase() === "n/a") return "";
  return str;
}

/** 0-based row reader; `get("B")` returns the normalized cell in that column. */
function cellGetter(worksheet: ExcelJS.Worksheet, rowIdx: number) {
  const excelRow = worksheet.getRow(rowIdx + 1);
  return (col: string) => cellValue(excelRow.getCell(columnIndex(col)).value);
}

// Read a data row's actual cell values, keyed by the sheet's header row
// (falls back to the column letter when a header cell is empty). This is what
// populates ImportRow.rawData so the preview can show real headers.
function readRawRow(
  worksheet: ExcelJS.Worksheet,
  rowIdx: number,
  headerRowIdx: number
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  const excelRow = worksheet.getRow(rowIdx + 1);
  const headerRow = worksheet.getRow(headerRowIdx + 1);
  const lastCol = Math.max(worksheet.columnCount, 1);

  for (let c = 1; c <= lastCol; c++) {
    const value = cellValue(excelRow.getCell(c).value);
    if (value === undefined || value === "") continue;
    const colLetter = excelRow.getCell(c).address.replace(/\d+/g, "");
    const headerText = cellValue(headerRow.getCell(c).value);
    let key = String(headerText ?? "").trim() || colLetter;
    if (key in raw) key = `${key} (${colLetter})`;
    raw[key] = value;
  }
  return raw;
}

// Map the Customer sheet (master company list)
function mapCustomerSheet(
  worksheet: ExcelJS.Worksheet,
  sheetName: string
): ImportRow[] {
  const rows: ImportRow[] = [];

  // Customer sheet: Row 3 has headers
  const headerRow = 2; // A=Date, B=Customer, C=Industry, D=Email, E=Contact Number,
  // F=Address, G=Website, H=Contact Person, I=Position, J=Number,
  // K=Status, L=Date, M=Remarks
  for (let r = 3; r < worksheet.rowCount; r++) {
    const get = cellGetter(worksheet, r);

    const company = get("B");
    if (!company || String(company).trim() === "") continue;

    rows.push({
      rowIndex: r + 1,
      sheetName,
      company: String(company).trim(),
      industry: String(get("C") || "").trim() || undefined,
      email: String(get("D") || "").trim() || undefined,
      mobile1: normalizePhone(get("E")),
      landline1: normalizePhone(get("J")),
      address: String(get("F") || "").trim() || undefined,
      website: String(get("G") || "").trim() || undefined,
      contactPerson: String(get("H") || "").trim() || undefined,
      position: String(get("I") || "").trim() || undefined,
      status: normalizeStatus(get("K")),
      remarks: String(get("M") || "").trim() || undefined,
      date: parseDate(get("A")),
      secondDate: parseDate(get("L")),
      rawData: readRawRow(worksheet, r, headerRow),
    });
  }
  return rows;
}

// Map the Xedes sheet (has accomplishment data mixed in)
function mapXedesSheet(
  worksheet: ExcelJS.Worksheet,
  sheetName: string
): ImportRow[] {
  const rows: ImportRow[] = [];

  // Xedes: Row 1 has headers
  const headerRow = 0;
  // A=Date, B=Customer, C=Industry, D=Email, E=Contact No.,
  // F=Address, G=Contact Person, H=Position, I=Remarks
  for (let r = 1; r < worksheet.rowCount; r++) {
    const get = cellGetter(worksheet, r);

    const company = get("B");
    if (!company || String(company).trim() === "") continue;

    rows.push({
      rowIndex: r + 1,
      sheetName,
      company: String(company).trim(),
      industry: String(get("C") || "").trim() || undefined,
      email: String(get("D") || "").trim() || undefined,
      mobile1: normalizePhone(get("E")),
      address: String(get("F") || "").trim() || undefined,
      contactPerson: String(get("G") || "").trim() || undefined,
      position: String(get("H") || "").trim() || undefined,
      status: normalizeStatus(get("I")),
      remarks: undefined,
      date: parseDate(get("A")),
      secondDate: undefined,
      rawData: readRawRow(worksheet, r, headerRow),
    });
  }
  return rows;
}

// Map the Raiza sheet
function mapRaizaSheet(
  worksheet: ExcelJS.Worksheet,
  sheetName: string
): ImportRow[] {
  const rows: ImportRow[] = [];

  // Raiza: Row 1 has headers
  const headerRow = 0;
  // A=Company, B=Email, C=Number, D=Status, E=Remarks, F=Date
  for (let r = 1; r < worksheet.rowCount; r++) {
    const get = cellGetter(worksheet, r);

    const company = get("A");
    if (!company || String(company).trim() === "") continue;

    rows.push({
      rowIndex: r + 1,
      sheetName,
      company: String(company).trim(),
      email: String(get("B") || "").trim() || undefined,
      mobile1: normalizePhone(get("C")),
      status: normalizeStatus(get("D")),
      remarks: String(get("E") || "").trim() || undefined,
      date: parseDate(get("F")),
      secondDate: undefined,
      rawData: readRawRow(worksheet, r, headerRow),
    });
  }
  return rows;
}

// Map the Ellaine & Nhecel sheet
function mapEllaineSheet(
  worksheet: ExcelJS.Worksheet,
  sheetName: string
): ImportRow[] {
  const rows: ImportRow[] = [];

  // Ellaine & Nhecel: Row 2 has headers (Row 1 is "CONTACT INFO" header)
  const headerRow = 1;
  // A=Date, B=Company Name/Brands, C=Business Type, D=Email,
  // E=Contact Number, F=Address, G=Website, H=Status, I=Remarks
  for (let r = 2; r < worksheet.rowCount; r++) {
    const get = cellGetter(worksheet, r);

    const company = get("B");
    if (!company || String(company).trim() === "") continue;

    rows.push({
      rowIndex: r + 1,
      sheetName,
      company: String(company).trim(),
      industry: String(get("C") || "").trim() || undefined,
      email: String(get("D") || "").trim() || undefined,
      mobile1: normalizePhone(get("E")),
      address: String(get("F") || "").trim() || undefined,
      website: String(get("G") || "").trim() || undefined,
      status: normalizeStatus(get("H")),
      remarks: String(get("I") || "").trim() || undefined,
      date: parseDate(get("A")),
      secondDate: undefined,
      rawData: readRawRow(worksheet, r, headerRow),
    });
  }
  return rows;
}

// Map Sheet6 (simple hotel list)
function mapSheet6(
  worksheet: ExcelJS.Worksheet,
  sheetName: string
): ImportRow[] {
  const rows: ImportRow[] = [];

  // Sheet6: A=Business, B=Industry, C=Contact Number
  const headerRow = 0;
  for (let r = 1; r < worksheet.rowCount; r++) {
    const get = cellGetter(worksheet, r);

    const company = get("A");
    if (!company || String(company).trim() === "") continue;

    rows.push({
      rowIndex: r + 1,
      sheetName,
      company: String(company).trim(),
      industry: String(get("B") || "").trim() || undefined,
      mobile1: normalizePhone(get("C")),
      rawData: readRawRow(worksheet, r, headerRow),
    });
  }
  return rows;
}

export async function parseExcelFile(buffer: Buffer, filename: string): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheetHandlers: Record<string, (sheet: ExcelJS.Worksheet, name: string) => ImportRow[]> = {
    "Customer": mapCustomerSheet,
    "Xedes": mapXedesSheet,
    "Raiza": mapRaizaSheet,
    "Ellaine & Nhecel": mapEllaineSheet,
    "Sheet6": mapSheet6,
  };

  const sheets: SheetPreview[] = [];
  const globalSeenCompanies = new Set<string>();
  const globalDuplicates: { sheetName: string; row: number }[] = [];
  let totalRows = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetName = worksheet.name;
    if (sheetName === "Accomplishment Report Rose") continue;

    const handler = sheetHandlers[sheetName] || mapCustomerSheet;
    const rows = handler(worksheet, sheetName);

    const sheetSeenCompanies = new Set<string>();
    const duplicates: number[] = [];
    const errors: { row: number; reason: string }[] = [];

    const headerSet = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.rawData)) headerSet.add(key);

      const normalized = row.company?.toLowerCase().trim();
      if (normalized && globalSeenCompanies.has(normalized)) {
        duplicates.push(row.rowIndex);
        globalDuplicates.push({ sheetName, row: row.rowIndex });
      } else if (normalized) {
        sheetSeenCompanies.add(normalized);
        globalSeenCompanies.add(normalized);
      }

      if (!row.company) {
        errors.push({ row: row.rowIndex, reason: "Missing company name" });
      }
    }

    sheets.push({
      name: sheetName,
      headers: Array.from(headerSet),
      totalRows: rows.length,
      rows,
      duplicates,
      errors,
    });

    totalRows += rows.length;
  }

  const duplicateCount = globalDuplicates.length;
  const errorCount = sheets.reduce((sum, s) => sum + s.errors.length, 0);

  return {
    filename,
    sheets,
    totalRows,
    validRows: totalRows - duplicateCount - errorCount,
    duplicateRows: duplicateCount,
    errorRows: errorCount,
  };
}

// Merge all sheets into unique companies
export function mergeImportData(preview: ImportPreview): ImportRow[] {
  const companyMap = new Map<string, ImportRow>();

  for (const sheet of preview.sheets) {
    for (const row of sheet.rows) {
      if (sheet.duplicates.includes(row.rowIndex)) continue;
      if (sheet.errors.some((e) => e.row === row.rowIndex)) continue;

      const key = row.company?.toLowerCase().trim() || "";
      if (!key) continue;

      if (!companyMap.has(key)) {
        companyMap.set(key, row);
      } else {
        const existing = companyMap.get(key)!;
        if (!existing.contactPerson && row.contactPerson) existing.contactPerson = row.contactPerson;
        if (!existing.position && row.position) existing.position = row.position;
        if (!existing.email && row.email) existing.email = row.email;
        if (!existing.mobile1 && row.mobile1) existing.mobile1 = row.mobile1;
        if (!existing.landline1 && row.landline1) existing.landline1 = row.landline1;
        if (!existing.address && row.address) existing.address = row.address;
        if (!existing.website && row.website) existing.website = row.website;
        if (!existing.industry && row.industry) existing.industry = row.industry;
        if (!existing.status && row.status) existing.status = row.status;
        if (!existing.remarks && row.remarks) existing.remarks = row.remarks;
      }
    }
  }

  return Array.from(companyMap.values());
}
