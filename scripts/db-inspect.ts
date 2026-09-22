import "dotenv/config";
import pg from "pg";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
  );
  for (const t of tables.rows) {
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t.table_name]
    );
    console.log(`${t.table_name}: ${cols.rows.map((c) => c.column_name).join(", ")}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
