import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS import_batches CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS status_definitions CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS activities CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS projects CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS leads CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS contacts CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS companies CASCADE`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS admin_users CASCADE`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE admin_users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE companies (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        industry TEXT NOT NULL DEFAULT 'Other',
        address TEXT,
        website TEXT,
        email TEXT,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT,
        source TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_companies_name ON companies(name);
      CREATE INDEX idx_companies_phone ON companies(phone);
      CREATE INDEX idx_companies_status ON companies(status);

      CREATE TABLE contacts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT,
        position TEXT,
        email TEXT,
        mobile TEXT,
        landline TEXT,
        "contactPreference" TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_contacts_company_id ON contacts("companyId");
      CREATE INDEX idx_contacts_email ON contacts(email);
      CREATE INDEX idx_contacts_mobile ON contacts(mobile);

      CREATE TABLE leads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "companyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
        "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        source TEXT,
        industry TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        priority TEXT NOT NULL DEFAULT 'Medium',
        "estimatedValue" DECIMAL(12,2),
        "lastContactDate" TIMESTAMP,
        "nextFollowUp" TIMESTAMP,
        "assignedTo" TEXT,
        notes TEXT,
        date_added TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_leads_status ON leads(status);
      CREATE INDEX idx_leads_company_id ON leads("companyId");
      CREATE INDEX idx_leads_next_follow_up ON leads("nextFollowUp");

      CREATE TABLE projects (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        "projectName" TEXT NOT NULL,
        "projectLocation" TEXT,
        "projectType" TEXT,
        status TEXT NOT NULL DEFAULT 'Quotation',
        "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        "assignedTo" TEXT,
        source TEXT,
        "quotationDate" TIMESTAMP,
        "startDate" TIMESTAMP,
        "targetCompletion" TIMESTAMP,
        "actualCompletion" TIMESTAMP,
        "installationStatus" TEXT,
        "testingStatus" TEXT,
        "commissioningStatus" TEXT,
        remarks TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_projects_company_id ON projects("companyId");
      CREATE INDEX idx_projects_status ON projects(status);

      CREATE TABLE activities (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "companyId" TEXT REFERENCES companies(id) ON DELETE SET NULL,
        "projectId" TEXT REFERENCES projects(id) ON DELETE SET NULL,
        "contactId" TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        time TEXT,
        "performedBy" TEXT,
        "contactPerson" TEXT,
        description TEXT,
        result TEXT,
        "nextAction" TEXT,
        "nextFollowUp" TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_activities_company_id ON activities("companyId");
      CREATE INDEX idx_activities_project_id ON activities("projectId");
      CREATE INDEX idx_activities_contact_id ON activities("contactId");
      CREATE INDEX idx_activities_date ON activities(date);
      CREATE INDEX idx_activities_next_follow_up ON activities("nextFollowUp");

      CREATE TABLE status_definitions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(name, type)
      );

      CREATE TABLE import_batches (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        filename TEXT NOT NULL,
        "sheetName" TEXT,
        "totalRows" INT NOT NULL DEFAULT 0,
        "importedRows" INT NOT NULL DEFAULT 0,
        "skippedRows" INT NOT NULL DEFAULT 0,
        "errorRows" INT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        errors TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    return NextResponse.json({ success: true, message: "All tables created successfully" });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
