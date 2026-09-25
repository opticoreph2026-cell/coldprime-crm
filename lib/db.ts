import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "./prisma/client/client";

// Supabase pooler presents a cert chain with a self-signed root, so full TLS
// verification fails. Strip sslmode from the URL (pg 8.23 treats
// sslmode=require as verify-full) and encrypt without CA verification —
// same behavior as before the audit TLS change.
function dbConfig() {
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
  url?.searchParams.delete("sslmode");
  return {
    connectionString: url ? url.toString() : undefined,
    ssl: { rejectUnauthorized: false },
  };
}

export function createPrismaClient() {
  const pool = new pg.Pool(dbConfig());
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
