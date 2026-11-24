// Phase 0 CI guard: migrations are applied by scripts/db-run-migration.ts (raw SQL,
// not `prisma migrate`), so there is no migration ledger. This check keeps the
// folder honest: sequential numeric prefixes, no gaps or duplicates, non-empty SQL.
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "prisma", "migrations");
if (!fs.existsSync(dir)) {
  console.error(`Missing migrations directory: ${dir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

if (files.length === 0) {
  console.error("No .sql migrations found");
  process.exit(1);
}

const problems = [];
const seen = new Map();

files.forEach((file, index) => {
  const match = /^(\d{3})_.+\.sql$/.exec(file);
  if (!match) {
    problems.push(`${file}: expected <NNN>_<name>.sql`);
    return;
  }
  const number = Number(match[1]);
  const expected = index + 1;
  if (number !== expected) {
    problems.push(`${file}: prefix ${match[1]} should be ${String(expected).padStart(3, "0")}`);
  }
  if (seen.has(number)) {
    problems.push(`${file}: duplicate prefix ${match[1]} (also ${seen.get(number)})`);
  }
  seen.set(number, file);

  const sql = fs.readFileSync(path.join(dir, file), "utf8").trim();
  if (!sql) problems.push(`${file}: empty`);
});

if (problems.length > 0) {
  console.error("Migration check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

console.log(`Migration check OK: ${files.length} sequential files`);
