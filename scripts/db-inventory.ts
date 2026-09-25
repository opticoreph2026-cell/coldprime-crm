export {};

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

// List every table in the DB with row counts, flag anything not in schema.prisma

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });

  const schemaSrc = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
  const tableToModel = new Map<string, string>();
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schemaSrc))) {
    const name = m[1];
    const start = modelRe.lastIndex;
    let depth = 1, i = start;
    while (i < schemaSrc.length && depth > 0) {
      if (schemaSrc[i] === "{") depth++;
      else if (schemaSrc[i] === "}") depth--;
      i++;
    }
    const body = schemaSrc.slice(start, i - 1);
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    tableToModel.set(mapMatch ? mapMatch[1] : name, name);
  }

  const schemas = await db.query(
    `SELECT schema_name FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
     ORDER BY schema_name`
  );
  console.log("Schemas:", schemas.rows.map((r: { schema_name: string }) => r.schema_name).join(", "));

  const tables = await db.query(
    `SELECT table_schema, table_name, table_type
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY table_schema, table_name`
  );

  console.log(`\n${"TABLE".padEnd(30)} ${"SCHEMA".padEnd(10)} ${"ROWS".padStart(8)}  STATUS`);
  console.log("-".repeat(70));

  const unrelated: string[] = [];
  for (const t of tables.rows as { table_schema: string; table_name: string; table_type: string }[]) {
    let rows = "-";
    if (t.table_type === "BASE TABLE") {
      try {
        const c = await db.query(`SELECT count(*)::int AS n FROM "${t.table_schema}"."${t.table_name}"`);
        rows = String(c.rows[0].n);
      } catch { rows = "err"; }
    }
    let status = "related";
    if (t.table_schema !== "public") status = "schema-related";
    else if (!tableToModel.has(t.table_name)) {
      status = "UNRELATED";
      unrelated.push(`${t.table_schema}.${t.table_name} (${rows} rows)`);
    }
    const model = tableToModel.get(t.table_name);
    const label = model ? `${t.table_name} -> ${model}` : t.table_name;
    console.log(`${label.padEnd(30)} ${t.table_schema.padEnd(10)} ${rows.padStart(8)}  ${status}`);
  }

  // extra: columns inside unrelated tables
  if (unrelated.length > 0) {
    console.log("\n== Unrelated tables detail ==");
    for (const u2 of unrelated) {
      const [schema, table] = u2.split(" ")[0].split(".");
      const cols = await db.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
        [schema, table.replace(/\(.*\)/, "")]
      );
      console.log(`${schema}.${table}`);
      for (const c of cols.rows) console.log(`   ${c.column_name} : ${c.data_type}`);
    }
  } else {
    console.log("\nNo unrelated tables found in public schema.");
  }

  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
