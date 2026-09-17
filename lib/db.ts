import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "./prisma/client/client";

export function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}