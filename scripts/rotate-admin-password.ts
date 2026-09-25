import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../lib/prisma/client/client";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%^&*";

function generatePassword(len = 24): string {
  const bytes = randomBytes(len) as Buffer;
  let out = "";
  for (let i = 0; i < len; i++) out += CHARS[bytes[i] % CHARS.length];
  return out;
}

async function main() {
  const email = process.argv[2] || "admin@coldprime.ph";
  const password = process.env.ADMIN_PASSWORD || generatePassword();

  const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool(cfg())) });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) throw new Error(`user ${email} not found`);

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });

    // persist for local scripts (gitignored .env)
    const envPath = path.join(__dirname, "..", ".env");
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    if (/^ADMIN_PASSWORD=/m.test(env)) {
      env = env.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD="${password}"`);
    } else {
      env = env.trimEnd() + `\nADMIN_PASSWORD="${password}"\n`;
    }
    fs.writeFileSync(envPath, env);

    const ok = await bcrypt.compare(password, hash);
    console.log(`Rotated password for ${email} (role ${user.role}); verify=${ok}; ADMIN_PASSWORD written to .env`);
    console.log(`NEW PASSWORD: ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
