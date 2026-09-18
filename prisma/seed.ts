import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../lib/prisma/client/client";
import bcrypt from "bcryptjs";

function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port) || 5432,
    database: u.pathname.replace(/^\//, ""),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
  };
}

const opts = parseDatabaseUrl(process.env.DATABASE_URL!);
const pool = new pg.Pool({ ...opts });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Coldprime CRM database...");

  // Seed branches
  const cebuBranch = await prisma.branch.upsert({
    where: { slug: "cebu" },
    update: {},
    create: { id: "branch_cebu", name: "Cebu Office", slug: "cebu", domain: "cebu.coldprime-crm.vercel.app" },
  });
  const manilaBranch = await prisma.branch.upsert({
    where: { slug: "manila" },
    update: {},
    create: { id: "branch_manila", name: "Manila Office", slug: "manila", domain: "manila.coldprime-crm.vercel.app" },
  });
  console.log(`Branches: ${cebuBranch.name}, ${manilaBranch.name}`);

  // Seed users
  const passwordHash = await bcrypt.hash("Coldprime2026!", 10);

  const cebuAdmin = await prisma.user.upsert({
    where: { email: "admin@coldprime.ph" },
    update: {},
    create: {
      email: "admin@coldprime.ph",
      name: "Head Administrator",
      password: passwordHash,
      role: "HEAD_ADMIN",
      branchId: cebuBranch.id,
    },
  });

  const manilaAdmin = await prisma.user.upsert({
    where: { email: "manila@coldprime.ph" },
    update: {},
    create: {
      email: "manila@coldprime.ph",
      name: "Manila Administrator",
      password: passwordHash,
      role: "BRANCH_ADMIN",
      branchId: manilaBranch.id,
    },
  });
  console.log(`Users: ${cebuAdmin.email} (HEAD_ADMIN), ${manilaAdmin.email} (BRANCH_ADMIN)`);

  // Seed status definitions for each branch
  const companyStatuses = ["Active", "Inactive", "Pending", "Prospect", "Archived"];
  const projectStatuses = [
    "New", "Email Sent", "Email Sent, for Contact", "Executed Emails Sent",
    "No Answer", "Unattended / Not in Service", "Call Again", "Emailed",
    "Ongoing", "Quotation", "Approved", "Installation", "Testing",
    "Commissioning", "Completed", "On Hold", "Cancelled", "Declined",
    "Infrastructure Solutions",
  ];
  const activityTypes = [
    "Phone Call", "Email", "SMS", "Meeting", "Site Visit", "Follow-Up",
    "Quotation Sent", "Quotation Follow-Up", "Accreditation Follow-Up",
    "Data Gathering", "Other",
  ];
  const industries = [
    "General Contractor", "Architectural", "Construction",
    "Business Process Outsourcing (BPO)", "Security Systems", "Hotel",
    "Hospital", "Restaurant", "Retail", "Government", "Manufacturing",
    "Real Estate", "Education", "IT / Technology", "Healthcare", "Other",
  ];

  const allStatuses = [
    ...companyStatuses.map((s) => ({ name: s, type: "company" })),
    ...projectStatuses.map((s) => ({ name: s, type: "project" })),
    ...activityTypes.map((s) => ({ name: s, type: "activity" })),
    ...industries.map((s) => ({ name: s, type: "industry" })),
  ];

  // Seed status definitions for both branches
  for (const branch of [cebuBranch, manilaBranch]) {
    for (const status of allStatuses) {
      await prisma.statusDefinition.upsert({
        where: { branchId_name_type: { branchId: branch.id, name: status.name, type: status.type } },
        update: {},
        create: { branchId: branch.id, name: status.name, type: status.type, isActive: true },
      });
    }
  }

  console.log(`Seeded ${allStatuses.length * 2} status definitions (both branches)`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
