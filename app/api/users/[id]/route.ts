import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/branch";
import bcrypt from "bcryptjs";
import { parseOr400, readJson } from "@/lib/validations";
import { userUpdateSchema } from "@/lib/validations/user";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]); } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      throw error;
    }
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (session.user.role === "BRANCH_ADMIN" && (user.branchId !== session.user.branchId || user.role === "HEAD_ADMIN")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      branch: user.branch,
      createdAt: user.createdAt,
    });
  } catch (error: unknown) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]); } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      throw error;
    }
    const { id } = await params;
    const parsed = parseOr400(userUpdateSchema, await readJson(request));
    if (!parsed.ok) return parsed.response;
    const { name, email, role, branchId, isActive, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (session.user.role === "BRANCH_ADMIN" && (existing.branchId !== session.user.branchId || existing.role === "HEAD_ADMIN")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (session.user.role === "BRANCH_ADMIN" && role === "HEAD_ADMIN") {
      return NextResponse.json({ error: "Cannot assign Head Admin role" }, { status: 403 });
    }

    if (existing.id === session.user.id && (role === "BRANCH_ADMIN" || role === "STAFF" || isActive === false)) {
      return NextResponse.json({ error: "Cannot demote or deactivate your own account" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim();
    if (role && session.user.role === "HEAD_ADMIN") updateData.role = role;
    if (branchId && session.user.role === "HEAD_ADMIN") updateData.branchId = branchId;
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      branch: user.branch,
    });
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try { session = await requireRole(["HEAD_ADMIN"]); } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (msg === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      throw error;
    }
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existing.id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
