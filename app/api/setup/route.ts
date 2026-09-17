import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS companies (
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
      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
      CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies(phone);
      CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT,
        position TEXT,
        email TEXT,
        mobile TEXT,
        landline TEXT,
        contact_preference TEXT,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON contacts(mobile);

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
        contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        source TEXT,
        industry TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        priority TEXT NOT NULL DEFAULT 'Medium',
        estimated_value DECIMAL(12,2),
        last_contact_date TIMESTAMP,
        next_follow_up TIMESTAMP,
        assigned_to TEXT,
        notes TEXT,
        date_added TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
      CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        project_name TEXT NOT NULL,
        project_location TEXT,
        project_type TEXT,
        status TEXT NOT NULL DEFAULT 'Quotation',
        contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        assigned_to TEXT,
        source TEXT,
        quotation_date TIMESTAMP,
        start_date TIMESTAMP,
        target_completion TIMESTAMP,
        actual_completion TIMESTAMP,
        installation_status TEXT,
        testing_status TEXT,
        commissioning_status TEXT,
        remarks TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        time TEXT,
        performed_by TEXT,
        contact_person TEXT,
        description TEXT,
        result TEXT,
        next_action TEXT,
        next_follow_up TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
      CREATE INDEX IF NOT EXISTS idx_activities_project_id ON activities(project_id);
      CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
      CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date);
      CREATE INDEX IF NOT EXISTS idx_activities_next_follow_up ON activities(next_follow_up);

      CREATE TABLE IF NOT EXISTS status_definitions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(name, type)
      );

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        filename TEXT NOT NULL,
        sheet_name TEXT,
        total_rows INT NOT NULL DEFAULT 0,
        imported_rows INT NOT NULL DEFAULT 0,
        skipped_rows INT NOT NULL DEFAULT 0,
        error_rows INT NOT NULL DEFAULT 0,
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
