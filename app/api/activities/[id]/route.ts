import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: { company: true, project: true, contact: true },
    });
    if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(activity);
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
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.date !== undefined && { date: new Date(body.date) }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.performedBy !== undefined && { performedBy: body.performedBy }),
        ...(body.contactPerson !== undefined && { contactPerson: body.contactPerson }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.nextAction !== undefined && { nextAction: body.nextAction }),
        ...(body.nextFollowUp !== undefined && { nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return NextResponse.json(activity);
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
    await prisma.activity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}