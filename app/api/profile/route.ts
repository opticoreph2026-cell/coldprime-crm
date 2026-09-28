import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/branch";
import { parseOr400, readJson } from "@/lib/validations";
import { profileUpdateSchema } from "@/lib/validations/user";

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

    const parsed = parseOr400(profileUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const name = parsed.data.name;
    const phone = parsed.data.phone ?? "";
    const signatureEmail = parsed.data.signatureEmail ?? "";

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
