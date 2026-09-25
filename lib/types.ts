// Shared API/entity types — single source of truth for shapes returned by /api routes.
// Scalars are always present (Prisma returns full rows); relation fields are typed
// per what the page APIs include (list endpoints return reduced relation shapes).

export interface EntityRef {
  id: string;
  name: string;
}

export interface CompanyOption {
  id: string;
  name: string;
}

export interface ProjectOption {
  id: string;
  projectName: string;
}

export interface CompanyContactRef {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  email?: string | null;
  mobile?: string | null;
}

export interface CompanyProjectRef {
  id: string;
  status: string;
  projectName?: string;
  projectLocation?: string | null;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  type: string;
  accreditationStatus: string;
  accreditationSubmittedAt: string | null;
  accreditationDecisionAt: string | null;
  industry: string;
  email: string | null;
  mobile1: string | null;
  mobile2: string | null;
  mobile3: string | null;
  landline1: string | null;
  landline2: string | null;
  landline3: string | null;
  address: string | null;
  website: string | null;
  status: string;
  outreachStatus: string | null;
  lastEmailedAt: string | null;
  lastRepliedAt: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  contacts: CompanyContactRef[];
  projects: CompanyProjectRef[];
  activities: { id: string; type: string; date: string; description: string | null; performedBy: string | null }[];
  leads: LeadRef[];
  documents: Document[];
  _count: { activities: number; leads: number };
}

/** Lead as embedded on a company detail response (no full relation objects). */
export interface LeadRef {
  id: string;
  type: string;
  status: string;
  priority: string;
  estimatedValue: number | null;
  dateAdded: string;
}

export interface Lead {
  id: string;
  source: string | null;
  industry: string | null;
  type: string;
  status: string;
  priority: string;
  estimatedValue: number | null;
  lastContactDate: string | null;
  nextFollowUp: string | null;
  notes: string | null;
  dateAdded: string;
  company: EntityRef | null;
  contact: { id: string; firstName: string; lastName: string | null } | null;
}

export interface Project {
  id: string;
  projectName: string;
  projectLocation: string | null;
  projectType: string | null;
  status: string;
  startDate: string | null;
  targetCompletion: string | null;
  installationStatus: string | null;
  testingStatus: string | null;
  commissioningStatus: string | null;
  remarks: string | null;
  company: EntityRef;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  position: string | null;
  email: string | null;
  mobile: string | null;
  landline: string | null;
  notes: string | null;
  status: string;
  company: EntityRef;
}

export interface Activity {
  id: string;
  type: string;
  date: string;
  time: string | null;
  performedBy: string | null;
  contactPerson: string | null;
  description: string | null;
  result: string | null;
  nextAction: string | null;
  nextFollowUp: string | null;
  company: EntityRef | null;
  project: { id: string; projectName: string } | null;
}

export interface Document {
  id: string;
  category: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
}

export interface VendorContact {
  id: string;
  firstName: string;
  lastName?: string;
  position?: string;
  email?: string;
  mobile?: string;
  landline?: string;
  contactPreference?: string;
  notes?: string;
}

export interface VendorMaterial {
  id: string;
  itemName: string;
  category?: string;
  brand?: string;
  model?: string;
  unit?: string;
  unitPrice?: number;
  currency: string;
  priceValidUntil?: string;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  mobile1: string | null;
  mobile2: string | null;
  landline1: string | null;
  landline2: string | null;
  status: string;
  notes: string | null;
  branch: { id: string; name: string };
  createdAt: string;
  contacts: VendorContact[];
  materials: VendorMaterial[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLog {
  id: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  status: string;
  sentAt: string;
  errorCode: string | null;
}

export interface Recipient {
  id?: string;
  email: string;
  name: string | null;
  type: "contact" | "company";
  companyName?: string;
  industry?: string;
}

export interface MailSummary {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  matched: boolean;
  company: EntityRef | null;
}

export interface MailDetail extends MailSummary {
  html: string | null;
  text: string | null;
  cc: string;
}

export interface MailViewState {
  key: string;
  loading: boolean;
  data: MailDetail | null;
  error: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  branch: { id: string; name: string; slug: string } | null;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  slug: string;
}

export interface DashboardStats {
  totalCompanies: number;
  totalContacts: number;
  totalLeads: number;
  totalProjects: number;
  activeLeads: number;
  activeProjects: number;
  upcomingFollowUps: number;
  overdueFollowUps: number;
  followUpsDueToday: number;
  activitiesThisMonth: number;
  newLeadsThisMonth: number;
  accreditationsPending: number;
  totalActivities: number;
  totalVendors: number;
  totalEmailTemplates: number;
  pipelineTotal: number;
  pipelineByStatus: { status: string; count: number; value: number }[];
  recentActivities: {
    id: string;
    type: string;
    date: string;
    time: string | null;
    description: string | null;
    nextFollowUp: string | null;
    company: { id: string; name: string } | null;
    project: { id: string; projectName: string } | null;
  }[];
  projectsByStatus: { status: string; count: number }[];
}

export interface ImportPreview {
  filename: string;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  errorRows: number;
  sheets: {
    name: string;
    totalRows: number;
    duplicates: number[];
    errors: { row: number; reason: string }[];
    rows: { rowIndex: number; company?: string; sheetName: string }[];
  }[];
}
