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

// Seed companies (potential clients) for Cebu
  const cebuCompanyNames = [
    "Cebu Grand Hotel",
    "Mactan Resort & Spa",
    "Visayas Medical Center",
    "Cebu Business Park Tower",
    "Lapu-Lapu City Hall",
  ];
  const cebuCompanyIndustries = ["Hotel", "Hotel", "Hospital", "Real Estate", "Government"];
  const cebuCompanyEmails = ["facilities@cebugrand.com", "admin@mactanspa.com", "ops@visayasmed.com", "info@cbptower.com", "supply@lapulapu.gov.ph"];
  const cebuCompanyMobiles = ["09171234501", "09171234502", "09171234503", "09171234504", "09171234505"];
  const cebuCompanyStatuses = ["Active", "Prospect", "Active", "Pending", "Prospect"];
  const cebuCompanyAddresses = ["123 Mango Ave, Cebu", "456 Basak Rd, Lapu-Lapu", "789 Colon St, Cebu", "321 Mango Ave, Cebu", "555 Gov Cuenco Ave, Cebu"];

  const cebuCompanyIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.company.findFirst({
      where: { branchId: cebuBranch.id, name: cebuCompanyNames[i] },
      select: { id: true },
    });
    let companyId: string;
    if (existing) {
      companyId = existing.id;
    } else {
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
      });
      companyId = company.id;
    }
    cebuCompanyIds.push(companyId);
  }
  console.log(`Cebu companies seeded: ${cebuCompanyIds.length}`);

  // Seed companies (clients) for Cebu
  const manilaCompanyNames = [
    "Makati Shangri-La Hotel",
    "Manila Doctors Hospital",
    "BGC High Street Tower",
    " Ortigas Center Mall",
    "Quezon City Government Complex",
  ];
  const manilaCompanyIndustries = ["Hotel", "Hospital", "Real Estate", "Retail", "Government"];
  const manilaCompanyEmails = ["facilities@shangrila-makati.com", "admin@maniladoctors.ph", "info@bgchigh.com", "ops@ortigasmall.com", "supply@quezoncity.gov.ph"];
  const manilaCompanyMobiles = ["09171234601", "09171234602", "09171234603", "09171234604", "09171234605"];
  const manilaCompanyStatuses = ["Active", "Active", "Prospect", "Pending", "Prospect"];
  const manilaCompanyAddresses = ["100 EDSA, Makati", "200 Quirino Ave, Manila", "300 5th Ave, BGC", "400 Julia Vargas, Ortigas", "500 Elliptical Rd, QC"];

  const manilaCompanyIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.company.findFirst({
      where: { branchId: manilaBranch.id, name: manilaCompanyNames[i] },
      select: { id: true },
    });
    let companyId: string;
    if (existing) {
      companyId = existing.id;
    } else {
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
      });
      companyId = company.id;
    }
    manilaCompanyIds.push(companyId);
  }

  // Seed contacts for Cebu client companies
  const cebuContactData = [
    { companyIdx: 0, firstName: "Juan", lastName: "Dela Cruz", email: "juan@cebugrand.com", mobile: "09170000001", position: "Facilities Manager" },
    { companyIdx: 1, firstName: "Maria", lastName: "Santos", email: "maria@mactanspa.com", mobile: "09170000002", position: "Admin Manager" },
  ];
  for (const c of cebuContactData) {
    const companyId = cebuCompanyIds[c.companyIdx];
    if (!companyId) continue;
    const existing = await prisma.contact.findFirst({
      where: { branchId: cebuBranch.id, companyId, email: c.email },
      select: { id: true },
    });
    if (!existing) {
      await prisma.contact.create({
        data: { branchId: cebuBranch.id, companyId, firstName: c.firstName, lastName: c.lastName, email: c.email, mobile: c.mobile, position: c.position },
      });
    }
  }

  // Seed contacts for Manila client companies
  const manilaContactData = [
    { companyIdx: 0, firstName: "Pedro", lastName: "Reyes", email: "pedro@shangrila-makati.com", mobile: "09170000003", position: "Facilities Manager" },
    { companyIdx: 1, firstName: "Ana", lastName: "Garcia", email: "ana@maniladoctors.ph", mobile: "09170000004", position: "Admin Director" },
  ];
  for (const c of manilaContactData) {
    const companyId = manilaCompanyIds[c.companyIdx];
    if (!companyId) continue;
    const existing = await prisma.contact.findFirst({
      where: { branchId: manilaBranch.id, companyId, email: c.email },
      select: { id: true },
    });
    if (!existing) {
      await prisma.contact.create({
        data: { branchId: manilaBranch.id, companyId, firstName: c.firstName, lastName: c.lastName, email: c.email, mobile: c.mobile, position: c.position },
      });
    }
  }

  console.log(`Seeded companies and contacts for both branches`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
