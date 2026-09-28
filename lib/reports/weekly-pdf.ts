// PDF export for the weekly accomplishment report (master instructions 1.8).
// Cover block -> totals table -> one section per week; autoTable handles page
// breaks (no manual yPos checks).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { WeeklyReport, WeekReport } from "./weekly";
import { KPI_KEYS, KPI_LABELS } from "./kpi-map";
import { ENTITY_LABELS, REPORT_ORG, REPORT_TITLE } from "./layout";
import { formatPH, startOfDayPH, endOfDayPH } from "@/lib/dates";

const DARK = { fg: [31, 56, 100] as [number, number, number], muted: [102, 102, 102] as [number, number, number] };

function lastFinalY(doc: jsPDF): number {
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  return anyDoc.lastAutoTable?.finalY ?? 0;
}

function setFinalY(doc: jsPDF, y: number): void {
  (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable = { finalY: y };
}

/** Start a fresh page with the drawing cursor near the top. */
function newPage(doc: jsPDF): void {
  doc.addPage();
  setFinalY(doc, 42);
}

function ensureSpace(doc: jsPDF, needed: number): void {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (lastFinalY(doc) + needed > pageHeight - 60) newPage(doc);
}

function heading(doc: jsPDF, text: string, size = 13): void {
  ensureSpace(doc, size + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...DARK.fg);
  const y = lastFinalY(doc) > 0 ? lastFinalY(doc) + 22 : 50;
  doc.text(text, 42, y);
  setFinalY(doc, y);
}

function table(doc: jsPDF, head: string[][], body: (string | number)[][], startY?: number): void {
  autoTable(doc, {
    head,
    body,
    startY,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: DARK.fg, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [242, 245, 250] },
    margin: { left: 42, right: 42 },
  });
}

function weekSection(doc: jsPDF, w: WeekReport): void {
  heading(doc, w.label, 13);

  // KPI table (only non-zero rows keep the report readable)
  const kpiRows = KPI_KEYS.filter((k) => w.kpis[k] > 0).map((k) => [KPI_LABELS[k], w.kpis[k]] as (string | number)[]);
  table(doc, [["KPI", "Count"]], kpiRows.length ? kpiRows : [["No activity this week", 0]]);

  // Activities grouped by day
  const byDay = new Map<string, typeof w.activities>();
  for (const a of w.activities) {
    const day = formatPH(a.date, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(a);
  }
  if (byDay.size > 0) {
    heading(doc, "What was done", 11);
    const rows: (string | number)[][] = [];
    for (const [day, acts] of byDay) {
      for (const a of acts) {
        rows.push([
          day,
          a.type,
          a.companyName || a.projectName || "",
          a.description || "",
          a.performedBy || "",
        ]);
      }
    }
    table(doc, [["Day", "Type", "Company / Project", "Description", "By"]], rows);
  }

  if (w.pipelineMoves.length > 0) {
    heading(doc, "Pipeline moves", 11);
    table(
      doc,
      [["Record", "Item", "From", "To", "By"]],
      w.pipelineMoves.map((m) => [ENTITY_LABELS[m.entity] || m.entity, m.label, m.from, m.to, m.userName || ""]),
    );
  }

  const newRows: (string | number)[][] = [
    ...w.newCompanies.map((r) => ["Company", r.name, r.sub || "", r.userName || ""]),
    ...w.newContacts.map((r) => ["Contact", r.name, r.sub || "", r.userName || ""]),
    ...w.newLeads.map((r) => ["Lead", r.name, r.sub || "", r.userName || ""]),
  ];
  if (newRows.length > 0) {
    heading(doc, "New records", 11);
    table(doc, [["Kind", "Name", "Detail", "Created by"]], newRows);
  }

  if (w.projectsAdvanced.length > 0) {
    heading(doc, "Projects advanced", 11);
    table(
      doc,
      [["Project", "From", "To", "By"]],
      w.projectsAdvanced.map((m) => [m.label, m.from, m.to, m.userName || ""]),
    );
  }

  if (w.nextWeekPlan.length > 0) {
    heading(doc, "Next week plan", 11);
    table(
      doc,
      [["Due", "Item"]],
      w.nextWeekPlan.map((p) => [formatPH(p.due), p.label]),
    );
  }

  if (w.note && (w.note.highlights || w.note.blockers)) {
    heading(doc, "Highlights / Blockers", 11);
    let y = lastFinalY(doc) + 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    if (w.note.highlights) {
      doc.text(`Highlights: ${w.note.highlights}`, 42, y, { maxWidth: 510 });
      y += 16;
    }
    if (w.note.blockers) {
      doc.text(`Blockers: ${w.note.blockers}`, 42, y, { maxWidth: 510 });
      y += 14;
    }
    setFinalY(doc, y);
  }
}

export function buildWeeklyPdf(report: WeeklyReport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // ---- Cover block ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK.fg);
  doc.text(REPORT_ORG, 42, 56);
  doc.setFontSize(13);
  doc.text(REPORT_TITLE, 42, 78);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const meta: string[] = [
    `Branch: ${report.scope.branchName}`,
    `Employee: ${report.scope.userName || "Everyone"}`,
    `Period: ${formatPH(startOfDayPH(report.range.from))} - ${formatPH(endOfDayPH(report.range.to))}`,
    `Generated: ${formatPH(report.generatedAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} (Asia/Manila)`,
  ];
  let metaY = 100;
  for (const line of meta) {
    doc.text(line, 42, metaY);
    metaY += 15;
  }
  setFinalY(doc, metaY);

  // ---- Totals ----
  heading(doc, "Summary - totals for the period", 13);
  table(
    doc,
    [["KPI", "Total"]],
    KPI_KEYS.map((k) => [KPI_LABELS[k], report.totals[k]] as (string | number)[]),
  );

  // ---- One section per week ----
  for (const w of report.weeks) {
    newPage(doc);
    weekSection(doc, w);
  }

  // ---- Limitations footer note ----
  newPage(doc);
  heading(doc, "Notes and limitations", 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK.muted);
  let y = lastFinalY(doc) + 16;
  for (const limitation of report.limitations) {
    doc.text(`- ${limitation}`, 42, y, { maxWidth: 510 });
    y += 14 + Math.floor(limitation.length / 120) * 12;
  }
  setFinalY(doc, y);

  // ---- Footer: page x of y ----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...DARK.muted);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 42, doc.internal.pageSize.getHeight() - 24, {
      align: "right",
    });
    doc.text(`${report.scope.branchName} | ${report.scope.userName || "Everyone"}`, 42, doc.internal.pageSize.getHeight() - 24);
  }

  return doc;
}

export function weeklyPdfFilename(report: WeeklyReport): string {
  const person = (report.scope.userName || "all").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `Weekly_Accomplishment_${report.range.from}_to_${report.range.to}_${person}.pdf`;
}
