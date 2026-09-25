-- Restructure CRM: company/lead typing, accreditation, documents
CREATE TYPE "CompanyType" AS ENUM ('GENERAL_CONTRACTOR','ARCHITECT','DEVELOPER','PROPERTY_MANAGER','END_CLIENT','OTHER');
CREATE TYPE "AccreditationStatus" AS ENUM ('NOT_STARTED','DOCUMENTS_SUBMITTED','UNDER_REVIEW','ACCREDITED','REJECTED');
CREATE TYPE "LeadType" AS ENUM ('ACCREDITATION','PROJECT_BID','DESIGN_PARTNERSHIP');

ALTER TABLE companies ADD COLUMN IF NOT EXISTS type "CompanyType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accreditation_status "AccreditationStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accreditation_submitted_at TIMESTAMP(3);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accreditation_decision_at TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS companies_branch_id_type_idx ON companies(branch_id, type);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS type "LeadType" NOT NULL DEFAULT 'PROJECT_BID';
CREATE INDEX IF NOT EXISTS leads_branch_id_type_idx ON leads(branch_id, type);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  company_id TEXT,
  lead_id TEXT,
  project_id TEXT,
  vendor_id TEXT,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT documents_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT documents_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS documents_branch_id_idx ON documents(branch_id);
CREATE INDEX IF NOT EXISTS documents_company_id_idx ON documents(company_id);
CREATE INDEX IF NOT EXISTS documents_lead_id_idx ON documents(lead_id);
CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents(project_id);
CREATE INDEX IF NOT EXISTS documents_vendor_id_idx ON documents(vendor_id);
