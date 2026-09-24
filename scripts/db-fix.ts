import "dotenv/config";
import pg from "pg";

const DDL = [
  `CREATE TABLE IF NOT EXISTS vendors (
    id varchar PRIMARY KEY,
    branch_id varchar NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name varchar NOT NULL,
    category varchar,
    address varchar,
    website varchar,
    email varchar,
    mobile1 varchar,
    mobile2 varchar,
    landline1 varchar,
    landline2 varchar,
    status varchar NOT NULL DEFAULT 'Active',
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vendors_branch_id_idx ON vendors(branch_id)`,
  `CREATE INDEX IF NOT EXISTS vendors_branch_id_name_idx ON vendors(branch_id, name)`,

  `CREATE TABLE IF NOT EXISTS vendor_contacts (
    id varchar PRIMARY KEY,
    vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    "firstName" varchar NOT NULL,
    "lastName" varchar,
    position varchar,
    email varchar,
    mobile varchar,
    landline varchar,
    "contactPreference" varchar,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vendor_contacts_vendor_id_idx ON vendor_contacts(vendor_id)`,

  `CREATE TABLE IF NOT EXISTS vendor_materials (
    id varchar PRIMARY KEY,
    vendor_id varchar NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    "itemName" varchar NOT NULL,
    category varchar,
    brand varchar,
    "model" varchar,
    unit varchar,
    "unitPrice" numeric(12,2),
    currency varchar NOT NULL DEFAULT 'PHP',
    "priceValidUntil" timestamp,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS vendor_materials_vendor_id_idx ON vendor_materials(vendor_id)`,
  `CREATE INDEX IF NOT EXISTS vendor_materials_vendor_id_category_idx ON vendor_materials(vendor_id, category)`,
];

const VERIFY = [
  `SELECT id, branch_id, name, subject, body, category, is_active, created_at, updated_at FROM email_templates LIMIT 1`,
  `SELECT id, branch_id, template_id, from_user_id, to_email, to_name, subject, status, sent_at, error_code, metadata, created_at FROM email_logs LIMIT 1`,
];

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: url.toString(),
    ssl:
      process.env.PG_INSECURE_SSL === "1"
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
  });
  await client.connect();

  try {
    for (const sql of DDL) {
      await client.query(sql);
      console.log("OK:", sql.split("\n")[0].slice(0, 80));
    }

    for (const sql of VERIFY) {
      await client.query(sql);
      console.log("VERIFY OK:", sql.slice(0, 70) + "...");
    }

    // Round-test vendor tables inside a transaction, then roll back
    const branch = await client.query("SELECT id FROM branches LIMIT 1");
    if (branch.rows.length > 0) {
      await client.query("BEGIN");
      const v = await client.query(
        `INSERT INTO vendors (id, branch_id, name, status, created_at, updated_at)
         VALUES ('test_vendor_1', $1, 'Test Vendor', 'Active', now(), now()) RETURNING id`,
        [branch.rows[0].id]
      );
      await client.query(
        `INSERT INTO vendor_contacts (id, vendor_id, "firstName", created_at, updated_at)
         VALUES ('test_vc_1', $1, 'Juan', now(), now())`,
        [v.rows[0].id]
      );
      await client.query(
        `INSERT INTO vendor_materials (id, vendor_id, "itemName", currency, created_at, updated_at)
         VALUES ('test_vm_1', $1, 'Chiller', 'PHP', now(), now())`,
        [v.rows[0].id]
      );
      await client.query("ROLLBACK");
      console.log("ROUNDTRIP OK (rolled back)");
    }

    console.log("\nALL DONE");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
