import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

async function main() {
  const client = new pg.Client(cfg());
  await client.connect();
  console.log("Connected (sslmode stripped, rejectUnauthorized=false)");

  try {
    const users = await client.query(
      `SELECT id, email, role, is_active, LEFT(password, 7) AS hash_prefix, LENGTH(password) AS hash_len FROM users ORDER BY email`
    );
    console.log("\nUsers in DB:");
    for (const u of users.rows) {
      console.log(` - ${u.email} role=${u.role} active=${u.is_active} hash=${u.hash_prefix}... len=${u.hash_len}`);
    }

    const admin = users.rows.find((u: { email: string }) => u.email === "admin@coldprime.ph");
    if (admin) {
      const full = await client.query(`SELECT password FROM users WHERE email=$1`, ["admin@coldprime.ph"]);
      const ok = await bcrypt.compare("Coldprime2026!", full.rows[0].password);
      console.log(`\nbcrypt.compare("Coldprime2026!", admin hash): ${ok}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
