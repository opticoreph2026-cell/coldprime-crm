export {};

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

// Compare every Prisma model's expected columns (@map-aware) against the live DB.
// Missing columns => PrismaClientKnownRequestError P2022 at runtime.

type Model = { name: string; table: string; fields: { field: string; column: string }[] };

function parseSchema(): Model[] {
  const src = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
  const modelNames = new Set([...src.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]));
  const models: Model[] = [];
  const modelRe = /^model\s+(\w+)\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(src))) {
    const name = m[1];
    let depth = 1;
    let i = modelRe.lastIndex;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const table = mapMatch ? mapMatch[1] : name;
    const fields: { field: string; column: string }[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const fm = line.match(/^(\w+)\s+([\w\[\]().,]+)/);
      if (!fm) continue;
      const field = fm[1];
      const typeName = fm[2].replace(/\?$/, "");
      // skip relation fields: type is another model (optionally an array)
      if (modelNames.has(typeName) || modelNames.has(typeName.replace(/\[\]$/, ""))) continue;
      const colMap = line.match(/@map\("([^"]+)"\)/);
      fields.push({ field, column: colMap ? colMap[1] : field });
    }
    models.push({ name, table, fields });
  }
  return models;
}

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  u.searchParams.delete("sslmode");
  const db = new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });

  const colsRes = await db.query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`
  );
  const dbCols = new Map<string, Set<string>>();
  for (const r of colsRes.rows as { table_name: string; column_name: string }[]) {
    if (!dbCols.has(r.table_name)) dbCols.set(r.table_name, new Set());
    dbCols.get(r.table_name)!.add(r.column_name);
  }

  const models = parseSchema();
  console.log(`Parsed ${models.length} models from schema.prisma\n`);

  let problems = 0;
  for (const model of models) {
    const actual = dbCols.get(model.table);
    if (!actual) {
      console.log(`MISSING TABLE  ${model.name} -> "${model.table}" (table not in DB)`);
      problems++;
      continue;
    }
    const missing = model.fields.filter((f) => !actual.has(f.column));
    if (missing.length > 0) {
      console.log(`MISSING COLS   ${model.name} ("${model.table}"): ${missing.map((f) => `${f.column} (from ${f.field})`).join(", ")}`);
      problems++;
    }
  }

  const schemaTables = new Set(models.map((x) => x.table));
  const orphans = [...dbCols.keys()].filter((t) => !schemaTables.has(t));
  if (orphans.length > 0) console.log(`\nDB-only tables (not in schema, harmless): ${orphans.join(", ")}`);

  for (const model of models) {
    const actual = dbCols.get(model.table);
    if (!actual) continue;
    const extra = [...actual].filter((c) => !model.fields.some((f) => f.column === c));
    if (extra.length > 0) console.log(`extra cols in ${model.table}: ${extra.join(", ")}`);
  }

  console.log(`\n${problems === 0 ? "OK: schema and DB are in sync" : `FOUND ${problems} model(s) with drift`}`);
  await db.end();
  process.exit(problems > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
