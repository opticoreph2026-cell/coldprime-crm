import { PrismaClient } from "../lib/prisma/client/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Coldprime CRM database...");

  const passwordHash = await bcrypt.hash("Coldprime2026!", 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@coldprime.ph" },
    update: {},
    create: {
      email: "admin@coldprime.ph",
      name: "Administrator",
      password: passwordHash,
      role: "ADMIN",
    },
  });
  console.log(`Admin user: ${admin.email}`);

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

  for (const status of allStatuses) {
    await prisma.statusDefinition.upsert({
      where: { name_type: { name: status.name, type: status.type } },
      update: {},
      create: { name: status.name, type: status.type, isActive: true },
    });
  }

  console.log(`Seeded ${allStatuses.length} status definitions`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });