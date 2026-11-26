import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Usage: npx tsx -r dotenv/config scripts/db-run-migration.ts <sql-file-in-prisma/migrations> [--strict]
// Strict mode: fail on the first error (for CI verification of new migrations).
// Tolerant mode (default): apply every statement, report per-statement pass/fail,
// exit non-zero only if the highest-numbered migration file fails.
function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: sslmode === "disable" ? false : { rejectUnauthorized: false },
  };
}

async function main() {
  const file = process.argv[2];
  const strict = process.argv.includes("--strict");
  if (!file) throw new Error("usage: db-run-migration.ts <file.sql> [--strict]");

  const sql = fs.readFileSync(path.join(__dirname, "..", "prisma", "migrations", file), "utf8");
  const c = new pg.Client(cfg());
  await c.connect();
  const failures: { stmt: string; error: string }[] = [];
  let success = 0;

  try {
    // one statement at a time (ALTER TYPE ADD VALUE must not share a transaction with usage)
    for (const stmt of sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) {
      try {
        await c.query(stmt);
        success++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // In tolerant mode, log and continue; in strict mode, fail fast.
        failures.push({ stmt: stmt.slice(0, 120), error: message });
        if (strict) throw error;
      }
    }
  } finally {
    await c.end();
  }

  const status = failures.length === 0 ? "OK" : `OK WITH ${failures.length} STATEMENT ERROR(S)`;
  console.log(`${status}: ${file} (${success} statements applied${failures.length > 0 ? `, ${failures.length} failed` : ""})`);
  for (const f of failures) {
    console.log(`  FAILED: ${f.stmt}... -> ${f.error}`);
  }

  if (strict && failures.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
