// Shared parser for bulk price-list imports (Phase 2): CSV and XLSX in memory,
// header-alias mapping, numeric/date normalization. Used by
// app/api/products/import and app/api/vendors/import.
import ExcelJS from "exceljs";

export interface PriceRow {
  vendor?: string;
  itemName: string;
  category?: string;
  brand?: string;
  model?: string;
  unit?: string;
  price?: number;
  currency?: string;
  priceValidUntil?: string;
  leadTimeDays?: number;
  notes?: string;
}

export interface PriceListParse {
  headers: string[];
  rows: PriceRow[];
  errors: { row: number; reason: string }[];
}

const MAX_ROWS = 2000;

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** header alias -> PriceRow key */
const FIELD_ALIASES: Record<string, string> = {
  vendor: "vendor",
  vendorname: "vendor",
  supplier: "vendor",
  name: "itemName",
  product: "itemName",
  productname: "itemName",
  item: "itemName",
  itemname: "itemName",
  description: "itemName",
  category: "category",
  type: "category",
  brand: "brand",
  make: "brand",
  model: "model",
  modelno: "model",
  partnumber: "model",
  unit: "unit",
  uom: "unit",
  price: "price",
  unitprice: "price",
  cost: "price",
  sellprice: "price",
  sellingprice: "price",
  amount: "price",
  currency: "currency",
  pricevaliduntil: "priceValidUntil",
  validuntil: "priceValidUntil",
  validto: "priceValidUntil",
  expiry: "priceValidUntil",
  expirydate: "priceValidUntil",
  leadtime: "leadTimeDays",
  leadtimedays: "leadTimeDays",
  leadtimeinweeks: "leadTimeWeeks",
  leadtimeweeks: "leadTimeWeeks",
  leadtimeinmonths: "leadTimeMonths",
  leadtimemonths: "leadTimeMonths",
  notes: "notes",
  remarks: "notes",
  comment: "notes",
};

function mapHeaders(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = FIELD_ALIASES[normalizeHeader(h)];
    if (key) map[i] = key;
  });
  return map;
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function toPrice(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? undefined : n;
}

function toDateOnly(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  const parsed = Date.parse(text);
  if (isNaN(parsed)) return undefined;
  return new Date(parsed).toISOString().slice(0, 10);
}

function toDays(value: unknown, multiplier = 1): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Math.round(Number(String(value).replace(/[^0-9.\-]/g, "")));
  if (isNaN(n) || n < 0) return undefined;
  return n * multiplier;
}

function buildRow(fieldMap: Record<number, string>, cells: unknown[]): { row?: PriceRow; reason?: string } {
  const data: Record<string, unknown> = {};
  cells.forEach((cell, i) => {
    const key = fieldMap[i];
    if (key) data[key] = cell;
  });

  const itemName = cleanText(data.itemName);
  if (!itemName) return { reason: "Missing item name" };

  const row: PriceRow = {
    itemName,
    vendor: cleanText(data.vendor) || undefined,
    category: cleanText(data.category) || undefined,
    brand: cleanText(data.brand) || undefined,
    model: cleanText(data.model) || undefined,
    unit: cleanText(data.unit) || undefined,
    price: toPrice(data.price),
    currency: cleanText(data.currency) || undefined,
    priceValidUntil: toDateOnly(data.priceValidUntil),
    leadTimeDays: toDays(data.leadTimeDays) ?? toDays(data.leadTimeWeeks, 7) ?? toDays(data.leadTimeMonths, 30),
    notes: cleanText(data.notes) || undefined,
  };
  return { row };
}

/** Split one CSV line, honouring double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): PriceListParse {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines.length > 0 ? splitCsvLine(lines[0]) : [];
  const fieldMap = mapHeaders(headers);
  const rows: PriceRow[] = [];
  const errors: { row: number; reason: string }[] = [];

  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const { row, reason } = buildRow(fieldMap, splitCsvLine(lines[i]));
    if (row) rows.push(row);
    else errors.push({ row: i + 1, reason: reason || "Invalid row" });
  }

  return { headers, rows, errors };
}

export async function parseXlsx(buffer: Buffer): Promise<PriceListParse> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[1] || workbook.worksheets[0];
  const rows: PriceRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  let headers: string[] = [];
  let fieldMap: Record<number, string> = {};

  sheet.eachRow({ includeEmpty: false }, (line, rowNumber) => {
    const cells = line.values ? (line.values as unknown[]).slice(1) : []; // exceljs is 1-based
    if (rowNumber === 1) {
      headers = cells.map((c) => cleanText(c));
      fieldMap = mapHeaders(headers);
      return;
    }
    if (rows.length >= MAX_ROWS) return;
    const { row, reason } = buildRow(fieldMap, cells);
    if (row) rows.push(row);
    else errors.push({ row: rowNumber, reason: reason || "Invalid row" });
  });

  return { headers, rows, errors };
}

export async function parsePriceList(buffer: Buffer, filename: string): Promise<PriceListParse> {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if (ext === ".csv" || ext === ".txt") {
    return parseCsv(buffer.toString("utf-8"));
  }
  return parseXlsx(buffer);
}
