import "dotenv/config";
import pg from "pg";

const DDL = [
  // email_logs: dedup lookup by subject+recipient, daily budget count by status+sent_at
  `CREATE INDEX IF NOT EXISTS email_logs_subject_status_to_email_idx ON email_logs(subject, status, to_email)`,
  `CREATE INDEX IF NOT EXISTS email_logs_to_email_idx ON email_logs(to_email)`,
  `CREATE INDEX IF NOT EXISTS email_logs_status_sent_at_idx ON email_logs(status, sent_at)`,
  // companies: reply matching via company.email OR contacts.email
  `CREATE INDEX IF NOT EXISTS companies_email_idx ON companies(email)`,
  `CREATE INDEX IF NOT EXISTS contacts_email_company_id_idx ON contacts(email, "companyId")`,
];

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    for (const sql of DDL) {
      await client.query(sql);
      console.log("OK:", sql.slice(0, 90));
    }

    const idx = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('email_logs','companies','contacts') ORDER BY indexname`
    );
    console.log("\nIndexes now present:");
    for (const r of idx.rows) console.log(" -", r.indexname);

    console.log("\nALL DONE");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
