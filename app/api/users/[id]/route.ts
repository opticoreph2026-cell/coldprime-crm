import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/branch";
import bcrypt from "bcryptjs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true, slug: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // BRANCH_ADMIN can only view users in their branch
    if (session.user.role === "BRANCH_ADMIN" && user.branchId !== session.user.branchId) {
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
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["HEAD_ADMIN", "BRANCH_ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const { name, email, role, branchId, isActive, password } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // BRANCH_ADMIN can only update users in their branch
    if (session.user.role === "BRANCH_ADMIN" && existing.branchId !== session.user.branchId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // BRANCH_ADMIN cannot assign HEAD_ADMIN role
    if (session.user.role === "BRANCH_ADMIN" && role === "HEAD_ADMIN") {
      return NextResponse.json({ error: "Cannot assign Head Admin role" }, { status: 403 });
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim();
    if (role && session.user.role === "HEAD_ADMIN") updateData.role = role;
    if (branchId && session.user.role === "HEAD_ADMIN") updateData.branchId = branchId;
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
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
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["HEAD_ADMIN"]);
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot delete yourself
    if (existing.id === session.user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
