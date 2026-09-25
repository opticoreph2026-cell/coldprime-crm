import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth, requireBranchId } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { emailTemplateCreateSchema } from "@/lib/validations/email-template";

export async function GET() {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();
    const templates = await prisma.emailTemplate.findMany({
      where: { ...branchFilter, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: templates });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg === "No branch assigned") return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    let branchId: string;
    try {
      branchId = await requireBranchId();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "No branch assigned";
      return NextResponse.json(
        { error: `${m} — use the Active Branch selector in the sidebar, then save again.` },
        { status: 400 }
      );
    }
    const parsed = parseOr400(emailTemplateCreateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { name, subject, body: bodyContent, category } = parsed.data;

    const template = await prisma.emailTemplate.create({
      data: {
        branchId,
        name,
        subject,
        body: bodyContent,
        category,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save template";
    if ((error as { code?: string })?.code === "P2002" || msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A template with this name already exists in this branch — choose a different name." },
        { status: 409 }
      );
    }
    console.error("Error creating template:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
