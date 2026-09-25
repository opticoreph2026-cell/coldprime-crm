import "dotenv/config";
import pg from "pg";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

async function main() {
  const c = new pg.Client(cfg());
  await c.connect();
  try {
    const idx = await c.query(
      `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('companies','leads','documents') ORDER BY tablename, indexname`
    );
    console.log(idx.rows.map((r) => `${r.tablename}: ${r.indexname}`).join("\n"));
    const enums = await c.query(
      `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
       FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
       JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
       GROUP BY t.typname ORDER BY t.typname`
    );
    console.log("\nEnums:");
    for (const e of enums.rows) console.log(` ${e.typname}: ${String(e.labels)}`);
    const tables = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    console.log("\nTables:", tables.rows.map((r) => r.table_name).join(", "));
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
