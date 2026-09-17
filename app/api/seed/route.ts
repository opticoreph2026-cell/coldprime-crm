import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    const passwordHash = await bcrypt.hash("Coldprime2026!", 10);

    const admin = await prisma.adminUser.upsert({
      where: { email: "admin@coldprime.ph" },
      update: {},
      create: {
        email: "admin@coldprime.ph",
        name: "Administrator",
        password: passwordHash,
        role: "ADMIN",
      },
    });

    const companyStatuses = ["Active", "Inactive", "Pending", "Prospect", "Archived"];
    const projectStatuses = [
      "New", "Email Sent", "Email Sent, for Contact", "Executed Emails Sent",
      "No Answer", "Unattended / Not in Service", "Call Again", "Emailed",
      "Ongoing", "Quotation", "Approved", "Installation", "Testing",
      "Commissioning", "Completed", "On Hold", "Cancelled", "Declined",
      "Infrastructure Solutions",
    ];
    const activityTypes = [
      "Phone Call", "Email", "SMS", "Meeting", "Site Visit", "Follow-Up",
      "Quotation Sent", "Quotation Follow-Up", "Accreditation Follow-Up",
      "Data Gathering", "Other",
    ];
    const industries = [
      "General Contractor", "Architectural", "Construction",
      "Business Process Outsourcing (BPO)", "Security Systems", "Hotel",
      "Hospital", "Restaurant", "Retail", "Government", "Manufacturing",
      "Real Estate", "Education", "IT / Technology", "Healthcare", "Other",
    ];

    const allStatuses = [
      ...companyStatuses.map((s) => ({ name: s, type: "company" })),
      ...projectStatuses.map((s) => ({ name: s, type: "project" })),
      ...activityTypes.map((s) => ({ name: s, type: "activity" })),
      ...industries.map((s) => ({ name: s, type: "industry" })),
    ];

    for (const status of allStatuses) {
      await prisma.statusDefinition.upsert({
        where: { name_type: { name: status.name, type: status.type } },
        update: {},
        create: { name: status.name, type: status.type, isActive: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded admin (${admin.email}) and ${allStatuses.length} status definitions`,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
