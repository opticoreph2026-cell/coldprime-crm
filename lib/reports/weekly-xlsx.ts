// Excel export for the weekly accomplishment report (master instructions 1.7).
// Column definitions live in lib/reports/layout.ts.

import ExcelJS from "exceljs";
import { WeeklyReport } from "./weekly";
import { KPI_KEYS } from "./kpi-map";
import {
  ACTIVITY_COLUMNS,
  ENTITY_LABELS,
  PLAN_COLUMNS,
  PIPELINE_COLUMNS,
  PROJECT_COLUMNS,
  RECORD_COLUMNS,
  REPORT_ORG,
  REPORT_TITLE,
  SERVICE_TICKET_COLUMNS,
  SHEET_NAMES,
  SUMMARY_COLUMNS,
} from "./layout";
import { formatPH, startOfDayPH } from "@/lib/dates";

const HEADER_FONT = { name: "Calibri", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF2F5496" } };
const HEADER_ALIGNMENT = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
const CELL_FONT = { name: "Calibri", size: 11 };
const CELL_ALIGNMENT = { vertical: "top" as const, wrapText: true };
const THIN_BORDER = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};
const DATE_FMT = "dd-mmm-yyyy";

function writeHeaderRow(ws: ExcelJS.Worksheet, rowNumber: number, columns: readonly string[]) {
  const row = ws.getRow(rowNumber);
  columns.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = THIN_BORDER;
  });
}

function writeDataRow(ws: ExcelJS.Worksheet, rowNumber: number, values: (string | number | Date | null)[]) {
  const row = ws.getRow(rowNumber);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v === undefined ? "" : v;
    cell.font = CELL_FONT;
    cell.alignment = CELL_ALIGNMENT;
    if (v instanceof Date) cell.numFmt = DATE_FMT;
  });
}

function addTitle(ws: ExcelJS.Worksheet, colCount: number, subtitle: string) {
  ws.mergeCells(1, 1, 1, colCount);
  const title = ws.getCell(1, 1);
  title.value = `${REPORT_ORG} — ${REPORT_TITLE}`;
  title.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F3864" } };
  title.alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells(2, 1, 2, colCount);
  const sub = ws.getCell(2, 1);
  sub.value = subtitle;
  sub.font = { name: "Calibri", italic: true, size: 10, color: { argb: "FF666666" } };
  sub.alignment = { horizontal: "center" };
}

export async function buildWeeklyXlsx(report: WeeklyReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coldprime CRM";
  wb.created = new Date();

  const person = report.scope.userName || "Everyone";
  const subtitle = `${report.scope.branchName} | ${person} | ${formatPH(startOfDayPH(report.range.from))} to ${formatPH(startOfDayPH(report.range.to))} | Generated ${formatPH(report.generatedAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;

  // ---- Summary -----------------------------------------------------------
  const summary = wb.addWorksheet(SHEET_NAMES.summary, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(summary, SUMMARY_COLUMNS.length, subtitle);
  writeHeaderRow(summary, 3, SUMMARY_COLUMNS);

  report.weeks.forEach((w, idx) => {
    writeDataRow(summary, idx + 4, [w.label, ...KPI_KEYS.map((k) => w.kpis[k])]);
  });
  const totalsRow = 4 + report.weeks.length;
  writeDataRow(summary, totalsRow, ["TOTAL", ...KPI_KEYS.map((k) => report.totals[k])]);
  for (let c = 1; c <= SUMMARY_COLUMNS.length; c++) {
    summary.getCell(totalsRow, c).font = { name: "Calibri", bold: true, size: 11 };
    summary.getCell(totalsRow, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
  }
  summary.getRow(3).height = 30;
  summary.columns = [{ width: 34 }, ...KPI_KEYS.map(() => ({ width: 15 }))];
  summary.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: SUMMARY_COLUMNS.length } };

  // ---- Activities --------------------------------------------------------
  const activities = wb.addWorksheet(SHEET_NAMES.activities, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(activities, ACTIVITY_COLUMNS.length, subtitle);
  writeHeaderRow(activities, 3, ACTIVITY_COLUMNS);
  let aRow = 4;
  for (const w of report.weeks) {
    for (const a of w.activities) {
      writeDataRow(activities, aRow++, [
        w.label,
        a.date,
        a.type,
        a.companyName,
        a.projectName,
        a.performedBy,
        a.description,
        a.nextFollowUp,
      ]);
    }
  }
  activities.getRow(3).height = 30;
  activities.columns = [{ width: 26 }, { width: 14 }, { width: 18 }, { width: 30 }, { width: 26 }, { width: 20 }, { width: 40 }, { width: 16 }];
  activities.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, aRow - 1), column: ACTIVITY_COLUMNS.length } };

  // ---- Pipeline Moves ----------------------------------------------------
  const pipeline = wb.addWorksheet(SHEET_NAMES.pipeline, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(pipeline, PIPELINE_COLUMNS.length, subtitle);
  writeHeaderRow(pipeline, 3, PIPELINE_COLUMNS);
  let pRow = 4;
  for (const w of report.weeks) {
    for (const m of w.pipelineMoves) {
      writeDataRow(pipeline, pRow++, [
        w.label,
        m.at,
        ENTITY_LABELS[m.entity] || m.entity,
        m.label,
        m.from,
        m.to,
        m.userName,
      ]);
    }
  }
  pipeline.getRow(3).height = 30;
  pipeline.columns = [{ width: 26 }, { width: 14 }, { width: 12 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 20 }];
  pipeline.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, pRow - 1), column: PIPELINE_COLUMNS.length } };

  // ---- New Companies & Leads (contacts included) -------------------------
  const records = wb.addWorksheet(SHEET_NAMES.records, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(records, RECORD_COLUMNS.length, subtitle);
  writeHeaderRow(records, 3, RECORD_COLUMNS);
  let rRow = 4;
  for (const w of report.weeks) {
    const all: { kind: string; row: (typeof w.newCompanies)[number] }[] = [
      ...w.newCompanies.map((row) => ({ kind: "Company", row })),
      ...w.newContacts.map((row) => ({ kind: "Contact", row })),
      ...w.newLeads.map((row) => ({ kind: "Lead", row })),
    ];
    all.sort((x, y) => x.row.at.getTime() - y.row.at.getTime());
    for (const item of all) {
      writeDataRow(records, rRow++, [w.label, item.row.at, item.kind, item.row.name, item.row.sub, item.row.userName]);
    }
  }
  records.getRow(3).height = 30;
  records.columns = [{ width: 26 }, { width: 14 }, { width: 12 }, { width: 34 }, { width: 30 }, { width: 20 }];
  records.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, rRow - 1), column: RECORD_COLUMNS.length } };

  // ---- Projects & Service Tickets ---------------------------------------
  const projects = wb.addWorksheet(SHEET_NAMES.projects, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(projects, PROJECT_COLUMNS.length, subtitle);
  writeHeaderRow(projects, 3, PROJECT_COLUMNS);
  let prRow = 4;
  for (const w of report.weeks) {
    for (const m of w.projectsAdvanced) {
      writeDataRow(projects, prRow++, [w.label, m.at, m.label, m.from, m.to, m.userName]);
    }
  }
  prRow += 1;
  const stTitle = projects.getRow(prRow);
  stTitle.getCell(1).value = "Service Tickets";
  stTitle.getCell(1).font = { name: "Calibri", bold: true, size: 12, color: { argb: "FF1F3864" } };
  prRow += 1;
  writeHeaderRow(projects, prRow, SERVICE_TICKET_COLUMNS);
  prRow += 1;
  writeDataRow(projects, prRow, ["—", null, "No service tickets yet (module pending)", "", null]);
  projects.getRow(3).height = 30;
  projects.columns = [{ width: 26 }, { width: 14 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 20 }];

  // ---- Next Week Plan ----------------------------------------------------
  const plan = wb.addWorksheet(SHEET_NAMES.plan, {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  addTitle(plan, PLAN_COLUMNS.length, subtitle);
  writeHeaderRow(plan, 3, PLAN_COLUMNS);
  let plRow = 4;
  const planRows = report.weeks.length > 0 ? report.weeks[report.weeks.length - 1].nextWeekPlan : [];
  for (const p of planRows) {
    writeDataRow(plan, plRow++, [p.kind === "activity" ? "Activity" : "Lead", p.due, p.label]);
  }
  plan.getRow(3).height = 30;
  plan.columns = [{ width: 14 }, { width: 16 }, { width: 70 }];
  plan.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, plRow - 1), column: PLAN_COLUMNS.length } };

  // Print setup + footer on every sheet
  for (const ws of wb.worksheets) {
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    ws.headerFooter = { oddHeader: `&C&B ${REPORT_ORG}`, oddFooter: "&L&D&RPage &P of &N" };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function weeklyXlsxFilename(report: WeeklyReport): string {
  const person = (report.scope.userName || "all").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `Weekly_Accomplishment_${report.range.from}_to_${report.range.to}_${person}.xlsx`;
}
