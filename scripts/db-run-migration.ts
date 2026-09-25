import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

// Usage: npx tsx -r dotenv/config scripts/db-run-migration.ts <sql-file-in-prisma/migrations>
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: db-run-migration.ts <file.sql>");
  const sql = fs.readFileSync(path.join(__dirname, "..", "prisma", "migrations", file), "utf8");
  const c = new pg.Client(cfg());
  await c.connect();
  try {
    // one statement at a time (ALTER TYPE ADD VALUE must not share a transaction with usage)
    for (const stmt of sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) {
      await c.query(stmt);
    }
    console.log(`OK: ${file} applied`);
    const enums = await c.query(
      `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
       JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='CompanyType'
       ORDER BY e.enumsortorder`
    );
    console.log("CompanyType:", enums.rows.map((r) => r.enumlabel).join(", "));
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
