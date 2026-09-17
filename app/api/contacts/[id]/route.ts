import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(contact);
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
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
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}