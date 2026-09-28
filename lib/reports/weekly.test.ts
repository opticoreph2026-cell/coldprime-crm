import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

vi.mock("@/lib/prisma", () => {
  const prisma = {
    activity: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
    emailLog: { findMany: vi.fn() },
    weeklyReportNote: { findMany: vi.fn() },
    company: { findMany: vi.fn() },
    contact: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    branch: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import { buildWeeklyReport } from "./weekly";
import { endOfDayPH, startOfDayPH } from "@/lib/dates";

const m = prisma as unknown as Record<string, { findMany: Mock; findUnique: Mock }>;

type Seed = {
  activity: unknown[];
  auditLog: unknown[];
  emailLog: unknown[];
  weeklyReportNote: unknown[];
  company: unknown[];
  contact: unknown[];
  lead: unknown[];
  myNotes: unknown[];
  branchRow: unknown;
  userRow: unknown;
};

const EMPTY: Seed = {
  activity: [],
  auditLog: [],
  emailLog: [],
  weeklyReportNote: [],
  company: [],
  contact: [],
  lead: [],
  myNotes: [],
  branchRow: null,
  userRow: null,
};

function seedMock(overrides: Partial<typeof EMPTY> = {}) {
  const data = { ...EMPTY, ...overrides };
  m.activity.findMany.mockResolvedValue(data.activity);
  m.auditLog.findMany.mockResolvedValue(data.auditLog);
  m.emailLog.findMany.mockResolvedValue(data.emailLog);
  m.weeklyReportNote.findMany.mockResolvedValue(data.weeklyReportNote);
  m.company.findMany.mockResolvedValue(data.company);
  m.contact.findMany.mockResolvedValue(data.contact);
  m.lead.findMany.mockResolvedValue(data.lead);
  m.branch.findUnique.mockResolvedValue(data.branchRow);
  m.user.findUnique.mockResolvedValue(data.userRow);
}

beforeEach(() => {
  vi.clearAllMocks();
  // myNotes is a separate call to weeklyReportNote.findMany - resolve it empty by default
  seedMock();
  m.weeklyReportNote.findMany.mockResolvedValue([]);
});

describe("buildWeeklyReport", () => {
  // 5. A week with no data still appears with zeros (not skipped).
  it("keeps empty weeks with zeros", async () => {
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-11" });
    expect(report.weeks).toHaveLength(2);
    for (const w of report.weeks) {
      expect(w.kpis.calls).toBe(0);
      expect(w.kpis.newCompanies).toBe(0);
      expect(w.activities).toHaveLength(0);
    }
    expect(report.totals.calls).toBe(0);
  });

  // 2. An activity at 23:30 Manila on the last selected day is included.
  it("includes an activity at 23:30 Manila on the last selected day", async () => {
    seedMock({
      activity: [
        {
          id: "a1",
          date: new Date("2026-10-02T23:30:00+08:00"),
          type: "Phone Call",
          performedBy: "Ana",
          nextFollowUp: null,
          company: { name: "ACME" },
          project: null,
          performedByUser: null,
        },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-02" });
    expect(report.weeks[0].activities).toHaveLength(1);
    expect(report.weeks[0].kpis.calls).toBe(1);
    expect(report.totals.calls).toBe(1);

    // the prisma date filter must span Manila start..end of the range
    const where = m.activity.findMany.mock.calls[0][0].where;
    expect(where.date.gte.getTime()).toBe(startOfDayPH("2026-09-28").getTime());
    expect(where.date.lte.getTime()).toBe(endOfDayPH("2026-10-02").getTime());
  });

  // 3. An activity at 00:10 Manila on the first selected day is included.
  it("includes an activity at 00:10 Manila on the first selected day", async () => {
    seedMock({
      activity: [
        {
          id: "a2",
          date: new Date("2026-09-28T00:10:00+08:00"),
          type: "Email",
          performedBy: "Ana",
          nextFollowUp: null,
          company: { name: "ACME" },
          project: null,
          performedByUser: null,
        },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-02" });
    expect(report.weeks[0].kpis.emails).toBe(1);
  });

  // Unmapped activity types count under "other".
  it("buckets unmapped activity types under other", async () => {
    seedMock({
      activity: [
        { id: "a3", date: new Date("2026-09-29T10:00:00+08:00"), type: "Data Gathering", performedBy: null, nextFollowUp: null, company: null, project: null, performedByUser: null },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-02" });
    expect(report.totals.other).toBe(1);
    expect(report.totals.calls).toBe(0);
  });

  // 8. New -> Quotation Sent -> Won in one week = 2 pipeline rows, 1 "won".
  it("counts two pipeline moves and one won for a lead that moves twice", async () => {
    seedMock({
      auditLog: [
        {
          id: "e1",
          userId: "u1",
          entity: "lead",
          entityId: "l1",
          action: "STATUS_CHANGE",
          details: { from: "New", to: "Quotation Sent", label: "ACME" },
          createdAt: new Date("2026-09-28T09:00:00+08:00"),
          user: { name: "Ana" },
        },
        {
          id: "e2",
          userId: "u1",
          entity: "lead",
          entityId: "l1",
          action: "STATUS_CHANGE",
          details: { from: "Quotation Sent", to: "Won", label: "ACME" },
          createdAt: new Date("2026-09-30T14:00:00+08:00"),
          user: { name: "Ana" },
        },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-04" });
    expect(report.weeks[0].pipelineMoves).toHaveLength(2);
    expect(report.totals.pipelineMoves).toBe(2);
    expect(report.totals.leadsWon).toBe(1);
    expect(report.totals.leadsLost).toBe(0);
    expect(report.weeks[0].pipelineMoves[1].to).toBe("Won");
  });

  // 9. Editing a note on an old project does NOT count as "advanced".
  it("ignores UPDATE audit rows (no status change)", async () => {
    seedMock({
      auditLog: [
        {
          id: "e3",
          userId: "u1",
          entity: "project",
          entityId: "p1",
          action: "UPDATE",
          details: { label: "Old Tower" },
          createdAt: new Date("2026-09-29T11:00:00+08:00"),
          user: { name: "Ana" },
        },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-04" });
    expect(report.totals.pipelineMoves).toBe(0);
    expect(report.totals.projectsAdvanced).toBe(0);
    expect(report.weeks[0].projectsAdvanced).toHaveLength(0);
  });

  it("counts project status changes as projects advanced", async () => {
    seedMock({
      auditLog: [
        {
          id: "e4",
          userId: "u1",
          entity: "project",
          entityId: "p1",
          action: "STATUS_CHANGE",
          details: { from: "Quotation", to: "Installation", label: "Old Tower" },
          createdAt: new Date("2026-09-29T11:00:00+08:00"),
          user: { name: "Ana" },
        },
      ],
    });
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-04" });
    expect(report.totals.projectsAdvanced).toBe(1);
    expect(report.totals.pipelineMoves).toBe(1);
  });

  // 6 (builder half). Activities are fetched with the caller's performedById,
  // and pipeline moves from other users are excluded when userId is set.
  it("scopes activities and pipeline moves to the requested user", async () => {
    seedMock({
      auditLog: [
        {
          id: "e5",
          userId: "u2",
          entity: "lead",
          entityId: "l2",
          action: "STATUS_CHANGE",
          details: { from: "New", to: "Won", label: "Beta Corp" },
          createdAt: new Date("2026-09-29T09:00:00+08:00"),
          user: { name: "Ben" },
        },
        {
          id: "e6",
          userId: "u1",
          entity: "lead",
          entityId: "l3",
          action: "STATUS_CHANGE",
          details: { from: "New", to: "Won", label: "Other Inc" },
          createdAt: new Date("2026-09-29T10:00:00+08:00"),
          user: { name: "Ana" },
        },
      ],
    });
    const report = await buildWeeklyReport({
      branchFilter: { branchId: "branch_cebu" },
      userId: "u2",
      from: "2026-09-28",
      to: "2026-10-04",
    });

    const activityWhere = m.activity.findMany.mock.calls[0][0].where;
    expect(activityWhere.performedById).toBe("u2");
    expect(activityWhere.branchId).toBe("branch_cebu");

    expect(report.totals.pipelineMoves).toBe(1);
    expect(report.weeks[0].pipelineMoves[0].label).toBe("Beta Corp");
    expect(report.weeks[0].pipelineMoves[0].userName).toBe("Ben");
  });

  it("shows records without audit history to everyone (branch-wide fallback)", async () => {
    seedMock({
      company: [
        { id: "c1", name: "Unaudited Co", industry: "Constructions", status: "Active", createdAt: new Date("2026-09-29T08:00:00+08:00") },
        { id: "c2", name: "Audited Co", industry: "Constructions", status: "Active", createdAt: new Date("2026-09-29T08:00:00+08:00") },
      ],
      auditLog: [
        {
          id: "e7",
          userId: "u1",
          entity: "company",
          entityId: "c2",
          action: "CREATE",
          details: { label: "Audited Co" },
          createdAt: new Date("2026-09-29T08:00:00+08:00"),
          user: { name: "Ana" },
        },
      ],
    });

    const everyone = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-04" });
    expect(everyone.totals.newCompanies).toBe(2);

    // u2 did not create "Audited Co" (u1 did) but the unaudited record shows for everyone
    const forU2 = await buildWeeklyReport({ branchFilter: {}, userId: "u2", from: "2026-09-28", to: "2026-10-04" });
    expect(forU2.totals.newCompanies).toBe(1);
    expect(forU2.weeks[0].newCompanies[0].name).toBe("Unaudited Co");

    // u1 sees both (their audited record + the unaudited fallback)
    const forU1 = await buildWeeklyReport({ branchFilter: {}, userId: "u1", from: "2026-09-28", to: "2026-10-04" });
    expect(forU1.totals.newCompanies).toBe(2);
  });

  it("rejects from > to and over-long ranges", async () => {
    await expect(buildWeeklyReport({ branchFilter: {}, from: "2026-10-05", to: "2026-09-28" })).rejects.toThrow();
    await expect(buildWeeklyReport({ branchFilter: {}, from: "2024-01-01", to: "2026-01-02" })).rejects.toThrow(/366/);
  });

  it("defaults to the current Manila week when no range is given", async () => {
    const report = await buildWeeklyReport({ branchFilter: {} });
    expect(report.weeks).toHaveLength(1);
    expect(report.range.from <= report.range.to).toBe(true);
  });

  it("counts SENT email logs per week", async () => {
    const emailLog = vi.fn().mockResolvedValue([{ id: "m1", sentAt: new Date("2026-09-29T09:00:00+08:00") }]);
    m.emailLog.findMany = emailLog;
    const report = await buildWeeklyReport({ branchFilter: {}, from: "2026-09-28", to: "2026-10-04" });
    expect(report.totals.emailsSent).toBe(1);
    const where = emailLog.mock.calls[0][0].where;
    expect(where.status).toBe("SENT");
  });
});
