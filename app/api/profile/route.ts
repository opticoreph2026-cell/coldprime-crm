import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/branch";

export async function GET() {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { name: true, email: true, phone: true, signatureEmail: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      signatureEmail: user.signatureEmail || user.email,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load profile";
    console.error("Error loading profile:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    let session;
    try { session = await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const signatureEmail = typeof body.signatureEmail === "string" ? body.signatureEmail.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id as string },
      data: {
        name,
        phone: phone || null,
        signatureEmail: signatureEmail || null,
      },
      select: { name: true, email: true, phone: true, signatureEmail: true },
    });

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      signatureEmail: user.signatureEmail || user.email,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save profile";
    console.error("Error saving profile:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
