import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getBranchFilter, requireAuth } from "@/lib/branch";

export async function GET(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const now = new Date();
    const weekStart = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
    const weekEnd = to ? new Date(to) : new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    const [activities, leads, projects] = await Promise.all([
      prisma.activity.findMany({
        where: {
          ...branchFilter,
          date: { gte: weekStart, lte: weekEnd },
        },
        include: { company: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.lead.findMany({
        where: {
          ...branchFilter,
          dateAdded: { gte: weekStart, lte: weekEnd },
        },
        include: { company: { select: { name: true } } },
      }),
      prisma.project.findMany({
        where: {
          ...branchFilter,
          status: { in: ["Completed", "Commissioning", "Testing"] },
          updatedAt: { gte: weekStart, lte: weekEnd },
        },
        include: { company: { select: { name: true } } },
      }),
    ]);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("COLDPRIME ENTERPRISES CORPORATION", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Weekly Accomplishment Report", pageWidth / 2, 28, { align: "center" });

    doc.setFontSize(10);
    const dateRange = `${weekStart.toLocaleDateString("en-PH")} - ${weekEnd.toLocaleDateString("en-PH")}`;
    doc.text(`Period: ${dateRange}`, pageWidth / 2, 35, { align: "center" });

    let yPos = 45;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Activities: ${activities.length}`, 14, yPos);
    yPos += 6;
    doc.text(`New Leads: ${leads.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Projects Updated: ${projects.length}`, 14, yPos);
    yPos += 10;

    // Activities table
    if (activities.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Activities", 14, yPos);
      yPos += 4;

      const activityRows = activities.map((a) => [
        a.date.toLocaleDateString("en-PH"),
        a.type,
        a.company?.name || "-",
        a.contactPerson || "-",
        a.description || "-",
        a.result || "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Date", "Type", "Company", "Contact", "Description", "Result"]],
        body: activityRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [47, 84, 150] },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // Leads table
    if (leads.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("New Leads", 14, yPos);
      yPos += 4;

      const leadRows = leads.map((l) => [
        l.dateAdded.toLocaleDateString("en-PH"),
        l.company?.name || "Walk-in",
        l.source || "-",
        l.industry || "-",
        l.status,
        l.priority || "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Date", "Company", "Source", "Industry", "Status", "Priority"]],
        body: leadRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [47, 84, 150] },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }

    // Projects table
    if (projects.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Projects Updated", 14, yPos);
      yPos += 4;

      const projectRows = projects.map((p) => [
        p.company.name,
        p.projectName,
        p.status,
        p.projectLocation || "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Company", "Project", "Status", "Location"]],
        body: projectRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [47, 84, 150] },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${i} of ${pageCount} | Generated: ${new Date().toLocaleString("en-PH")}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    const buffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `Accomplishment_Report_${weekStart.toISOString().split("T")[0]}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
