import ExcelJS from "exceljs";

export interface ExportCompany {
  date?: Date | null;
  company: string;
  industry?: string;
  email?: string;
  mobile1?: string;
  mobile2?: string;
  mobile3?: string;
  landline1?: string;
  landline2?: string;
  landline3?: string;
  address?: string;
  website?: string;
  contactPerson?: string;
  position?: string;
  status?: string;
  remarks?: string;
  lastContactDate?: Date | null;
  projects?: ExportProject[];
  activities?: ExportActivity[];
}

export interface ExportProject {
  projectName: string;
  status: string;
  projectLocation?: string;
  projectType?: string;
  startDate?: Date | null;
  targetCompletion?: Date | null;
  actualCompletion?: Date | null;
  installationStatus?: string;
  testingStatus?: string;
  commissioningStatus?: string;
  remarks?: string;
}

export interface ExportActivity {
  date: Date;
  type: string;
  company?: string;
  contactPerson?: string;
  description?: string;
  result?: string;
  nextAction?: string;
  nextFollowUp?: Date | null;
}

const HEADER_FONT = {
  name: "Calibri",
  bold: true,
  size: 11,
  color: { argb: "FFFFFFFF" },
};

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF2F5496" },
};

const HEADER_ALIGNMENT = {
  horizontal: "center" as const,
  vertical: "middle" as const,
  wrapText: true,
};

const CELL_FONT = {
  name: "Calibri",
  size: 11,
};

const CELL_ALIGNMENT = {
  vertical: "top" as const,
  wrapText: true,
};

function formatDate(ws: ExcelJS.Worksheet, row: number, col: number, date: Date | null | undefined) {
  if (!date) return;
  const cell = ws.getCell(row, col);
  cell.value = date;
  cell.numFmt = "MM/DD/YYYY";
}

function setPhoneAsText(ws: ExcelJS.Worksheet, row: number, col: number, value: string | undefined) {
  if (!value) return;
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.numFmt = "@";
}

export async function exportCustomerDatabase(companies: ExportCompany[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coldprime CRM";
  wb.created = new Date();

  const ws = wb.addWorksheet("Customer", {
    views: [{ state: "frozen", ySplit: 3, xSplit: 0 }],
  });

  // Title row
  ws.mergeCells("A1:R1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "COLDPRIME ENTERPRISES CORPORATION — Customer Database";
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F3864" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };

  // Subtitle
  ws.mergeCells("A2:R2");
  const subtitleCell = ws.getCell("A2");
  subtitleCell.value = `Generated: ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })} | Cebu Region`;
  subtitleCell.font = { name: "Calibri", italic: true, size: 10, color: { argb: "FF666666" } };
  subtitleCell.alignment = { horizontal: "center" };

  // Headers (Row 3)
  const headers = [
    "Date",
    "Customer",
    "Industry",
    "Email",
    "Mobile 1",
    "Mobile 2",
    "Mobile 3",
    "Landline 1",
    "Landline 2",
    "Landline 3",
    "Address",
    "Website",
    "Contact Person",
    "Position",
    "Status",
    "Last Contact",
    "Remarks",
  ];

  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Data rows
  companies.forEach((c, idx) => {
    const row = ws.getRow(idx + 4);
    const values = [
      null,
      c.company,
      c.industry,
      c.email,
      c.mobile1,
      c.mobile2,
      c.mobile3,
      c.landline1,
      c.landline2,
      c.landline3,
      c.address,
      c.website,
      c.contactPerson,
      c.position,
      c.status,
      null,
      c.remarks,
    ];

    values.forEach((v, i) => {
      row.getCell(i + 1).value = v || "";
      row.getCell(i + 1).font = CELL_FONT;
      row.getCell(i + 1).alignment = CELL_ALIGNMENT;
    });

    formatDate(ws, idx + 4, 1, c.date ?? null);
    formatDate(ws, idx + 4, 16, c.lastContactDate ?? null);
    setPhoneAsText(ws, idx + 4, 5, c.mobile1);
    setPhoneAsText(ws, idx + 4, 6, c.mobile2);
    setPhoneAsText(ws, idx + 4, 7, c.mobile3);
    setPhoneAsText(ws, idx + 4, 8, c.landline1);
    setPhoneAsText(ws, idx + 4, 9, c.landline2);
    setPhoneAsText(ws, idx + 4, 10, c.landline3);
  });

  // Column widths
  ws.columns = [
    { width: 14 },   // Date
    { width: 35 },   // Customer
    { width: 22 },   // Industry
    { width: 32 },   // Email
    { width: 20 },   // Mobile 1
    { width: 20 },   // Mobile 2
    { width: 20 },   // Mobile 3
    { width: 20 },   // Landline 1
    { width: 20 },   // Landline 2
    { width: 20 },   // Landline 3
    { width: 40 },   // Address
    { width: 30 },   // Website
    { width: 22 },   // Contact Person
    { width: 18 },   // Position
    { width: 16 },   // Status
    { width: 14 },   // Last Contact
    { width: 35 },   // Remarks
  ];

  // Auto filter
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + companies.length, column: 17 },
  };

  // Print setup
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  ws.headerFooter = {
    oddHeader: "&C&B Coldprime Enterprises Corporation",
    oddFooter: "&L&D&RPage &P of &N",
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportProjectReport(projects: (ExportProject & { company?: string })[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coldprime CRM";

  const ws = wb.addWorksheet("Projects", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 0 }],
  });

  ws.mergeCells("A1:N1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "COLDPRIME ENTERPRISES CORPORATION — Project Report";
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F3864" } };
  titleCell.alignment = { horizontal: "center" };

  const headers = [
    "Company",
    "Project Name",
    "Location",
    "Type",
    "Status",
    "Start Date",
    "Target Completion",
    "Actual Completion",
    "Installation",
    "Testing",
    "Commissioning",
    "Remarks",
  ];

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
  });

  projects.forEach((p, idx) => {
    const row = ws.getRow(idx + 3);
    const values = [
      p.company,
      p.projectName,
      p.projectLocation,
      p.projectType,
      p.status,
      null,
      null,
      null,
      p.installationStatus,
      p.testingStatus,
      p.commissioningStatus,
      p.remarks,
    ];

    values.forEach((v, i) => {
      row.getCell(i + 1).value = v || "";
      row.getCell(i + 1).font = CELL_FONT;
      row.getCell(i + 1).alignment = CELL_ALIGNMENT;
    });

    formatDate(ws, idx + 3, 6, p.startDate ?? null);
    formatDate(ws, idx + 3, 7, p.targetCompletion ?? null);
    formatDate(ws, idx + 3, 8, p.actualCompletion ?? null);
  });

  ws.columns = [
    { width: 30 }, { width: 28 }, { width: 30 }, { width: 22 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 16 }, { width: 14 }, { width: 16 }, { width: 30 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function exportActivityReport(activities: ExportActivity[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Coldprime CRM";

  const ws = wb.addWorksheet("Activities", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 0 }],
  });

  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "COLDPRIME ENTERPRISES CORPORATION — Activity Report";
  titleCell.font = { name: "Calibri", bold: true, size: 14, color: { argb: "FF1F3864" } };
  titleCell.alignment = { horizontal: "center" };

  const headers = [
    "Date",
    "Type",
    "Company",
    "Contact Person",
    "Description",
    "Result",
    "Next Action",
    "Next Follow-Up",
  ];

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
  });

  activities.forEach((a, idx) => {
    const row = ws.getRow(idx + 3);
    const values = [
      null,
      a.type,
      a.company,
      a.contactPerson,
      a.description,
      a.result,
      a.nextAction,
      null,
    ];

    values.forEach((v, i) => {
      row.getCell(i + 1).value = v || "";
      row.getCell(i + 1).font = CELL_FONT;
      row.getCell(i + 1).alignment = CELL_ALIGNMENT;
    });

    formatDate(ws, idx + 3, 1, a.date);
    formatDate(ws, idx + 3, 8, a.nextFollowUp ?? null);
  });

  ws.columns = [
    { width: 14 }, { width: 18 }, { width: 30 }, { width: 22 },
    { width: 35 }, { width: 22 }, { width: 22 }, { width: 14 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}