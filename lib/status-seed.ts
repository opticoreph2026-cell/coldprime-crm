// Master instructions Phase 4: the lead status list that must exist in
// status_definitions (type "lead") for every branch. Shared by
// prisma/seed.ts and scripts/seed-lead-statuses.ts.
export const APPROVED_STATUS_LEAD: string[] = [
  "New",
  "Contacted",
  "Documents Submitted",
  "Under Review",
  "Accredited",
  "Quotation Sent",
  "Negotiation",
  "Won",
  "Lost",
  "On Hold",
  "Nurture",
];
