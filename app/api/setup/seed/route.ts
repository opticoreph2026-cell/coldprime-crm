import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key !== "coldprime-seed-2026") {
      return NextResponse.json({ error: "Invalid key" }, { status: 403 });
    }

    const results: string[] = [];

    // Create branches
    const cebuBranch = await prisma.branch.upsert({
      where: { slug: "cebu" },
      update: {},
      create: { id: "branch_cebu", name: "Cebu Office", slug: "cebu", domain: "cebu.coldprime-crm.vercel.app" },
    });
    results.push(`Branch: ${cebuBranch.name} (${cebuBranch.id})`);

    const manilaBranch = await prisma.branch.upsert({
      where: { slug: "manila" },
      update: {},
      create: { id: "branch_manila", name: "Manila Office", slug: "manila", domain: "manila.coldprime-crm.vercel.app" },
    });
    results.push(`Branch: ${manilaBranch.name} (${manilaBranch.id})`);

    // Create users
    const passwordHash = await bcrypt.hash("Coldprime2026!", 10);

    const users = [
      { email: "admin@coldprime.ph", name: "Head Administrator", role: "HEAD_ADMIN" as const, branchId: cebuBranch.id },
      { email: "cebu-admin@coldprime.ph", name: "Cebu Administrator", role: "BRANCH_ADMIN" as const, branchId: cebuBranch.id },
      { email: "manila-admin@coldprime.ph", name: "Manila Administrator", role: "BRANCH_ADMIN" as const, branchId: manilaBranch.id },
      { email: "cebu-staff@coldprime.ph", name: "Cebu Staff", role: "STAFF" as const, branchId: cebuBranch.id },
      { email: "manila-staff@coldprime.ph", name: "Manila Staff", role: "STAFF" as const, branchId: manilaBranch.id },
    ];

    for (const userData of users) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          email: userData.email,
          name: userData.name,
          password: passwordHash,
          role: userData.role,
          branchId: userData.branchId,
        },
      });
      results.push(`User: ${user.email} (${user.role})`);
    }

    // Create status definitions for both branches
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

    let statusCount = 0;
    for (const branch of [cebuBranch, manilaBranch]) {
      for (const status of allStatuses) {
        await prisma.statusDefinition.upsert({
          where: { branchId_name_type: { branchId: branch.id, name: status.name, type: status.type } },
          update: {},
          create: { branchId: branch.id, name: status.name, type: status.type, isActive: true },
        });
        statusCount++;
      }
    }
    results.push(`Status definitions: ${statusCount} created/verified`);

    return NextResponse.json({
      success: true,
      message: "Production database seeded successfully",
      results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({
      error: "Seed failed",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
