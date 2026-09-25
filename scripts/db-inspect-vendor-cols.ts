export {};
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const p = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  const r = await p.query(
    `SELECT type, count(*) AS n, bool_and(isActive) AS all_active, count(*) FILTER (WHERE NOT "isActive") AS inactive
     FROM status_definitions GROUP BY type ORDER BY type`
  ).catch(async () =>
    p.query(
      `SELECT type, count(*) AS n FROM status_definitions GROUP BY type ORDER BY type`
    )
  );
  console.table(r.rows);
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
