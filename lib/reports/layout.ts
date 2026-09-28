// Column layout for the weekly accomplishment exports (master instructions 1.10).
// When the owner provides the "Accomplishment Report Rose" sheet from
// CRM 2026.xlsx, mirror its columns/order HERE only - the export logic reads
// everything from this file.

import { KPI_KEYS, KPI_LABELS } from "./kpi-map";

export const REPORT_ORG = "COLDPRIME ENTERPRISES CORPORATION";
export const REPORT_TITLE = "Weekly Accomplishment Report";

export const SHEET_NAMES = {
  summary: "Summary",
  activities: "Activities",
  pipeline: "Pipeline Moves",
  records: "New Companies & Leads",
  projects: "Projects & Service Tickets",
  plan: "Next Week Plan",
} as const;

/** Summary: one row per week, one column per KPI, totals row at the end. */
export const SUMMARY_COLUMNS: string[] = ["Week", ...KPI_KEYS.map((k) => KPI_LABELS[k])];

export const ACTIVITY_COLUMNS = [
  "Week",
  "Date",
  "Type",
  "Company",
  "Project",
  "Performed By",
  "Description",
  "Next Follow-Up",
] as const;

export const PIPELINE_COLUMNS = ["Week", "Date", "Entity", "Record", "From", "To", "By"] as const;

export const RECORD_COLUMNS = ["Week", "Date", "Kind", "Name", "Detail", "Created By"] as const;

export const PROJECT_COLUMNS = ["Week", "Date", "Project", "From", "To", "By"] as const;

export const SERVICE_TICKET_COLUMNS = ["Week", "Date", "Ticket", "Status", "Resolved"] as const;

export const PLAN_COLUMNS = ["Kind", "Due", "Item"] as const;

export const ENTITY_LABELS: Record<string, string> = {
  company: "Company",
  contact: "Contact",
  lead: "Lead",
  project: "Project",
};
