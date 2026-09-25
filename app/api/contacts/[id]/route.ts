import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBranchFilter, requireAuth } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { contactUpdateSchema } from "@/lib/validations/contact";
import { isForeignKeyError } from "@/lib/prisma-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const contact = await prisma.contact.findFirst({
      where: { id, ...branchFilter },
      include: { company: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.contact.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = parseOr400(contactUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName.trim() }),
        ...(body.lastName !== undefined && { lastName: body.lastName?.trim() || null }),
        ...(body.position !== undefined && { position: body.position?.trim() || null }),
        ...(body.email !== undefined && { email: body.email?.trim() || null }),
        ...(body.mobile !== undefined && { mobile: body.mobile?.trim() || null }),
        ...(body.landline !== undefined && { landline: body.landline?.trim() || null }),
        ...(body.contactPreference !== undefined && { contactPreference: body.contactPreference }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
      },
    });
    return NextResponse.json(contact);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
    const branchFilter = await getBranchFilter();

    const { id } = await params;
    const existing = await prisma.contact.findFirst({ where: { id, ...branchFilter } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyError(error)) {
      return NextResponse.json(
        { error: "Cannot delete this contact while related records still reference it." },
        { status: 409 }
      );
    }
    console.error("Error deleting contact:", error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}