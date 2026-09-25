import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../lib/prisma/client/client";

function cfg() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("sslmode");
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: false } };
}

const prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool(cfg())) });

async function main() {
  // 1. lead status definitions exist
  const leadStatuses = await prisma.statusDefinition.findMany({ where: { type: "lead", isActive: true } });
  console.log(`lead status_definitions: ${leadStatuses.length}`);
  if (leadStatuses.length === 0) throw new Error("no lead statuses seeded");

  // 2. company type filter + accreditation update
  const company = await prisma.company.findFirst({ where: { branchId: "branch_cebu" } });
  if (!company) throw new Error("no company found");
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: { type: "GENERAL_CONTRACTOR", accreditationStatus: "DOCUMENTS_SUBMITTED", accreditationSubmittedAt: new Date() },
  });
  console.log(`company type=${updated.type} accreditation=${updated.accreditationStatus} submittedAt=${updated.accreditationSubmittedAt ? "set" : "missing"}`);
  const filtered = await prisma.company.count({ where: { branchId: "branch_cebu", type: "GENERAL_CONTRACTOR" } });
  console.log(`companies filtered by type GENERAL_CONTRACTOR: ${filtered}`);

  // 3. lead type field
  const lead = await prisma.lead.findFirst({ where: { branchId: "branch_cebu" } });
  if (lead) {
    const l2 = await prisma.lead.update({ where: { id: lead.id }, data: { type: "ACCREDITATION" } });
    console.log(`lead type=${l2.type}`);
  } else {
    console.log("no leads yet (ok)");
  }
  const leadCount = await prisma.lead.count({ where: { type: "ACCREDITATION" } });
  console.log(`leads filtered by type ACCREDITATION: ${leadCount}`);

  // 4. document create/read/delete
  const doc = await prisma.document.create({
    data: { branchId: "branch_cebu", companyId: company.id, category: "Company Profile", fileName: "smoke.pdf", fileUrl: "https://example.com/smoke.pdf" },
  });
  const fetched = await prisma.company.findFirst({ where: { id: company.id }, include: { documents: true } });
  console.log(`document created: ${doc.id}, company documents: ${fetched?.documents.length}`);
  await prisma.document.delete({ where: { id: doc.id } });
  console.log("document deleted");

  // 5. reset accreditation
  await prisma.company.update({ where: { id: company.id }, data: { type: "OTHER", accreditationStatus: "NOT_STARTED", accreditationSubmittedAt: null, accreditationDecisionAt: null } });
  console.log("company reset to defaults");

  console.log("SMOKE OK");
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); }).finally(() => prisma.$disconnect());
