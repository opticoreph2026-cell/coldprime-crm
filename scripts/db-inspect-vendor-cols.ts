export {};
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const p = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  const r = await p.query(
    `SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS cols
     FROM information_schema.columns
     WHERE table_schema = 'public'
     GROUP BY table_name
     ORDER BY table_name`
  );
  for (const row of r.rows as { table_name: string; cols: string }[]) {
    console.log(`${row.table_name}: ${row.cols}`);
  }
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
