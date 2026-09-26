export {};

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient, CompanyType } from "../lib/prisma/client/client";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool(cfg())) });

// One-off import of the Google Sheets master list (companies + contacts + status)
// Usage: npx tsx scripts/import-masterlist.ts [--dry-run]

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1CwiixR8kX1RsC6hoB0e9fJ0UCXECXPp9JW22cHzZdEk/export?format=csv&gid=0";

const DRY_RUN = process.argv.includes("--dry-run");

const COMPANY_TYPE_MAP: Record<string, string> = {
  constructions: "GENERAL_CONTRACTOR",
  "general contractor": "GENERAL_CONTRACTOR",
};

// ---------- CSV parsing ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ---------- field parsing ----------

function splitEmails(cell: string): string[] {
  return cell
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

type Phones = { mobiles: string[]; landlines: string[]; unparsed: string[] };

function parsePhones(cell: string): Phones {
  const out: Phones = { mobiles: [], landlines: [], unparsed: [] };
  for (const raw of cell.split(/[\n;]+/)) {
    const piece = raw.trim();
    if (!piece) continue;
    const m = piece.match(/\+?\d[\d\s().-]{6,}\d/);
    if (!m) { out.unparsed.push(piece); continue; }
    let digits = m[0].replace(/\D/g, "");
    if (digits.startsWith("63")) digits = "0" + digits.slice(2);
    let isMobile: boolean | null = null;
    if (/^09\d{9}$/.test(digits)) isMobile = true;
    else if (/^03\d{8,9}$/.test(digits)) isMobile = false;
    else if (/^0\d{9,10}$/.test(digits)) isMobile = digits[1] === "9";
    if (isMobile === null) { out.unparsed.push(piece); continue; }
    const target = isMobile ? out.mobiles : out.landlines;
    const cap = isMobile ? 3 : 3;
    if (target.length < cap && !target.includes(digits)) target.push(digits);
    else if (target.length >= cap) out.unparsed.push(piece);
  }
  return out;
}

function parseContactPerson(cell: string): { name: string; mobile: string } | null {
  if (!cell.trim()) return null;
  const phoneMatch = cell.match(/\+?\d[\d\s().-]{6,}\d/);
  let mobile = "";
  if (phoneMatch) {
    let digits = phoneMatch[0].replace(/\D/g, "");
    if (digits.startsWith("63")) digits = "0" + digits.slice(2);
    if (/^0\d{9,10}$/.test(digits)) mobile = digits;
  }
  let name = cell;
  if (phoneMatch) name = name.replace(phoneMatch[0], " ");
  name = name.replace(/\([^)]*\)/g, " "); // drop (Admin), (viber) etc.
  name = name.replace(/\s*-\s*/g, " ");
  name = collapse(name).replace(/^[-:.,\s]+|[-:.,\s]+$/g, "");
  if (name.length < 2) return null;
  if (/^0?\d{7,}$/.test(name)) return null;
  return { name: name.slice(0, 60), mobile };
}

// ---------- main ----------

async function main() {
  console.log(DRY_RUN ? "DRY RUN - no writes" : "LIVE RUN");
  console.log("Fetching sheet CSV...");
  const res = await fetch(SHEET_CSV_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);
  const csv = (await res.text()).replace(/^\uFEFF/, "");
  const rows = parseCsv(csv);
  console.log(`CSV rows: ${rows.length}`);

  // header row = first row containing a "Company" cell
  const headerIdx = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === "company"));
  if (headerIdx < 0) throw new Error("Header row with 'Company' not found");
  const col = (name: string) =>
    rows[headerIdx].findIndex((c) => c.trim().toLowerCase().startsWith(name));
  const C = {
    company: col("company"),
    category: col("category"),
    address: col("address"),
    phone: col("contact no"),
    email: col("email"),
    person: col("contact person"),
    status: col("status"),
    remarks: col("remarks"),
    website: col("website"),
  };
  for (const [k, v] of Object.entries(C)) if (v < 0) throw new Error(`Column not found: ${k}`);
  console.log("Columns:", C);

  const branches = await prisma.branch.findMany({ orderBy: { createdAt: "asc" } });
  const branch = branches.find((b) => /cebu/i.test(b.slug) || /cebu/i.test(b.name)) || branches[0];
  if (!branch) throw new Error("No branches in database");
  console.log(`Target branch: ${branch.name} (${branch.id})`);

  const existing = await prisma.company.findMany({ where: { branchId: branch.id }, select: { name: true } });
  const seen = new Set(existing.map((c) => normName(c.name)));
  console.log(`Existing companies in branch: ${existing.length}`);

  const dataRows = rows.slice(headerIdx + 1);
  const created: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const industries = new Set<string>();
  const statuses = new Set<string>();
  let contactCount = 0;

  for (const row of dataRows) {
    const cell = (i: number) => (i >= 0 && row[i] !== undefined ? row[i] : "");
    const rawName = collapse(cell(C.company));
    if (!rawName) { skipped.push({ name: `(row ${row[0]?.trim() || "?"})`, reason: "empty name" }); continue; }
    const key = normName(rawName);
    if (seen.has(key)) { skipped.push({ name: rawName, reason: "duplicate (file or existing)" }); continue; }

    const emails = splitEmails(cell(C.email));
    const phones = parsePhones(cell(C.phone));
    const contact = parseContactPerson(cell(C.person));
    const remarks = collapse(cell(C.remarks));
    const category = collapse(cell(C.category));
    const status = collapse(cell(C.status)) || "Active";

    const noteParts: string[] = [];
    if (remarks) noteParts.push(remarks);
    if (emails.length > 1) noteParts.push(`Alt emails: ${emails.slice(1).join(", ")}`);
    if (phones.unparsed.length > 0) noteParts.push(`Other contact nos: ${phones.unparsed.join(", ")}`);

    const type = COMPANY_TYPE_MAP[category.toLowerCase()] || "OTHER";
    if (category) industries.add(category);
    if (status !== "Active") statuses.add(status);
    if (contact) contactCount++;

    if (DRY_RUN) {
      created.push(rawName);
      seen.add(key);
      continue;
    }

    const company = await prisma.company.create({
      data: {
        branchId: branch.id,
        name: rawName,
        type: type as CompanyType,
        industry: category || "Other",
        address: collapse(cell(C.address)) || null,
        website: collapse(cell(C.website)) || null,
        email: emails[0] || null,
        mobile1: phones.mobiles[0] || null,
        mobile2: phones.mobiles[1] || null,
        mobile3: phones.mobiles[2] || null,
        landline1: phones.landlines[0] || null,
        landline2: phones.landlines[1] || null,
        status,
        notes: noteParts.join(" | ") || null,
        source: "Master List",
      },
    });
    created.push(rawName);
    seen.add(key);

    if (contact) {
      await prisma.contact.create({
        data: {
          branchId: branch.id,
          companyId: company.id,
          firstName: contact.name,
          mobile: contact.mobile || null,
        },
      });
    }
  }

  // ensure imported industry + status values exist as managed definitions
  if (!DRY_RUN) {
    for (const name of industries) {
      const exists = await prisma.statusDefinition.findFirst({ where: { branchId: branch.id, type: "industry", name } });
      if (!exists) {
        const max = await prisma.statusDefinition.aggregate({ where: { branchId: branch.id, type: "industry" }, _max: { sortOrder: true } });
        await prisma.statusDefinition.create({ data: { branchId: branch.id, type: "industry", name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
        console.log(`  + industry definition: ${name}`);
      }
    }
    for (const name of statuses) {
      const exists = await prisma.statusDefinition.findFirst({ where: { branchId: branch.id, type: "company", name } });
      if (!exists) {
        const max = await prisma.statusDefinition.aggregate({ where: { branchId: branch.id, type: "company" }, _max: { sortOrder: true } });
        await prisma.statusDefinition.create({ data: { branchId: branch.id, type: "company", name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
        console.log(`  + company status definition: ${name}`);
      }
    }
  }

  console.log(`\nCompanies created: ${created.length}`);
  console.log(`Contacts created:  ${contactCount}`);
  console.log(`Skipped: ${skipped.length}`);
  for (const s of skipped) console.log(`   - ${s.name} (${s.reason})`);
  if (DRY_RUN) console.log("\nDry run only - re-run without --dry-run to apply.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
