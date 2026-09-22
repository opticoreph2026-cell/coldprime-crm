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

  const headAdmin = await prisma.user.upsert({
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

  const cebuStaff = await prisma.user.upsert({
    where: { email: "cebu-staff@coldprime.ph" },
    update: {},
    create: {
      email: "cebu-staff@coldprime.ph",
      name: "Cebu Staff",
      password: passwordHash,
      role: "STAFF",
      branchId: cebuBranch.id,
    },
  });

  const manilaStaff = await prisma.user.upsert({
    where: { email: "manila-staff@coldprime.ph" },
    update: {},
    create: {
      email: "manila-staff@coldprime.ph",
      name: "Manila Staff",
      password: passwordHash,
      role: "STAFF",
      branchId: manilaBranch.id,
    },
  });
  console.log(`Users: ${headAdmin.email} (HEAD_ADMIN), ${cebuStaff.email} (STAFF), ${manilaStaff.email} (STAFF)`);

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
    "Phone Call", "Email", "SMS", "Meeting", "Site Visit", "Site Inspection", "Follow-Up",
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

// Seed companies (suppliers) for Cebu
  const cebuCompanyNames = [
    "Cebu Construction Supply",
    "Mactan HVAC Systems",
    "Cebu Electrical Depot",
    "Island General Plumbing",
    "Cebu Roofing Solutions",
  ];
  const cebuCompanyIndustries = ["Construction", "Construction", "Construction", "Construction", "Construction"];
  const cebuCompanyEmails = ["info@cebucharcon.com", "sales@mactanhvac.com", "contact@cebuelec.com", "sales@islandplumb.com", "info@ceburoofing.com"];
  const cebuCompanyMobiles = ["09171234501", "09171234502", "09171234503", "09171234504", "09171234505"];
  const cebuCompanyStatuses = ["Active", "Active", "Prospect", "Pending", "Active"];
  const cebuCompanyAddresses = ["123 Mango Ave, Cebu", "456 Basak Rd, Lapu-Lapu", "789 Colon St, Cebu", "321 Mango Ave, Cebu", "555 Gov Cuenco Ave, Cebu"];

  const cebuCompanyIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const company = await prisma.company.create({
      data: {
        branchId: cebuBranch.id,
        name: cebuCompanyNames[i],
        industry: cebuCompanyIndustries[i],
        email: cebuCompanyEmails[i],
        mobile1: cebuCompanyMobiles[i],
        status: cebuCompanyStatuses[i],
        address: cebuCompanyAddresses[i],
      },
    }).catch(() => null);
    if (company) cebuCompanyIds.push(company.id);
  }

  // Seed companies (suppliers) for Manila
  const manilaCompanyNames = [
    "Manila Builders Supply",
    "Metro HVAC Manila",
    "National Electrical Co",
    "Metro Plumbing Services",
    "Tagaytay Cooling Systems",
  ];
  const manilaCompanyIndustries = ["Construction", "Construction", "Construction", "Construction", "Construction"];
  const manilaCompanyEmails = ["info@manilabuild.com", "sales@metrohvac.com", "contact@nationalelec.com", "sales@metroplumb.com", "info@tagcooling.com"];
  const manilaCompanyMobiles = ["09171234601", "09171234602", "09171234603", "09171234604", "09171234605"];
  const manilaCompanyStatuses = ["Active", "Active", "Prospect", "Active", "Pending"];
  const manilaCompanyAddresses = ["100 EDSA, Mandaluyong", "200 Taft Ave, Manila", "300 Quezon Ave, QC", "400 Roxas Blvd, Manila", "500 Aguinaldo Hwy, Tagaytay"];

  const manilaCompanyIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const company = await prisma.company.create({
      data: {
        branchId: manilaBranch.id,
        name: manilaCompanyNames[i],
        industry: manilaCompanyIndustries[i],
        email: manilaCompanyEmails[i],
        mobile1: manilaCompanyMobiles[i],
        status: manilaCompanyStatuses[i],
        address: manilaCompanyAddresses[i],
      },
    }).catch(() => null);
    if (company) manilaCompanyIds.push(company.id);
  }

  // Seed contacts for Cebu companies
  const cebuContactData = [
    { companyIdx: 0, firstName: "Juan", lastName: "Dela Cruz", email: "juan@cebucharcon.com", mobile: "09170000001", position: "Manager" },
    { companyIdx: 1, firstName: "Maria", lastName: "Santos", email: "maria@mactanhvac.com", mobile: "09170000002", position: "Sales Manager" },
  ];
  for (const c of cebuContactData) {
    const companyId = cebuCompanyIds[c.companyIdx];
    if (companyId) {
      await prisma.contact.create({
        data: { branchId: cebuBranch.id, companyId, firstName: c.firstName, lastName: c.lastName, email: c.email, mobile: c.mobile, position: c.position },
      }).catch(() => {});
    }
  }

  // Seed contacts for Manila companies
  const manilaContactData = [
    { companyIdx: 0, firstName: "Pedro", lastName: "Reyes", email: "pedro@manilabuild.com", mobile: "09170000003", position: "Manager" },
    { companyIdx: 1, firstName: "Ana", lastName: "Garcia", email: "ana@metrohvac.com", mobile: "09170000004", position: "Director" },
  ];
  for (const c of manilaContactData) {
    const companyId = manilaCompanyIds[c.companyIdx];
    if (companyId) {
      await prisma.contact.create({
        data: { branchId: manilaBranch.id, companyId, firstName: c.firstName, lastName: c.lastName, email: c.email, mobile: c.mobile, position: c.position },
      }).catch(() => {});
    }
  }

  console.log(`Seeded companies and contacts for both branches`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
