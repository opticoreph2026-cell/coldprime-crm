export {};

import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  const r = await db.query(
    "SELECT type, count(*)::int AS n FROM companies GROUP BY type ORDER BY type"
  );
  console.log("company.type distribution:");
  for (const row of r.rows) console.log(`  ${row.type}: ${row.n}`);
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
