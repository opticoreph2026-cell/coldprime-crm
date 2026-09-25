import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "prisma", "migrations", "004_restructure_crm.sql"), "utf8");
  const c = new pg.Client(cfg());
  await c.connect();
  try {
    await c.query(sql);
    console.log("OK: 004_restructure_crm.sql applied");
    const idx = await c.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('companies','leads','documents') AND indexname LIKE '%type%' OR indexname LIKE 'documents%' ORDER BY indexname`
    );
    console.log(idx.rows.map((r) => ` ${r.indexname}`).join("\n"));
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
