// Weekly accomplishment report builder (master instructions 1.5).
// Combines Activities (performedById), the AuditLog event ledger, EmailLogs and
// WeeklyReportNotes into a Monday-Sunday week-by-week structure.

import { prisma } from "@/lib/prisma";
import {
  startOfDayPH,
  endOfDayPH,
  splitIntoWeeks,
  currentWeekRange,
  validateRange,
  addDaysISO,
  sundayOf,
  WeekSlice,
} from "@/lib/dates";
import {
  ActivityKpiKey,
  Kpis,
  emptyKpis,
  addKpis,
  kpiForActivityType,
  ACCREDITATION_SUBMITTED,
  ACCREDITATION_APPROVED,
} from "./kpi-map";

export interface ReportInput {
  branchFilter: { branchId?: string };
  /** When set (STAFF or admin person filter), activities/emails are theirs only. */
  userId?: string | null;
  /** The signed-in user (used for the editable weekly note, even when viewing Everyone). */
  viewerUserId?: string | null;
  /** YYYY-MM-DD, inclusive. Defaults to the current Manila week. */
  from?: string;
  to?: string;
}

export interface ActivityRow {
  id: string;
  date: Date;
  type: string;
  kpi: ActivityKpiKey;
  description: string | null;
  companyName: string | null;
  projectName: string | null;
  performedBy: string | null;
  nextFollowUp: Date | null;
}

export interface PipelineMove {
  entity: string;
  label: string;
  from: string;
  to: string;
  at: Date;
  userName: string | null;
}

export interface EntityRow {
  id: string;
  name: string;
  sub: string | null;
  at: Date;
  userName: string | null;
}

export interface PlanRow {
  kind: "activity" | "lead";
  id: string;
  label: string;
  due: Date;
}

export interface WeeklyNote {
  weekStart: Date;
  highlights: string | null;
  blockers: string | null;
  userName: string | null;
}

export interface WeekReport {
  label: string;
  weekStart: Date;
  weekEnd: Date;
  kpis: Kpis;
  activities: ActivityRow[];
  pipelineMoves: PipelineMove[];
  newCompanies: EntityRow[];
  newContacts: EntityRow[];
  newLeads: EntityRow[];
  projectsAdvanced: PipelineMove[];
  serviceTickets: unknown[];
  emailsSent: number;
  nextWeekPlan: PlanRow[];
  note: WeeklyNote | null;
}

export interface WeeklyReport {
  range: { from: string; to: string };
  generatedAt: Date;
  scope: { branchName: string; userName: string | null };
  totals: Kpis;
  weeks: WeekReport[];
  /** The signed-in user's own note (what the note box edits). */
  myNote: WeeklyNote | null;
  limitations: string[];
}

export const REPORT_LIMITATIONS = [
  "Events before audit logging was deployed are not in the ledger; for older data, new companies/contacts/leads fall back to record creation dates (branch-wide, not per-person).",
  "Pipeline moves, won/lost leads and accreditation changes only appear from the moment audit logging went live.",
  "Service ticket columns stay at zero until the service ticket module exists.",
];

function detailString(details: unknown, key: string): string | null {
  if (details && typeof details === "object" && key in details) {
    const v = (details as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
    if (v === null || v === undefined) return null;
    return String(v);
  }
  return null;
}

export async function buildWeeklyReport({
  branchFilter,
  userId,
  viewerUserId,
  from,
  to,
}: ReportInput): Promise<WeeklyReport> {
  const range = { from: from || currentWeekRange().from, to: to || currentWeekRange().to };
  const err = validateRange(range.from, range.to);
  if (err) throw new RangeError(err);

  const weeks = splitIntoWeeks(range.from, range.to);
  const rangeStart = startOfDayPH(range.from);
  const rangeEnd = endOfDayPH(range.to);

  // "Next week plan" = the week after the LAST selected week (Mon-Sun).
  const planFromISO = addDaysISO(sundayOf(range.to), 1);
  const planToISO = addDaysISO(planFromISO, 6);
  const planStart = startOfDayPH(planFromISO);
  const planEnd = endOfDayPH(planToISO);

  const uid = userId || undefined;
  const dateFilter = { gte: rangeStart, lte: rangeEnd };

  const [
    activities,
    audits,
    emailLogs,
    notes,
    companies,
    contacts,
    leads,
    planActivities,
    planLeads,
    branchRow,
    userRow,
    myNotes,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: { ...branchFilter, date: dateFilter, ...(uid ? { performedById: uid } : {}) },
      include: {
        company: { select: { name: true } },
        project: { select: { projectName: true } },
        performedByUser: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        ...branchFilter,
        createdAt: dateFilter,
        action: { in: ["CREATE", "STATUS_CHANGE"] },
        entity: { in: ["company", "contact", "lead", "project"] },
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.emailLog.findMany({
      where: { ...branchFilter, status: "SENT", sentAt: dateFilter, ...(uid ? { fromUserId: uid } : {}) },
      select: { id: true, sentAt: true },
    }),
    prisma.weeklyReportNote.findMany({
      where: {
        ...branchFilter,
        weekStart: { gte: weeks[0].weekStart, lte: weeks[weeks.length - 1].weekEnd },
        ...(uid ? { userId: uid } : {}),
      },
      include: { user: { select: { name: true } } },
    }),
    prisma.company.findMany({
      where: { ...branchFilter, createdAt: dateFilter },
      select: { id: true, name: true, industry: true, status: true, createdAt: true },
    }),
    prisma.contact.findMany({
      where: { ...branchFilter, createdAt: dateFilter },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { ...branchFilter, createdAt: dateFilter },
      select: { id: true, status: true, createdAt: true, company: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: {
        ...branchFilter,
        nextFollowUp: { gte: planStart, lte: planEnd },
        ...(uid ? { performedById: uid } : {}),
      },
      select: {
        id: true,
        nextFollowUp: true,
        type: true,
        description: true,
        company: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { ...branchFilter, nextFollowUp: { gte: planStart, lte: planEnd } },
      select: { id: true, nextFollowUp: true, status: true, company: { select: { name: true } } },
    }),
    branchFilter.branchId
      ? prisma.branch.findUnique({ where: { id: branchFilter.branchId }, select: { name: true } })
      : Promise.resolve(null),
    uid ? prisma.user.findUnique({ where: { id: uid }, select: { name: true } }) : Promise.resolve(null),
    viewerUserId
      ? prisma.weeklyReportNote.findMany({
          where: { userId: viewerUserId, weekStart: { gte: weeks[0].weekStart, lte: weeks[weeks.length - 1].weekEnd } },
          include: { user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  // ---- attribution -------------------------------------------------------
  // CREATE audit rows tell us who created each record. Records with no audit
  // row predate audit logging and count branch-wide (see REPORT_LIMITATIONS).
  const creatorByEntity = new Map<string, { userId: string | null; userName: string | null }>();
  for (const a of audits) {
    if (a.action === "CREATE" && a.entityId) {
      creatorByEntity.set(`${a.entity}:${a.entityId}`, { userId: a.userId, userName: a.user?.name || null });
    }
  }

  const includeRecord = (entity: string, id: string): string | null => {
    const creator = creatorByEntity.get(`${entity}:${id}`);
    if (!uid) return creator?.userName || null;
    if (!creator) return null; // unaudited = branch-wide fallback, shown to everyone
    return creator.userId === uid ? creator.userName : "EXCLUDE";
  };

  const inWeek = (w: WeekSlice, d: Date) => d >= w.rangeStart && d <= w.rangeEnd;

  const activityRows: ActivityRow[] = activities.map((a) => ({
    id: a.id,
    date: a.date,
    type: a.type,
    kpi: kpiForActivityType(a.type),
    description: a.description,
    companyName: a.company?.name || null,
    projectName: a.project?.projectName || null,
    performedBy: a.performedBy || a.performedByUser?.name || null,
    nextFollowUp: a.nextFollowUp,
  }));

  const companyRows: EntityRow[] = companies
    .map((c) => ({ id: c.id, name: c.name, sub: c.industry, at: c.createdAt, userName: includeRecord("company", c.id) }))
    .filter((r) => r.userName !== "EXCLUDE");
  const contactRows: EntityRow[] = contacts
    .map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" "),
      sub: c.company?.name || null,
      at: c.createdAt,
      userName: includeRecord("contact", c.id),
    }))
    .filter((r) => r.userName !== "EXCLUDE");
  const leadRows: EntityRow[] = leads
    .map((l) => ({ id: l.id, name: l.company?.name || "Lead", sub: l.status, at: l.createdAt, userName: includeRecord("lead", l.id) }))
    .filter((r) => r.userName !== "EXCLUDE");

  const allMoves: PipelineMove[] = audits
    .filter(
      (a) =>
        a.action === "STATUS_CHANGE" &&
        (a.entity === "lead" || a.entity === "project" || a.entity === "company") &&
        (!uid || a.userId === uid),
    )
    .map((a) => ({
      entity: a.entity,
      label: detailString(a.details, "label") || detailString(a.details, "companyName") || a.entityId || a.entity,
      from: detailString(a.details, "from") || "?",
      to: detailString(a.details, "to") || "?",
      at: a.createdAt,
      userName: a.user?.name || null,
    }));

  const planRows: PlanRow[] = [
    ...planActivities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      label: `${a.type}${a.description ? `: ${a.description}` : a.company ? ` (${a.company.name})` : ""}`,
      due: a.nextFollowUp!,
    })),
    ...planLeads.map((l) => ({
      kind: "lead" as const,
      id: l.id,
      label: `Follow up: ${l.company?.name || "Lead"} [${l.status}]`,
      due: l.nextFollowUp!,
    })),
  ].sort((a, b) => a.due.getTime() - b.due.getTime());

  // ---- per-week assembly -------------------------------------------------
  const weekReports: WeekReport[] = weeks.map((w) => {
    const kpis = emptyKpis();

    const weekActivities = activityRows.filter((a) => inWeek(w, a.date));
    for (const a of weekActivities) kpis[a.kpi] += 1;

    const weekCompanies = companyRows.filter((r) => inWeek(w, r.at));
    const weekContacts = contactRows.filter((r) => inWeek(w, r.at));
    const weekLeads = leadRows.filter((r) => inWeek(w, r.at));
    kpis.newCompanies = weekCompanies.length;
    kpis.newContacts = weekContacts.length;
    kpis.newLeads = weekLeads.length;

    const weekMoves = allMoves.filter((m) => inWeek(w, m.at));
    kpis.pipelineMoves = weekMoves.length;
    for (const m of weekMoves) {
      if (m.entity === "lead" && m.to === "Won") kpis.leadsWon += 1;
      if (m.entity === "lead" && m.to === "Lost") kpis.leadsLost += 1;
      if (m.entity === "company" && ACCREDITATION_SUBMITTED.includes(m.to)) kpis.accreditationsSubmitted += 1;
      if (m.entity === "company" && ACCREDITATION_APPROVED.includes(m.to)) kpis.accreditationsApproved += 1;
    }
    const weekProjectsAdvanced = weekMoves.filter((m) => m.entity === "project");
    kpis.projectsAdvanced = weekProjectsAdvanced.length;

    // Service tickets: zero until the module exists (REPORT_LIMITATIONS).
    kpis.serviceTicketsOpened = 0;
    kpis.serviceTicketsResolved = 0;

    kpis.emailsSent = emailLogs.filter((e) => inWeek(w, e.sentAt)).length;

    const weekNote = notes.find((n) => n.weekStart >= w.weekStart && n.weekStart <= w.weekEnd);

    return {
      label: w.label,
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      kpis,
      activities: weekActivities,
      pipelineMoves: weekMoves,
      newCompanies: weekCompanies,
      newContacts: weekContacts,
      newLeads: weekLeads,
      projectsAdvanced: weekProjectsAdvanced,
      serviceTickets: [],
      emailsSent: kpis.emailsSent,
      nextWeekPlan: planRows,
      note: weekNote
        ? { weekStart: weekNote.weekStart, highlights: weekNote.highlights, blockers: weekNote.blockers, userName: weekNote.user?.name || null }
        : null,
    };
  });

  const totals = emptyKpis();
  for (const w of weekReports) addKpis(totals, w.kpis);

  return {
    range,
    generatedAt: new Date(),
    scope: {
      branchName: branchRow?.name || "All Branches",
      userName: userRow?.name || null,
    },
    totals,
    weeks: weekReports,
    myNote: myNotes.length > 0
      ? { weekStart: myNotes[0].weekStart, highlights: myNotes[0].highlights, blockers: myNotes[0].blockers, userName: myNotes[0].user?.name || null }
      : null,
    limitations: REPORT_LIMITATIONS,
  };
}
