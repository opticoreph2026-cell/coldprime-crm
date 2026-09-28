// KPI definitions for the weekly accomplishment report (master instructions 1.5).
// Activity types come from the managed "activity" status list; unmapped types
// count under "other".

export const KPI_GROUPS = {
  calls: ["Phone Call"],
  emails: ["Email"],
  sms: ["SMS"],
  meetings: ["Meeting"],
  siteVisits: ["Site Visit", "Site Inspection"],
  quotationsSent: ["Quotation Sent"],
  followUps: ["Follow-Up", "Quotation Follow-Up", "Accreditation Follow-Up"],
} as const;

export type ActivityKpiKey = keyof typeof KPI_GROUPS | "other";

export function kpiForActivityType(type: string): ActivityKpiKey {
  for (const [key, types] of Object.entries(KPI_GROUPS)) {
    if ((types as readonly string[]).includes(type)) return key as ActivityKpiKey;
  }
  return "other";
}

export const ACTIVITY_KPI_KEYS = [
  "calls",
  "emails",
  "sms",
  "meetings",
  "siteVisits",
  "quotationsSent",
  "followUps",
  "other",
] as const;

export interface Kpis {
  // activity-derived
  calls: number;
  emails: number;
  sms: number;
  meetings: number;
  siteVisits: number;
  quotationsSent: number;
  followUps: number;
  other: number;
  // record-derived
  newCompanies: number;
  newContacts: number;
  newLeads: number;
  pipelineMoves: number;
  leadsWon: number;
  leadsLost: number;
  accreditationsSubmitted: number;
  accreditationsApproved: number;
  projectsAdvanced: number;
  serviceTicketsOpened: number;
  serviceTicketsResolved: number;
  emailsSent: number;
}

/** Order of KPI columns in tables/exports. */
export const KPI_KEYS: (keyof Kpis)[] = [
  "calls",
  "emails",
  "sms",
  "meetings",
  "siteVisits",
  "quotationsSent",
  "followUps",
  "other",
  "newCompanies",
  "newContacts",
  "newLeads",
  "pipelineMoves",
  "leadsWon",
  "leadsLost",
  "accreditationsSubmitted",
  "accreditationsApproved",
  "projectsAdvanced",
  "serviceTicketsOpened",
  "serviceTicketsResolved",
  "emailsSent",
];

export function emptyKpis(): Kpis {
  const zeros = {} as Kpis;
  for (const key of KPI_KEYS) zeros[key] = 0;
  return zeros;
}

/** Human-readable KPI labels (used by Excel/PDF exports and the UI). */
export const KPI_LABELS: Record<keyof Kpis, string> = {
  calls: "Calls",
  emails: "Emails",
  sms: "SMS",
  meetings: "Meetings",
  siteVisits: "Site Visits",
  quotationsSent: "Quotations Sent",
  followUps: "Follow-Ups",
  other: "Other Activities",
  newCompanies: "New Companies",
  newContacts: "New Contacts",
  newLeads: "New Leads",
  pipelineMoves: "Pipeline Moves",
  leadsWon: "Leads Won",
  leadsLost: "Leads Lost",
  accreditationsSubmitted: "Accreditations Submitted",
  accreditationsApproved: "Accreditations Approved",
  projectsAdvanced: "Projects Advanced",
  serviceTicketsOpened: "Service Tickets Opened",
  serviceTicketsResolved: "Service Tickets Resolved",
  emailsSent: "Emails Sent",
};

export function addKpis(target: Kpis, source: Kpis): Kpis {
  for (const key of KPI_KEYS) target[key] += source[key];
  return target;
}

/** Accreditation statuses that count as "submitted" / "approved". */
export const ACCREDITATION_SUBMITTED = ["DOCUMENTS_SUBMITTED", "UNDER_REVIEW"];
export const ACCREDITATION_APPROVED = ["ACCREDITED"];
