// Plain enum option lists shared by API validation and client UI.
// Keep in sync with prisma/schema.prisma enums.

export const COMPANY_TYPES = [
  "GENERAL_CONTRACTOR",
  "ARCHITECT",
  "DEVELOPER",
  "PROPERTY_MANAGER",
  "END_CLIENT",
  "OTHER",
] as const;

export const ACCREDITATION_STATUSES = [
  "NOT_STARTED",
  "DOCUMENTS_SUBMITTED",
  "UNDER_REVIEW",
  "ACCREDITED",
  "REJECTED",
] as const;

export const LEAD_TYPES = [
  "ACCREDITATION",
  "PROJECT_BID",
  "DESIGN_PARTNERSHIP",
] as const;

// Pipeline stages per lead type (seeded as status_definitions with type "lead")
export const LEAD_TYPE_STAGES: Record<string, string[]> = {
  ACCREDITATION: ["New", "Contacted", "Documents Submitted", "Under Review", "Accredited", "Rejected"],
  PROJECT_BID: ["New", "Contacted", "Quotation Sent", "Negotiation", "Won", "Lost"],
  DESIGN_PARTNERSHIP: ["New", "Contacted", "Technical Discussion", "Proposal Sent", "Confirmed", "Inactive"],
};

export const DOCUMENT_CATEGORIES = [
  "Company Profile",
  "Accreditation Form",
  "Permit",
  "Quotation",
  "Contract",
  "Product Data Sheet",
  "Other",
] as const;

export function isCompanyType(v: unknown): v is string {
  return typeof v === "string" && (COMPANY_TYPES as readonly string[]).includes(v);
}

export function isAccreditationStatus(v: unknown): v is string {
  return typeof v === "string" && (ACCREDITATION_STATUSES as readonly string[]).includes(v);
}

export function isLeadType(v: unknown): v is string {
  return typeof v === "string" && (LEAD_TYPES as readonly string[]).includes(v);
}
